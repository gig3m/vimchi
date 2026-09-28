package httpapi

import (
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"strings"
	"time"

	"vimchi/server/internal/auth"
	"vimchi/server/internal/store"
)

const (
	stateCookie = "vimchi_oauth"
	statePath   = "/auth/github"
	stateTTL    = 10 * time.Minute
)

func (s *Server) redirectURI() string {
	return strings.TrimRight(s.BaseURL, "/") + "/auth/github/callback"
}

// handleLogin starts the OAuth flow. The state and the sanitized return path
// ride in a short-lived cookie scoped to /auth/github.
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if !s.GitHub.Configured() {
		http.Error(w, "GitHub sign-in is not configured on this server: set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.", http.StatusServiceUnavailable)
		return
	}
	state := auth.NewToken()
	ret := auth.SanitizeReturn(r.URL.Query().Get("return"))
	http.SetCookie(w, &http.Cookie{
		Name:     stateCookie,
		Value:    state + "." + base64.RawURLEncoding.EncodeToString([]byte(ret)),
		Path:     statePath,
		MaxAge:   int(stateTTL / time.Second),
		HttpOnly: true,
		Secure:   s.secure(r),
		SameSite: http.SameSiteLaxMode, // must survive the top-level redirect back from GitHub
	})
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, s.GitHub.AuthCodeURL(state, s.redirectURI()), http.StatusFound)
}

// handleCallback completes the OAuth flow and starts a session.
func (s *Server) handleCallback(w http.ResponseWriter, r *http.Request) {
	if !s.GitHub.Configured() {
		http.Error(w, "GitHub sign-in is not configured on this server.", http.StatusServiceUnavailable)
		return
	}
	c, err := r.Cookie(stateCookie)
	if err != nil {
		http.Error(w, "Sign-in expired or was started in another browser. Please try again.", http.StatusBadRequest)
		return
	}
	// Single use: clear the state cookie whatever happens next.
	http.SetCookie(w, &http.Cookie{Name: stateCookie, Path: statePath, MaxAge: -1, HttpOnly: true, Secure: s.secure(r), SameSite: http.SameSiteLaxMode})

	wantState, encRet, _ := strings.Cut(c.Value, ".")
	retBytes, _ := base64.RawURLEncoding.DecodeString(encRet)
	ret := auth.SanitizeReturn(string(retBytes))

	q := r.URL.Query()
	gotState := q.Get("state")
	if wantState == "" || subtle.ConstantTimeCompare([]byte(wantState), []byte(gotState)) != 1 {
		http.Error(w, "Sign-in state mismatch. Please try again.", http.StatusBadRequest)
		return
	}
	if q.Get("error") != "" { // e.g. access_denied: the user cancelled
		http.Redirect(w, r, ret, http.StatusFound)
		return
	}
	code := q.Get("code")
	if code == "" {
		http.Error(w, "Missing authorization code.", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	token, err := s.GitHub.Exchange(ctx, code, s.redirectURI())
	if err != nil {
		s.Log.Warn("oauth exchange failed", "err", err)
		http.Error(w, "GitHub sign-in failed. Please try again.", http.StatusBadGateway)
		return
	}
	gh, err := s.GitHub.User(ctx, token)
	if err != nil {
		s.Log.Warn("github user fetch failed", "err", err)
		http.Error(w, "Could not read your GitHub profile. Please try again.", http.StatusBadGateway)
		return
	}

	now := s.Now()
	u, err := s.Store.UpsertUser(ctx, store.User{GitHubID: gh.ID, Login: gh.Login, Name: gh.Name, AvatarURL: gh.AvatarURL}, now)
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	sess := auth.NewToken()
	expires := now.Add(sessionTTL)
	if err := s.Store.CreateSession(ctx, auth.HashToken(sess), u.ID, expires, now); err != nil {
		s.serverError(w, r, err)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    sess,
		Path:     "/",
		Expires:  expires,
		MaxAge:   int(sessionTTL / time.Second),
		HttpOnly: true,
		Secure:   s.secure(r),
		SameSite: http.SameSiteLaxMode,
	})
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, ret, http.StatusFound)
}

// handleLogout ends the session. It is idempotent and always returns 204.
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil && c.Value != "" {
		if err := s.Store.DeleteSession(r.Context(), auth.HashToken(c.Value)); err != nil {
			s.serverError(w, r, err)
			return
		}
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   s.secure(r),
		SameSite: http.SameSiteLaxMode,
	})
	w.WriteHeader(http.StatusNoContent)
}
