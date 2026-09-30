package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"vimchi/server/internal/store"
)

const (
	maxRunBody    = 6 << 10 // one run is ~150 bytes, plus up to 10 coach events of ~130
	maxImportBody = 4 << 20
	maxImportRuns = 5000
)

type meResponse struct {
	Login     string `json:"login"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatarUrl"`
	Created   int64  `json:"created"`
}

// handleMe answers the signed-in account, or 204 for a guest: "not signed in" is a guest's
// normal state, so it is not an error status the browser logs on every page load.
func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	u, err := s.sessionUser(r)
	if errors.Is(err, errNoSession) {
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	name := u.Name
	if name == "" {
		name = u.Login
	}
	writeJSON(w, http.StatusOK, meResponse{
		Login:     u.Login,
		Name:      name,
		AvatarURL: u.AvatarURL,
		Created:   u.Created.UnixMilli(),
	})
}

func (s *Server) handleRuns(w http.ResponseWriter, r *http.Request, u store.User) {
	runs, err := s.Store.Runs(r.Context(), u.ID)
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, runs)
}

func (s *Server) handleAddRun(w http.ResponseWriter, r *http.Request, u store.User) {
	var run store.Run
	if !decodeJSON(w, r, maxRunBody, &run) {
		return
	}
	if err := run.Validate(s.Now().UnixMilli()); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.Store.AddRuns(r.Context(), u.ID, []store.Run{run}); err != nil {
		s.serverError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleImportRuns migrates a guest's local runs. Entries that fail to decode
// or validate are skipped rather than failing the batch, so one corrupt
// localStorage entry can't block the rest from syncing.
func (s *Server) handleImportRuns(w http.ResponseWriter, r *http.Request, u store.User) {
	var raw []json.RawMessage
	if !decodeJSON(w, r, maxImportBody, &raw) {
		return
	}
	if len(raw) > maxImportRuns {
		writeError(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("at most %d runs per import", maxImportRuns))
		return
	}
	now := s.Now().UnixMilli()
	runs := make([]store.Run, 0, len(raw))
	for _, m := range raw {
		var run store.Run
		if json.Unmarshal(m, &run) != nil {
			continue
		}
		if run.Validate(now) != nil {
			// Older or damaged coach data must not cost the learner the run itself.
			run.Coach, run.Mix = nil, nil
			if run.Validate(now) != nil {
				continue
			}
		}
		runs = append(runs, run)
	}
	if skipped := len(raw) - len(runs); skipped > 0 {
		s.Log.Info("import skipped invalid runs", "user", u.Login, "skipped", skipped, "kept", len(runs))
	}
	if err := s.Store.AddRuns(r.Context(), u.ID, runs); err != nil {
		s.serverError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleCoachProfile answers the coach's memory of this learner, derived from
// their stored critiques (patterns and counts only).
func (s *Server) handleCoachProfile(w http.ResponseWriter, r *http.Request, u store.User) {
	p, err := s.Store.CoachProfile(r.Context(), u.ID)
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}
