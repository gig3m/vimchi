package store

import (
	"errors"
	"fmt"
	"math"
	"regexp"
)

// Run is one completed lesson attempt. Its JSON shape is shared with the
// frontend.
type Run struct {
	Lesson  string  `json:"lesson"`
	At      int64   `json:"at"`   // unix ms
	Time    int64   `json:"time"` // ms
	Keys    int64   `json:"keys"`
	Speed   float64 `json:"speed"`
	Acc     float64 `json:"acc"`
	Correct float64 `json:"correct"`
	Score   int64   `json:"score"`
}

var lessonRE = regexp.MustCompile(`^[a-z0-9-]{1,64}$`)

const (
	minAt   = 1_577_836_800_000 // 2020-01-01T00:00:00Z
	maxTime = 24 * 60 * 60 * 1000
	maxKeys = 1_000_000
)

// Validate reports whether the run is plausible. now is unix ms; runs dated
// more than a day ahead of it are rejected to tolerate client clock skew.
func (r Run) Validate(now int64) error {
	var errs []error
	if !lessonRE.MatchString(r.Lesson) {
		errs = append(errs, errors.New("lesson must be 1-64 chars of [a-z0-9-]"))
	}
	if r.At < minAt || r.At > now+24*60*60*1000 {
		errs = append(errs, errors.New("at out of range"))
	}
	if r.Time < 0 || r.Time > maxTime {
		errs = append(errs, errors.New("time out of range"))
	}
	if r.Keys < 0 || r.Keys > maxKeys {
		errs = append(errs, errors.New("keys out of range"))
	}
	for _, f := range []struct {
		name string
		v    float64
	}{{"speed", r.Speed}, {"acc", r.Acc}, {"correct", r.Correct}} {
		if math.IsNaN(f.v) || f.v < 0 || f.v > 1 {
			errs = append(errs, fmt.Errorf("%s must be within 0..1", f.name))
		}
	}
	if r.Score < 0 || r.Score > 100 {
		errs = append(errs, errors.New("score must be within 0..100"))
	}
	return errors.Join(errs...)
}
