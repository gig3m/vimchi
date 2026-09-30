package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"vimchi/server/internal/store"
)

func coachRunJSON(lesson string, at int64, coach string) string {
	return fmt.Sprintf(`{"lesson":%q,"at":%d,"time":5000,"keys":12,"speed":0.5,"acc":0.75,"correct":1,"score":50,"mix":{"moving":6,"typing":2,"editing":4},"coach":[%s]}`, lesson, at, coach)
}

func eventJSON(pattern string, at int64) string {
	return fmt.Sprintf(`{"pattern":%q,"lesson":"words","unit":1,"you":8,"better":2,"used":"key-run","at":%d}`, pattern, at)
}

func TestCoachEndpoints(t *testing.T) {
	s, h := newServer(t, nil)
	alice := signIn(t, s, 1, "alice")
	at := testNow.UnixMilli()

	if w := do(t, h, "GET", "/api/coach/profile", ""); w.Code != http.StatusUnauthorized {
		t.Errorf("GET /api/coach/profile without session = %d, want 401", w.Code)
	}
	// An empty profile is empty collections, not nulls.
	w := do(t, h, "GET", "/api/coach/profile", "", withCookie(alice))
	if w.Code != http.StatusOK || strings.TrimSpace(w.Body.String()) != `{"patterns":{},"keyMix":[],"recent":[]}` {
		t.Errorf("empty profile = %d %s", w.Code, w.Body)
	}

	// A run with coach events; a run without (older clients) still works.
	for _, body := range []string{
		coachRunJSON("words", at-3000, eventJSON("op-to-char", at-3000)+","+eventJSON("find-char", at-3000)),
		runJSON("words", at-2000, 50),
		coachRunJSON("words", at-1000, ""),
	} {
		if w := do(t, h, "POST", "/api/runs", body, withCookie(alice)); w.Code != http.StatusNoContent {
			t.Fatalf("POST /api/runs = %d %s", w.Code, w.Body)
		}
	}
	// Invalid coach data rejects a single POST.
	eleven := strings.TrimSuffix(strings.Repeat(eventJSON("dot", at)+",", 11), ",")
	for name, body := range map[string]string{
		"pattern with digits": coachRunJSON("words", at, eventJSON("op2", at)),
		"eleven events":       coachRunJSON("words", at, eleven),
		"raw keys in used":    strings.Replace(coachRunJSON("words", at, eventJSON("dot", at)), `"key-run"`, `"xxxxxxxx"`, 1),
		"negative count":      strings.Replace(coachRunJSON("words", at, eventJSON("dot", at)), `"you":8`, `"you":-1`, 1),
	} {
		if w := do(t, h, "POST", "/api/runs", body, withCookie(alice)); w.Code != http.StatusBadRequest {
			t.Errorf("%s: POST = %d, want 400", name, w.Code)
		}
	}

	// Import carries guest events; a run whose coach data is bad is kept without it.
	imp := "[" + coachRunJSON("guest", at-9000, eventJSON("dot", at-9000)) + "," +
		coachRunJSON("guest", at-8000, eventJSON("BAD", at-8000)) + "]"
	if w := do(t, h, "POST", "/api/runs/import", imp, withCookie(alice)); w.Code != http.StatusNoContent {
		t.Fatalf("import = %d %s", w.Code, w.Body)
	}

	w = do(t, h, "GET", "/api/coach/profile", "", withCookie(alice))
	var p store.CoachProfile
	if err := json.Unmarshal(w.Body.Bytes(), &p); err != nil {
		t.Fatal(err)
	}
	if d := p.Patterns["dot"]; d.Seen != 1 || d.FixedStreak != 2 || d.FirstSeenLesson != "words" {
		t.Errorf("dot = %+v", d)
	}
	if o := p.Patterns["op-to-char"]; o.Seen != 1 || o.FixedStreak != 1 || o.LastSeen != at-3000 {
		t.Errorf("op-to-char = %+v", o)
	}
	if len(p.Patterns) != 3 {
		t.Errorf("patterns = %v", p.Patterns)
	}
	// Coached runs: two posted with a mix and the valid import; the plain run and the stripped import are not.
	if len(p.KeyMix) != 3 || len(p.Recent) != 3 {
		t.Errorf("keyMix %d recent %d, want 3 and 3", len(p.KeyMix), len(p.Recent))
	}
	// /api/runs keeps its shape: no coach data comes back.
	w = do(t, h, "GET", "/api/runs", "", withCookie(alice))
	if strings.Contains(w.Body.String(), "coach") || strings.Contains(w.Body.String(), "mix") {
		t.Errorf("GET /api/runs leaks coach data: %s", w.Body)
	}
	if n := strings.Count(w.Body.String(), `"lesson"`); n != 5 {
		t.Errorf("runs stored = %d, want 5", n)
	}
}
