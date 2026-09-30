package store

import (
	"strings"
	"testing"
)

func goodEvent(at int64) CoachEvent {
	return CoachEvent{Pattern: "op-to-char", Lesson: "delete-to-char", Unit: 2, You: 9, Better: 3, Used: "key-run", At: at}
}

func TestCoachValidate(t *testing.T) {
	const now = int64(1_790_000_000_000)
	base := Run{Lesson: "hjkl", At: now - 1000, Score: 1}
	tests := []struct {
		name    string
		mut     func(*Run)
		wantErr string
	}{
		{"no coach data", func(r *Run) {}, ""},
		{"valid", func(r *Run) {
			r.Coach = []CoachEvent{goodEvent(r.At)}
			r.Mix = &KeyMix{Moving: 3, Typing: 2, Editing: 1}
		}, ""},
		{"ten events", func(r *Run) {
			for range 10 {
				r.Coach = append(r.Coach, goodEvent(r.At))
			}
		}, ""},
		{"eleven events", func(r *Run) {
			for range 11 {
				r.Coach = append(r.Coach, goodEvent(r.At))
			}
		}, "coach"},
		{"pattern uppercase", func(r *Run) { e := goodEvent(r.At); e.Pattern = "OpToChar"; r.Coach = []CoachEvent{e} }, "pattern"},
		{"pattern digits", func(r *Run) { e := goodEvent(r.At); e.Pattern = "op2"; r.Coach = []CoachEvent{e} }, "pattern"},
		{"pattern 32", func(r *Run) { e := goodEvent(r.At); e.Pattern = strings.Repeat("a", 32); r.Coach = []CoachEvent{e} }, ""},
		{"pattern 33", func(r *Run) { e := goodEvent(r.At); e.Pattern = strings.Repeat("a", 33); r.Coach = []CoachEvent{e} }, "pattern"},
		{"pattern empty", func(r *Run) { e := goodEvent(r.At); e.Pattern = ""; r.Coach = []CoachEvent{e} }, "pattern"},
		{"bad lesson", func(r *Run) { e := goodEvent(r.At); e.Lesson = "A B"; r.Coach = []CoachEvent{e} }, "lesson"},
		{"negative you", func(r *Run) { e := goodEvent(r.At); e.You = -1; r.Coach = []CoachEvent{e} }, "counts"},
		{"negative better", func(r *Run) { e := goodEvent(r.At); e.Better = -1; r.Coach = []CoachEvent{e} }, "counts"},
		{"negative unit", func(r *Run) { e := goodEvent(r.At); e.Unit = -1; r.Coach = []CoachEvent{e} }, "counts"},
		{"used is not a bucket", func(r *Run) { e := goodEvent(r.At); e.Used = "xxxxxxx"; r.Coach = []CoachEvent{e} }, "used"},
		{"event at zero", func(r *Run) { e := goodEvent(r.At); e.At = 0; r.Coach = []CoachEvent{e} }, "at"},
		{"negative mix", func(r *Run) { r.Mix = &KeyMix{Moving: -1} }, "mix"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := base
			tt.mut(&r)
			err := r.Validate(now)
			switch {
			case tt.wantErr == "" && err != nil:
				t.Fatalf("unexpected error: %v", err)
			case tt.wantErr != "" && err == nil:
				t.Fatalf("expected error mentioning %q", tt.wantErr)
			case tt.wantErr != "" && !strings.Contains(err.Error(), tt.wantErr):
				t.Fatalf("error %q does not mention %q", err, tt.wantErr)
			}
		})
	}
}

func cr(at int64, lesson string, mix *KeyMix, patterns ...string) CoachRun {
	r := CoachRun{Lesson: lesson, At: at, Mix: mix}
	for _, p := range patterns {
		r.Events = append(r.Events, CoachEvent{Pattern: p, Lesson: lesson, At: at, You: 5, Better: 2, Used: "commands"})
	}
	return r
}

func TestBuildProfile(t *testing.T) {
	mix := &KeyMix{Moving: 10, Typing: 4, Editing: 6}
	runs := []CoachRun{
		cr(1, "delete-to-char", mix, "op-to-char", "op-to-char"),
		cr(2, "words", mix, "find-char"),
		cr(3, "words", mix, "op-to-char"),
		cr(4, "words", mix),
		cr(5, "words", nil, "find-char"), // events without a mix still count
		cr(6, "words", mix),
	}
	p := BuildProfile(runs)
	otc := p.Patterns["op-to-char"]
	if otc.Seen != 3 || otc.Runs != 2 || otc.LastSeen != 3 || otc.FixedStreak != 3 || otc.FirstSeenLesson != "delete-to-char" {
		t.Errorf("op-to-char = %+v", otc)
	}
	fc := p.Patterns["find-char"]
	if fc.Seen != 2 || fc.Runs != 2 || fc.LastSeen != 5 || fc.FixedStreak != 1 || fc.FirstSeenLesson != "words" {
		t.Errorf("find-char = %+v", fc)
	}
	if len(p.KeyMix) != 5 || p.KeyMix[0].At != 1 || p.KeyMix[4].At != 6 || p.KeyMix[0].Moving != 10 {
		t.Errorf("keyMix = %+v", p.KeyMix)
	}
	if len(p.Recent) != 5 || p.Recent[0].At != 2 || strings.Join(p.Recent[3].Patterns, ",") != "find-char" || len(p.Recent[4].Patterns) != 0 {
		t.Errorf("recent = %+v", p.Recent)
	}

	// Key mix keeps the last 20 runs; an empty history is empty arrays, not null.
	var many []CoachRun
	for i := range 30 {
		many = append(many, cr(int64(i), "words", mix))
	}
	if p := BuildProfile(many); len(p.KeyMix) != KeyMixRuns || p.KeyMix[0].At != 10 {
		t.Errorf("keyMix window = %d from %d", len(p.KeyMix), p.KeyMix[0].At)
	}
	e := BuildProfile(nil)
	if e.Patterns == nil || e.KeyMix == nil || e.Recent == nil {
		t.Errorf("empty profile has nils: %+v", e)
	}
}

func TestCoachStorage(t *testing.T) {
	st, err := Open(t.Context(), t.TempDir()+"/t.db")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	alice, _ := st.UpsertUser(t.Context(), User{GitHubID: 1, Login: "alice"}, testTime())
	bob, _ := st.UpsertUser(t.Context(), User{GitHubID: 2, Login: "bob"}, testTime())
	mix := &KeyMix{Moving: 7, Typing: 1, Editing: 2}
	r1 := Run{Lesson: "words", At: 1000, Score: 1, Mix: mix, Coach: []CoachEvent{goodEvent(1000), goodEvent(1000)}}
	r2 := Run{Lesson: "words", At: 2000, Score: 1, Mix: mix}
	plain := Run{Lesson: "words", At: 3000, Score: 1} // not coached: no mix, no events
	if err := st.AddRuns(t.Context(), alice.ID, []Run{r1, r2, plain}); err != nil {
		t.Fatal(err)
	}
	// A resend of the same run (same lesson, at) does not duplicate its events.
	if err := st.AddRuns(t.Context(), alice.ID, []Run{r1}); err != nil {
		t.Fatal(err)
	}
	if err := st.AddRuns(t.Context(), bob.ID, []Run{{Lesson: "words", At: 1000, Mix: mix, Coach: []CoachEvent{goodEvent(1000)}}}); err != nil {
		t.Fatal(err)
	}
	p, err := st.CoachProfile(t.Context(), alice.ID)
	if err != nil {
		t.Fatal(err)
	}
	s := p.Patterns["op-to-char"]
	if s.Seen != 2 || s.Runs != 1 || s.FixedStreak != 1 || s.LastSeen != 1000 {
		t.Errorf("alice op-to-char = %+v", s)
	}
	if len(p.KeyMix) != 2 || len(p.Recent) != 2 {
		t.Errorf("alice keyMix %d recent %d, want 2 and 2 (the uncoached run is not in either)", len(p.KeyMix), len(p.Recent))
	}
	// Runs without coach data still read back without it.
	runs, _ := st.Runs(t.Context(), alice.ID)
	if len(runs) != 3 || runs[0].Coach != nil || runs[0].Mix != nil {
		t.Errorf("runs read back with coach data: %+v", runs)
	}
	// Pruned runs take their events with them.
	var n int
	if _, err := st.db.ExecContext(t.Context(), `DELETE FROM runs WHERE user_id = ? AND at = 1000`, alice.ID); err != nil {
		t.Fatal(err)
	}
	st.db.QueryRowContext(t.Context(), `SELECT count(*) FROM coach_events e JOIN runs r ON r.id = e.run_id WHERE r.user_id = ?`, alice.ID).Scan(&n)
	var orphans int
	st.db.QueryRowContext(t.Context(), `SELECT count(*) FROM coach_events WHERE run_id NOT IN (SELECT id FROM runs)`).Scan(&orphans)
	if n != 0 || orphans != 0 {
		t.Errorf("after delete: alice events %d, orphans %d", n, orphans)
	}
}
