package httpapi

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"vimchi/server/internal/auth"
	"vimchi/server/internal/store"
)

var testNow = time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)

const testBase = "http://vimchi.test"

func newServer(t *testing.T, gh *auth.GitHub) (*Server, http.Handler) {
	t.Helper()
	st, err := store.Open(t.Context(), filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })

	static := t.TempDir()
	os.WriteFile(filepath.Join(static, "index.html"), []byte("<!doctype html>index"), 0o644)
	os.MkdirAll(filepath.Join(static, "assets"), 0o755)
	os.WriteFile(filepath.Join(static, "assets", "app-abc.js"), []byte("console.log(1)"), 0o644)

	if gh == nil {
		gh = auth.NewGitHub("", "")
	}
	s := &Server{
		Store:     st,
		GitHub:    gh,
		BaseURL:   testBase,
		StaticDir: static,
		Log:       slog.New(slog.DiscardHandler),
		Now:       func() time.Time { return testNow },
	}
	return s, s.Handler()
}

// signIn creates a user and session directly in the store and returns the
// session cookie.
func signIn(t *testing.T, s *Server, githubID int64, login string) *http.Cookie {
	t.Helper()
	u, err := s.Store.UpsertUser(t.Context(), store.User{GitHubID: githubID, Login: login, AvatarURL: "https://avatars.test/" + login}, testNow)
	if err != nil {
		t.Fatal(err)
	}
	tok := auth.NewToken()
	if err := s.Store.CreateSession(t.Context(), auth.HashToken(tok), u.ID, testNow.Add(time.Hour), testNow); err != nil {
		t.Fatal(err)
	}
	return &http.Cookie{Name: sessionCookie, Value: tok}
}

type reqOpt func(*http.Request)

func withCookie(c *http.Cookie) reqOpt { return func(r *http.Request) { r.AddCookie(c) } }
func withHeader(k, v string) reqOpt    { return func(r *http.Request) { r.Header.Set(k, v) } }
func withRemote(addr string) reqOpt    { return func(r *http.Request) { r.RemoteAddr = addr } }

func do(t *testing.T, h http.Handler, method, target, body string, opts ...reqOpt) *httptest.ResponseRecorder {
	t.Helper()
	var rd io.Reader
	if body != "" {
		rd = strings.NewReader(body)
	}
	r := httptest.NewRequest(method, target, rd)
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	for _, o := range opts {
		o(r)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func runJSON(lesson string, at int64, score int) string {
	return fmt.Sprintf(`{"lesson":%q,"at":%d,"time":5000,"keys":12,"speed":0.5,"acc":0.75,"correct":1,"score":%d}`, lesson, at, score)
}

func TestRunsEndpoints(t *testing.T) {
	s, h := newServer(t, nil)
	alice := signIn(t, s, 1, "alice")
	bob := signIn(t, s, 2, "bob")
	at := testNow.UnixMilli()

	// Unauthenticated. /api/me answers 204 ("not signed in" is the guest's normal state, not an
	// error the browser logs); everything else is 401.
	if w := do(t, h, "GET", "/api/me", ""); w.Code != http.StatusNoContent || w.Body.Len() != 0 {
		t.Errorf("GET /api/me without session = %d %q, want 204 and no body", w.Code, w.Body)
	}
	for _, tc := range []struct{ method, path, body string }{
		{"GET", "/api/runs", ""},
		{"POST", "/api/runs", runJSON("hjkl", at, 50)},
		{"POST", "/api/runs/import", "[]"},
	} {
		if w := do(t, h, tc.method, tc.path, tc.body); w.Code != http.StatusUnauthorized {
			t.Errorf("%s %s without session = %d, want 401", tc.method, tc.path, w.Code)
		}
	}
	if w := do(t, h, "GET", "/api/me", "", withCookie(&http.Cookie{Name: sessionCookie, Value: "bogus"})); w.Code != http.StatusNoContent {
		t.Errorf("bogus session /api/me = %d, want 204", w.Code)
	}
	if w := do(t, h, "GET", "/api/runs", "", withCookie(&http.Cookie{Name: sessionCookie, Value: "bogus"})); w.Code != http.StatusUnauthorized {
		t.Errorf("bogus session /api/runs = %d, want 401", w.Code)
	}

	// /api/me
	w := do(t, h, "GET", "/api/me", "", withCookie(alice))
	if w.Code != http.StatusOK {
		t.Fatalf("GET /api/me = %d %s", w.Code, w.Body)
	}
	var me map[string]any
	json.Unmarshal(w.Body.Bytes(), &me)
	if me["login"] != "alice" || me["name"] != "alice" || me["avatarUrl"] != "https://avatars.test/alice" || me["created"] != float64(testNow.UnixMilli()) {
		t.Errorf("GET /api/me = %v", me)
	}

	// Add runs out of order; duplicate is ignored.
	for _, body := range []string{runJSON("hjkl", at-1000, 70), runJSON("words", at-5000, 40), runJSON("hjkl", at-1000, 99)} {
		if w := do(t, h, "POST", "/api/runs", body, withCookie(alice)); w.Code != http.StatusNoContent {
			t.Fatalf("POST /api/runs = %d %s", w.Code, w.Body)
		}
	}

	// Rejections.
	for _, tc := range []struct {
		name string
		body string
		opts []reqOpt
		want int
	}{
		{"invalid run", runJSON("Bad Lesson", at, 50), nil, http.StatusBadRequest},
		{"score out of range", runJSON("hjkl", at, 101), nil, http.StatusBadRequest},
		{"malformed", `{"lesson":`, nil, http.StatusBadRequest},
		{"trailing data", runJSON("hjkl", at, 1) + "{}", nil, http.StatusBadRequest},
		{"wrong type", `{"lesson":"hjkl","at":"now"}`, nil, http.StatusBadRequest},
		{"text/plain", runJSON("hjkl", at, 50), []reqOpt{withHeader("Content-Type", "text/plain")}, http.StatusUnsupportedMediaType},
		{"too large", `{"lesson":"` + strings.Repeat("a", 8<<10) + `"}`, nil, http.StatusRequestEntityTooLarge},
		{"cross-site", runJSON("hjkl", at, 50), []reqOpt{withHeader("Sec-Fetch-Site", "cross-site")}, http.StatusForbidden},
		{"foreign origin", runJSON("hjkl", at, 50), []reqOpt{withHeader("Origin", "https://evil.test")}, http.StatusForbidden},
	} {
		opts := append([]reqOpt{withCookie(alice)}, tc.opts...)
		if w := do(t, h, "POST", "/api/runs", tc.body, opts...); w.Code != tc.want {
			t.Errorf("%s: POST /api/runs = %d, want %d (%s)", tc.name, w.Code, tc.want, w.Body)
		}
	}
	// Same-origin browser requests pass.
	if w := do(t, h, "POST", "/api/runs", runJSON("hjkl", at, 60), withCookie(alice),
		withHeader("Sec-Fetch-Site", "same-origin"), withHeader("Origin", testBase)); w.Code != http.StatusNoContent {
		t.Errorf("same-origin POST = %d %s", w.Code, w.Body)
	}

	// Import: dedupes against existing and within the batch, skips invalid.
	imp := "[" + strings.Join([]string{
		runJSON("hjkl", at-1000, 1), // dup of existing
		runJSON("guest", at-9000, 30),
		runJSON("guest", at-9000, 31), // dup within batch
		runJSON("NOPE", at, 30),       // invalid, skipped
		`{"lesson":42}`,               // wrong type, skipped
	}, ",") + "]"
	if w := do(t, h, "POST", "/api/runs/import", imp, withCookie(alice)); w.Code != http.StatusNoContent {
		t.Fatalf("POST /api/runs/import = %d %s", w.Code, w.Body)
	}
	many := "[" + strings.TrimSuffix(strings.Repeat(runJSON("x", at, 1)+",", maxImportRuns+1), ",") + "]"
	if w := do(t, h, "POST", "/api/runs/import", many, withCookie(alice)); w.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("oversized import = %d, want 413", w.Code)
	}

	// GET returns alice's runs oldest first.
	w = do(t, h, "GET", "/api/runs", "", withCookie(alice))
	if w.Code != http.StatusOK {
		t.Fatalf("GET /api/runs = %d", w.Code)
	}
	var runs []store.Run
	if err := json.Unmarshal(w.Body.Bytes(), &runs); err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, r := range runs {
		got = append(got, fmt.Sprintf("%s@%d:%d", r.Lesson, at-r.At, r.Score))
	}
	want := "guest@9000:30 words@5000:40 hjkl@1000:70 hjkl@0:60"
	if strings.Join(got, " ") != want {
		t.Errorf("runs = %v, want %s", got, want)
	}

	// Bob sees none, as an empty array rather than null.
	w = do(t, h, "GET", "/api/runs", "", withCookie(bob))
	if strings.TrimSpace(w.Body.String()) != "[]" {
		t.Errorf("bob's runs = %s, want []", w.Body)
	}

	// Logout invalidates the session.
	if w := do(t, h, "POST", "/auth/logout", "", withCookie(alice)); w.Code != http.StatusNoContent {
		t.Fatalf("logout = %d", w.Code)
	}
	if w := do(t, h, "GET", "/api/me", "", withCookie(alice)); w.Code != http.StatusNoContent {
		t.Errorf("after logout /api/me = %d, want 204", w.Code)
	}
	if w := do(t, h, "GET", "/api/runs", "", withCookie(alice)); w.Code != http.StatusUnauthorized {
		t.Errorf("after logout /api/runs = %d, want 401", w.Code)
	}
}

func TestSPA(t *testing.T) {
	_, h := newServer(t, nil)
	for _, tc := range []struct {
		path     string
		wantCode int
		wantBody string
	}{
		{"/", 200, "index"},
		{"/lesson/hjkl", 200, "index"},
		{"/assets/app-abc.js", 200, "console.log"},
		{"/assets/missing.js", 404, ""},
		{"/api/nope", 404, `"error"`},
		{"/../../etc/passwd", 307, ""}, // mux cleans the path and redirects to /etc/passwd, which is then an SPA route
	} {
		w := do(t, h, "GET", tc.path, "")
		if w.Code != tc.wantCode || !strings.Contains(w.Body.String(), tc.wantBody) {
			t.Errorf("GET %s = %d %q, want %d containing %q", tc.path, w.Code, w.Body, tc.wantCode, tc.wantBody)
		}
	}
}

func TestLoginNotConfigured(t *testing.T) {
	_, h := newServer(t, nil)
	w := do(t, h, "GET", "/auth/github/login?return=/", "")
	if w.Code != http.StatusServiceUnavailable || !strings.Contains(w.Body.String(), "GITHUB_CLIENT_ID") {
		t.Errorf("login without config = %d %q", w.Code, w.Body)
	}
}

func fakeGitHub(t *testing.T) *auth.GitHub {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("POST /login/oauth/access_token", func(w http.ResponseWriter, r *http.Request) {
		r.ParseForm()
		if r.Form.Get("client_id") != "cid" || r.Form.Get("client_secret") != "secret" ||
			r.Form.Get("redirect_uri") != testBase+"/auth/github/callback" {
			t.Errorf("token request form = %v", r.Form)
		}
		w.Header().Set("Content-Type", "application/json")
		if r.Form.Get("code") != "good-code" {
			io.WriteString(w, `{"error":"bad_verification_code","error_description":"nope"}`)
			return
		}
		io.WriteString(w, `{"access_token":"gho_test","token_type":"bearer","scope":"read:user"}`)
	})
	mux.HandleFunc("GET /user", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer gho_test" {
			http.Error(w, "bad token", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"id":583231,"login":"octocat","name":"The Octocat","avatar_url":"https://avatars.test/octocat"}`)
	})
	ts := httptest.NewServer(mux)
	t.Cleanup(ts.Close)

	gh := auth.NewGitHub("cid", "secret")
	gh.AuthorizeURL = ts.URL + "/login/oauth/authorize"
	gh.TokenURL = ts.URL + "/login/oauth/access_token"
	gh.APIURL = ts.URL
	gh.HTTP = ts.Client()
	return gh
}

func cookieNamed(res *http.Response, name string) *http.Cookie {
	for _, c := range res.Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

// startLogin hits the login endpoint and returns the state cookie and the
// state GitHub would echo back.
func startLogin(t *testing.T, h http.Handler, ret string) (*http.Cookie, string) {
	t.Helper()
	w := do(t, h, "GET", "/auth/github/login?return="+url.QueryEscape(ret), "")
	if w.Code != http.StatusFound {
		t.Fatalf("login = %d %s", w.Code, w.Body)
	}
	loc, _ := url.Parse(w.Header().Get("Location"))
	q := loc.Query()
	if q.Get("client_id") != "cid" || q.Get("scope") != "read:user" || q.Get("redirect_uri") != testBase+"/auth/github/callback" || q.Get("state") == "" {
		t.Fatalf("authorize URL = %s", loc)
	}
	sc := cookieNamed(w.Result(), stateCookie)
	if sc == nil || !sc.HttpOnly || sc.MaxAge <= 0 {
		t.Fatalf("state cookie = %+v", sc)
	}
	return sc, q.Get("state")
}

func TestOAuthCallback(t *testing.T) {
	s, h := newServer(t, fakeGitHub(t))

	t.Run("success", func(t *testing.T) {
		sc, state := startLogin(t, h, "/lesson/words?x=1")
		w := do(t, h, "GET", "/auth/github/callback?code=good-code&state="+state, "", withCookie(sc))
		if w.Code != http.StatusFound || w.Header().Get("Location") != "/lesson/words?x=1" {
			t.Fatalf("callback = %d Location=%q %s", w.Code, w.Header().Get("Location"), w.Body)
		}
		sess := cookieNamed(w.Result(), sessionCookie)
		if sess == nil || !sess.HttpOnly || sess.SameSite != http.SameSiteLaxMode || sess.Secure {
			t.Fatalf("session cookie = %+v", sess)
		}
		if d := sess.Expires.Sub(testNow); d != sessionTTL {
			t.Errorf("session expires in %v, want %v", d, sessionTTL)
		}
		me := do(t, h, "GET", "/api/me", "", withCookie(sess))
		if !strings.Contains(me.Body.String(), `"login":"octocat"`) || !strings.Contains(me.Body.String(), `"name":"The Octocat"`) {
			t.Errorf("/api/me after login = %s", me.Body)
		}
	})

	t.Run("return keeps the SPA hash route", func(t *testing.T) {
		// The app routes by #id?seed=N; the learner comes back to the same lesson and file.
		for _, ret := range []string{"/#change-words?seed=42", "/#warm-up", "/#profile"} {
			sc, state := startLogin(t, h, ret)
			w := do(t, h, "GET", "/auth/github/callback?code=good-code&state="+state, "", withCookie(sc))
			if w.Header().Get("Location") != ret {
				t.Errorf("return %q: Location = %q", ret, w.Header().Get("Location"))
			}
		}
	})

	t.Run("unsafe return path", func(t *testing.T) {
		sc, state := startLogin(t, h, "//evil.test/x")
		w := do(t, h, "GET", "/auth/github/callback?code=good-code&state="+state, "", withCookie(sc))
		if w.Header().Get("Location") != "/" {
			t.Errorf("Location = %q, want /", w.Header().Get("Location"))
		}
	})

	t.Run("state mismatch", func(t *testing.T) {
		sc, _ := startLogin(t, h, "/")
		w := do(t, h, "GET", "/auth/github/callback?code=good-code&state=forged", "", withCookie(sc))
		if w.Code != http.StatusBadRequest || cookieNamed(w.Result(), sessionCookie) != nil {
			t.Errorf("forged state = %d", w.Code)
		}
	})

	t.Run("missing state cookie", func(t *testing.T) {
		_, state := startLogin(t, h, "/")
		if w := do(t, h, "GET", "/auth/github/callback?code=good-code&state="+state, ""); w.Code != http.StatusBadRequest {
			t.Errorf("no cookie = %d", w.Code)
		}
	})

	t.Run("bad code", func(t *testing.T) {
		sc, state := startLogin(t, h, "/")
		if w := do(t, h, "GET", "/auth/github/callback?code=bad&state="+state, "", withCookie(sc)); w.Code != http.StatusBadGateway {
			t.Errorf("bad code = %d", w.Code)
		}
	})

	t.Run("user cancelled", func(t *testing.T) {
		sc, state := startLogin(t, h, "/stats")
		w := do(t, h, "GET", "/auth/github/callback?error=access_denied&state="+state, "", withCookie(sc))
		if w.Code != http.StatusFound || w.Header().Get("Location") != "/stats" || cookieNamed(w.Result(), sessionCookie) != nil {
			t.Errorf("cancel = %d %q", w.Code, w.Header().Get("Location"))
		}
	})

	t.Run("secure cookies", func(t *testing.T) {
		s.SecureCookies = true
		defer func() { s.SecureCookies = false }()
		sc, state := startLogin(t, h, "/")
		w := do(t, h, "GET", "/auth/github/callback?code=good-code&state="+state, "", withCookie(sc))
		if c := cookieNamed(w.Result(), sessionCookie); c == nil || !c.Secure {
			t.Errorf("session cookie not Secure: %+v", c)
		}
	})
}

func TestHealthz(t *testing.T) {
	_, h := newServer(t, nil)
	w := do(t, h, http.MethodGet, "/healthz", "")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var body struct {
		OK bool `json:"ok"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil || !body.OK {
		t.Fatalf("body = %q, want {\"ok\":true}", w.Body.String())
	}
}

// Public deployments sit behind a reverse proxy; abusive clients are throttled
// per IP on the auth routes and on run writes.
func TestRateLimits(t *testing.T) {
	s, h := newServer(t, nil)
	alice := signIn(t, s, 1, "alice")
	at := testNow.UnixMilli()

	// Run writes: the burst is generous (a run every keystroke is not a use case).
	var last int
	for i := 0; i < runWriteBurst+1; i++ {
		w := do(t, h, "POST", "/api/runs", runJSON("hjkl", at+int64(i), 50), withCookie(alice))
		last = w.Code
		if i < runWriteBurst && w.Code != http.StatusNoContent {
			t.Fatalf("write %d = %d, want 204", i, w.Code)
		}
	}
	if last != http.StatusTooManyRequests {
		t.Fatalf("write past the burst = %d, want 429", last)
	}
	// Another client is unaffected.
	if w := do(t, h, "POST", "/api/runs", runJSON("hjkl", at+999, 50), withCookie(alice), withRemote("10.9.9.9:1234")); w.Code != http.StatusNoContent {
		t.Fatalf("other IP = %d, want 204", w.Code)
	}
	// Time passing refills the bucket.
	s.Now = func() time.Time { return testNow.Add(2 * time.Minute) }
	if w := do(t, h, "POST", "/api/runs", runJSON("hjkl", at+1000, 50), withCookie(alice)); w.Code != http.StatusNoContent {
		t.Fatalf("after refill = %d, want 204", w.Code)
	}

	// Auth routes: a tight limit; the unconfigured login answers 503, not 429, until the limit trips.
	s.Now = func() time.Time { return testNow }
	var code int
	for i := 0; i < authBurst+1; i++ {
		code = do(t, h, "GET", "/auth/github/login", "").Code
	}
	if code != http.StatusTooManyRequests {
		t.Fatalf("login past the burst = %d, want 429", code)
	}
	// Reads are never limited.
	for i := 0; i < 3*runWriteBurst; i++ {
		if w := do(t, h, "GET", "/api/runs", "", withCookie(alice)); w.Code != http.StatusOK {
			t.Fatalf("read %d = %d, want 200", i, w.Code)
		}
	}
}

// Behind a trusted proxy the client is the first X-Forwarded-For hop; without
// one the header is ignored so it cannot be used to dodge the limit.
func TestRateLimitClientIP(t *testing.T) {
	s, h := newServer(t, nil)
	alice := signIn(t, s, 1, "alice")
	at := testNow.UnixMilli()
	for i := 0; i < runWriteBurst; i++ {
		do(t, h, "POST", "/api/runs", runJSON("hjkl", at+int64(i), 50), withCookie(alice))
	}
	if w := do(t, h, "POST", "/api/runs", runJSON("hjkl", at+500, 50), withCookie(alice), withHeader("X-Forwarded-For", "203.0.113.7")); w.Code != http.StatusTooManyRequests {
		t.Fatalf("spoofed XFF without a trusted proxy = %d, want 429", w.Code)
	}
	// Behind a trusted proxy the client is the LAST hop: nginx/NPM append the peer they saw, so
	// anything before it was supplied by the client and can be forged.
	s.TrustProxy = true
	h = s.Handler()
	if w := do(t, h, "POST", "/api/runs", runJSON("hjkl", at+501, 50), withCookie(alice), withHeader("X-Forwarded-For", "10.0.0.1, 203.0.113.7")); w.Code != http.StatusNoContent {
		t.Fatalf("real client behind the proxy = %d, want 204", w.Code)
	}
	for i := 0; i < runWriteBurst; i++ {
		do(t, h, "POST", "/api/runs", runJSON("hjkl", at+600+int64(i), 50), withCookie(alice), withHeader("X-Forwarded-For", "10.0.0.1, 203.0.113.7"))
	}
	if w := do(t, h, "POST", "/api/runs", runJSON("hjkl", at+900, 50), withCookie(alice), withHeader("X-Forwarded-For", "198.51.100.9, 203.0.113.7")); w.Code != http.StatusTooManyRequests {
		t.Fatalf("a forged first hop must not open a fresh bucket: %d, want 429", w.Code)
	}
}
