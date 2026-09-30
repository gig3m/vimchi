// Package httpapi wires the HTTP routes: GitHub OAuth, the JSON API and the
// static SPA.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"mime"
	"net/http"
	"net/url"
	"time"

	"vimchi/server/internal/auth"
	"vimchi/server/internal/store"
)

const (
	sessionCookie = "vimchi_session"
	sessionTTL    = 30 * 24 * time.Hour
)

// Server holds the dependencies for the HTTP handlers.
type Server struct {
	Store         *store.Store
	GitHub        *auth.GitHub
	BaseURL       string // public origin, e.g. http://localhost:5317
	StaticDir     string // built SPA
	SecureCookies bool   // force Secure cookies even over plain HTTP
	TrustProxy    bool   // take the client IP from X-Forwarded-For (behind Caddy/NPM)
	Log           *slog.Logger
	Now           func() time.Time // defaults to time.Now
}

// Handler returns the routed handler.
func (s *Server) Handler() http.Handler {
	if s.Now == nil {
		s.Now = time.Now
	}
	if s.Log == nil {
		s.Log = slog.Default()
	}

	authLimit := newLimiter(authBurst, authPerMinute, func() time.Time { return s.Now() })
	writeLimit := newLimiter(runWriteBurst, runWritePerMin, func() time.Time { return s.Now() })

	mux := http.NewServeMux()
	mux.HandleFunc("GET /auth/github/login", s.limited(authLimit, s.handleLogin))
	mux.HandleFunc("GET /auth/github/callback", s.limited(authLimit, s.handleCallback))
	mux.HandleFunc("POST /auth/logout", s.limited(authLimit, s.handleLogout))

	mux.HandleFunc("GET /healthz", s.handleHealth)

	mux.HandleFunc("GET /api/me", s.requireUser(s.handleMe))
	mux.HandleFunc("GET /api/runs", s.requireUser(s.handleRuns))
	mux.HandleFunc("POST /api/runs", s.limited(writeLimit, s.requireUser(s.handleAddRun)))
	mux.HandleFunc("GET /api/coach/profile", s.requireUser(s.handleCoachProfile))
	mux.HandleFunc("POST /api/runs/import", s.limited(writeLimit, s.requireUser(s.handleImportRuns)))
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "not found")
	})
	mux.HandleFunc("/auth/", http.NotFound)

	mux.Handle("/", s.spa())

	// Rejects cross-site unsafe requests via Sec-Fetch-Site, falling back to
	// comparing Origin with Host. Safe methods pass through untouched.
	csrf := http.NewCrossOriginProtection()
	if u, err := url.Parse(s.BaseURL); err == nil && u.Scheme != "" && u.Host != "" {
		if err := csrf.AddTrustedOrigin(u.Scheme + "://" + u.Host); err != nil {
			s.Log.Warn("ignoring base URL as trusted origin", "err", err)
		}
	}
	csrf.SetDenyHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusForbidden, "cross-origin request rejected")
	}))
	return csrf.Handler(mux)
}

type userHandler func(http.ResponseWriter, *http.Request, store.User)

// requireUser resolves the session cookie and responds 401 without one.
func (s *Server) requireUser(h userHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(sessionCookie)
		if err != nil || c.Value == "" {
			writeError(w, http.StatusUnauthorized, "not signed in")
			return
		}
		u, err := s.Store.SessionUser(r.Context(), auth.HashToken(c.Value), s.Now())
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusUnauthorized, "not signed in")
			return
		}
		if err != nil {
			s.serverError(w, r, err)
			return
		}
		h(w, r, u)
	}
}

// secure reports whether cookies set on this response should be Secure.
func (s *Server) secure(r *http.Request) bool {
	return s.SecureCookies || r.TLS != nil
}

// decodeJSON enforces a JSON content type and body limit, then decodes a
// single value into v. It writes the error response itself and returns false
// on failure.
func decodeJSON(w http.ResponseWriter, r *http.Request, limit int64, v any) bool {
	mt, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mt != "application/json" {
		writeError(w, http.StatusUnsupportedMediaType, "Content-Type must be application/json")
		return false
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, limit))
	if err := dec.Decode(v); err != nil {
		if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
			writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
		} else {
			writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		}
		return false
	}
	if dec.More() {
		writeError(w, http.StatusBadRequest, "invalid JSON: trailing data")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (s *Server) serverError(w http.ResponseWriter, r *http.Request, err error) {
	if !errors.Is(err, context.Canceled) {
		s.Log.Error("request failed", "method", r.Method, "path", r.URL.Path, "err", err)
	}
	writeError(w, http.StatusInternalServerError, "internal error")
}

// handleHealth answers the uptime probe: 200 {"ok":true} when the database
// responds, 503 otherwise.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.Store.Ping(ctx); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "database unavailable"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(map[string]any{"ok": true})
}
