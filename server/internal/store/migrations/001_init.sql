CREATE TABLE users (
    id         INTEGER PRIMARY KEY,
    github_id  INTEGER NOT NULL UNIQUE,
    login      TEXT    NOT NULL,
    name       TEXT    NOT NULL DEFAULT '',
    avatar_url TEXT    NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL -- unix ms
);

CREATE TABLE sessions (
    token_hash BLOB    PRIMARY KEY, -- sha256 of the cookie token
    user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL -- unix ms
) WITHOUT ROWID;

CREATE INDEX sessions_user_id ON sessions (user_id);
CREATE INDEX sessions_expires_at ON sessions (expires_at);

CREATE TABLE runs (
    id      INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    lesson  TEXT    NOT NULL,
    at      INTEGER NOT NULL, -- unix ms
    time_ms INTEGER NOT NULL,
    keys    INTEGER NOT NULL,
    speed   REAL    NOT NULL,
    acc     REAL    NOT NULL,
    correct REAL    NOT NULL,
    score   INTEGER NOT NULL,
    UNIQUE (user_id, lesson, at)
);

CREATE INDEX runs_user_at ON runs (user_id, at);
