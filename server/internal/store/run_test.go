package store

import (
	"math"
	"strings"
	"testing"
)

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
