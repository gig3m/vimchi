package store

import (
	"math"
	"strings"
	"testing"
	"time"
)

func testTime() time.Time { return time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC) }

func TestRunValidate(t *testing.T) {
	const now = int64(1_790_000_000_000)
	good := Run{Lesson: "hjkl-basics", At: now - 1000, Time: 12_345, Keys: 42, Speed: 0.8, Acc: 0.9, Correct: 1, Score: 88}

	tests := []struct {
		name    string
		mut     func(*Run)
		wantErr string // substring; "" means valid
	}{
		{"valid", func(r *Run) {}, ""},
		{"zero values ok", func(r *Run) { r.Time, r.Keys, r.Speed, r.Acc, r.Correct, r.Score = 0, 0, 0, 0, 0, 0 }, ""},
		{"clock skew ok", func(r *Run) { r.At = now + 60_000 }, ""},
		{"empty lesson", func(r *Run) { r.Lesson = "" }, "lesson"},
		{"long lesson", func(r *Run) { r.Lesson = strings.Repeat("a", 65) }, "lesson"},
		{"64-char lesson", func(r *Run) { r.Lesson = strings.Repeat("a", 64) }, ""},
		{"uppercase lesson", func(r *Run) { r.Lesson = "HJKL" }, "lesson"},
		{"slash lesson", func(r *Run) { r.Lesson = "a/b" }, "lesson"},
		{"at zero", func(r *Run) { r.At = 0 }, "at"},
		{"at far future", func(r *Run) { r.At = now + 2*24*60*60*1000 }, "at"},
		{"negative time", func(r *Run) { r.Time = -1 }, "time"},
		{"huge time", func(r *Run) { r.Time = 1 << 40 }, "time"},
		{"negative keys", func(r *Run) { r.Keys = -1 }, "keys"},
		{"speed > 1", func(r *Run) { r.Speed = 1.01 }, "speed"},
		{"acc < 0", func(r *Run) { r.Acc = -0.1 }, "acc"},
		{"correct NaN", func(r *Run) { r.Correct = math.NaN() }, "correct"},
		{"score > 100", func(r *Run) { r.Score = 101 }, "score"},
		{"score < 0", func(r *Run) { r.Score = -1 }, "score"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := good
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

func TestAddRunsKeepsOnlyTheNewest(t *testing.T) {
	st, err := Open(t.Context(), t.TempDir()+"/t.db")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	u, err := st.UpsertUser(t.Context(), User{GitHubID: 1, Login: "alice"}, testTime())
	if err != nil {
		t.Fatal(err)
	}
	runs := make([]Run, 0, MaxRunsPerUser+10)
	for i := 0; i < MaxRunsPerUser+10; i++ {
		runs = append(runs, Run{Lesson: "hjkl", At: int64(1_000_000 + i), Score: 1})
	}
	if err := st.AddRuns(t.Context(), u.ID, runs); err != nil {
		t.Fatal(err)
	}
	got, err := st.Runs(t.Context(), u.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != MaxRunsPerUser {
		t.Fatalf("kept %d runs, want %d", len(got), MaxRunsPerUser)
	}
	if got[0].At != int64(1_000_000+10) {
		t.Fatalf("oldest kept at = %d, want the 10 oldest gone", got[0].At)
	}
}
