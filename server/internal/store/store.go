// Package store persists users, sessions and runs in SQLite.
package store

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"sort"
	"time"

	_ "modernc.org/sqlite" // registers the "sqlite" driver
)

//go:embed migrations/*.sql
var migrations embed.FS

// ErrNotFound is returned when a lookup matches nothing.
var ErrNotFound = errors.New("store: not found")

// Store wraps the SQLite database.
type Store struct {
	db *sql.DB
}

// Open opens (creating if needed) the SQLite database at path and applies
// any pending migrations.
func Open(ctx context.Context, path string) (*Store, error) {
	q := url.Values{}
	q.Add("_pragma", "foreign_keys(1)")
	q.Add("_pragma", "journal_mode(WAL)")
	q.Add("_pragma", "busy_timeout(5000)")
	q.Add("_pragma", "synchronous(NORMAL)")
	db, err := sql.Open("sqlite", "file:"+path+"?"+q.Encode())
	if err != nil {
		return nil, err
	}
	// A single connection keeps SQLite writes serialized and sidesteps
	// SQLITE_BUSY; this app's load doesn't need more.
	db.SetMaxOpenConns(1)
	s := &Store{db: db}
	if err := s.migrate(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

// Close closes the database.
func (s *Store) Close() error { return s.db.Close() }

// Ping reports whether the database is reachable.
func (s *Store) Ping(ctx context.Context) error { return s.db.PingContext(ctx) }

// migrate applies embedded migrations newer than PRAGMA user_version. Files
// are named NNN_description.sql and applied in lexical order.
func (s *Store) migrate(ctx context.Context) error {
	names, err := fs.Glob(migrations, "migrations/*.sql")
	if err != nil {
		return err
	}
	sort.Strings(names)

	var version int
	if err := s.db.QueryRowContext(ctx, "PRAGMA user_version").Scan(&version); err != nil {
		return fmt.Errorf("read schema version: %w", err)
	}
	for i, name := range names[min(version, len(names)):] {
		n := version + i + 1
		body, err := migrations.ReadFile(name)
		if err != nil {
			return err
		}
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, string(body)); err != nil {
			tx.Rollback()
			return fmt.Errorf("migration %s: %w", name, err)
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf("PRAGMA user_version = %d", n)); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("migration %s: %w", name, err)
		}
	}
	return nil
}

// User is an account created from a GitHub login.
type User struct {
	ID        int64
	GitHubID  int64
	Login     string
	Name      string
	AvatarURL string
	Created   time.Time
}

// UpsertUser inserts the GitHub user or refreshes their profile fields,
// returning the stored row.
func (s *Store) UpsertUser(ctx context.Context, u User, now time.Time) (User, error) {
	const q = `
INSERT INTO users (github_id, login, name, avatar_url, created_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT (github_id) DO UPDATE SET
    login = excluded.login, name = excluded.name, avatar_url = excluded.avatar_url
RETURNING id, github_id, login, name, avatar_url, created_at`
	row := s.db.QueryRowContext(ctx, q, u.GitHubID, u.Login, u.Name, u.AvatarURL, now.UnixMilli())
	return scanUser(row)
}

func scanUser(row *sql.Row) (User, error) {
	var u User
	var created int64
	err := row.Scan(&u.ID, &u.GitHubID, &u.Login, &u.Name, &u.AvatarURL, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, err
	}
	u.Created = time.UnixMilli(created)
	return u, nil
}

// CreateSession records a session keyed by the hash of its token. Expired
// sessions are swept at the same time.
func (s *Store) CreateSession(ctx context.Context, tokenHash []byte, userID int64, expires, now time.Time) error {
	if _, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at <= ?`, now.UnixMilli()); err != nil {
		return err
	}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`,
		tokenHash, userID, expires.UnixMilli())
	return err
}

// SessionUser returns the user owning an unexpired session.
func (s *Store) SessionUser(ctx context.Context, tokenHash []byte, now time.Time) (User, error) {
	const q = `
SELECT u.id, u.github_id, u.login, u.name, u.avatar_url, u.created_at
FROM sessions s JOIN users u ON u.id = s.user_id
WHERE s.token_hash = ? AND s.expires_at > ?`
	return scanUser(s.db.QueryRowContext(ctx, q, tokenHash, now.UnixMilli()))
}

// DeleteSession removes a session; deleting a missing session is not an error.
func (s *Store) DeleteSession(ctx context.Context, tokenHash []byte) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash = ?`, tokenHash)
	return err
}

// AddRuns stores runs for a user in one transaction. Runs that duplicate an
// existing (user, lesson, at) are ignored.
func (s *Store) AddRuns(ctx context.Context, userID int64, runs []Run) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	stmt, err := tx.PrepareContext(ctx, `
INSERT INTO runs (user_id, lesson, at, time_ms, keys, speed, acc, correct, score)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (user_id, lesson, at) DO NOTHING`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	for _, r := range runs {
		if _, err := stmt.ExecContext(ctx, userID, r.Lesson, r.At, r.Time, r.Keys, r.Speed, r.Acc, r.Correct, r.Score); err != nil {
			return err
		}
	}
	// Keep only the newest MaxRunsPerUser (by time, then insertion order).
	if _, err := tx.ExecContext(ctx, `
DELETE FROM runs WHERE user_id = ? AND id NOT IN (
  SELECT id FROM runs WHERE user_id = ? ORDER BY at DESC, id DESC LIMIT ?)`, userID, userID, MaxRunsPerUser); err != nil {
		return err
	}
	return tx.Commit()
}

// Runs returns a user's runs, oldest first.
func (s *Store) Runs(ctx context.Context, userID int64) ([]Run, error) {
	rows, err := s.db.QueryContext(ctx, `
SELECT lesson, at, time_ms, keys, speed, acc, correct, score
FROM runs WHERE user_id = ? ORDER BY at, id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	runs := []Run{}
	for rows.Next() {
		var r Run
		if err := rows.Scan(&r.Lesson, &r.At, &r.Time, &r.Keys, &r.Speed, &r.Acc, &r.Correct, &r.Score); err != nil {
			return nil, err
		}
		runs = append(runs, r)
	}
	return runs, rows.Err()
}
