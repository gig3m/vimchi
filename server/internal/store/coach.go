package store

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"slices"
)

// Coach memory. Each critique the coach made in a run becomes a CoachEvent:
// the idea it named (pattern), where, and key counts. No keys or buffer text
// are ever stored; Used is one of a few fixed labels for what the learner did.

const (
	// MaxCoachEvents bounds the critiques one run may carry.
	MaxCoachEvents = 10
	// KeyMixRuns is how many recent coached runs the key mix covers.
	KeyMixRuns = 20
	// RecentRuns is how many recent coached runs the profile lists patterns for.
	RecentRuns = 5
	maxUnit    = 1000
)

// CoachEvent is one critique. Its JSON shape is shared with the frontend.
type CoachEvent struct {
	Pattern string `json:"pattern"`
	Lesson  string `json:"lesson"`
	Unit    int64  `json:"unit"`
	You     int64  `json:"you"`    // keys the learner spent
	Better  int64  `json:"better"` // keys the better way takes
	Used    string `json:"used"`   // bucket: see usedBuckets
	At      int64  `json:"at"`     // unix ms
}

// KeyMix is where a run's keys went.
type KeyMix struct {
	Moving  int64 `json:"moving"`
	Typing  int64 `json:"typing"`
	Editing int64 `json:"editing"`
}

var (
	patternRE = regexp.MustCompile(`^[a-z-]{1,32}$`)
	// usedBuckets are the only labels for what the learner did: a run of one
	// key (xxxx, llll), retyped text, a motion run, or other commands.
	usedBuckets = []string{"key-run", "retype", "motions", "commands"}
)

func (e CoachEvent) validate(now int64) error {
	var errs []error
	if !patternRE.MatchString(e.Pattern) {
		errs = append(errs, errors.New("pattern must be 1-32 chars of [a-z-]"))
	}
	if !lessonRE.MatchString(e.Lesson) {
		errs = append(errs, errors.New("lesson must be 1-64 chars of [a-z0-9-]"))
	}
	if e.Unit < 0 || e.Unit > maxUnit || e.You < 0 || e.You > maxKeys || e.Better < 0 || e.Better > maxKeys {
		errs = append(errs, errors.New("counts out of range"))
	}
	if !slices.Contains(usedBuckets, e.Used) {
		errs = append(errs, errors.New("used is not a known bucket"))
	}
	if e.At < minAt || e.At > now+24*60*60*1000 {
		errs = append(errs, errors.New("at out of range"))
	}
	return errors.Join(errs...)
}

func (r Run) validateCoach(now int64) error {
	var errs []error
	if len(r.Coach) > MaxCoachEvents {
		errs = append(errs, fmt.Errorf("coach: at most %d events per run", MaxCoachEvents))
	}
	for i, e := range r.Coach {
		if err := e.validate(now); err != nil {
			errs = append(errs, fmt.Errorf("coach[%d]: %w", i, err))
		}
	}
	if m := r.Mix; m != nil && (m.Moving < 0 || m.Typing < 0 || m.Editing < 0 || m.Moving > maxKeys || m.Typing > maxKeys || m.Editing > maxKeys) {
		errs = append(errs, errors.New("mix counts out of range"))
	}
	return errors.Join(errs...)
}

// PatternStat is what the coach remembers about one pattern.
type PatternStat struct {
	Seen            int    `json:"seen"`        // critiques naming it
	Runs            int    `json:"runs"`        // runs with at least one
	LastSeen        int64  `json:"lastSeen"`    // unix ms
	FixedStreak     int    `json:"fixedStreak"` // coached runs since it was last seen
	FirstSeenLesson string `json:"firstSeenLesson"`
}

// MixPoint is one coached run's key mix.
type MixPoint struct {
	At     int64  `json:"at"`
	Lesson string `json:"lesson"`
	KeyMix
}

// RecentRun lists the patterns one recent coached run was critiqued for.
type RecentRun struct {
	At       int64    `json:"at"`
	Patterns []string `json:"patterns"`
}

// CoachProfile is derived on read from the coached runs, oldest first.
type CoachProfile struct {
	Patterns map[string]PatternStat `json:"patterns"`
	KeyMix   []MixPoint             `json:"keyMix"` // last KeyMixRuns, oldest first
	Recent   []RecentRun            `json:"recent"` // last RecentRuns, oldest first
}

// CoachRun is a coached run as the profile sees it.
type CoachRun struct {
	Lesson string
	At     int64
	Mix    *KeyMix
	Events []CoachEvent
}

// BuildProfile folds coached runs (oldest first) into a profile. The frontend
// mirrors this step for guests (src/state/coach.ts stepProfile).
func BuildProfile(runs []CoachRun) CoachProfile {
	p := CoachProfile{Patterns: map[string]PatternStat{}, KeyMix: []MixPoint{}, Recent: []RecentRun{}}
	for _, r := range runs {
		p.step(r)
	}
	return p
}

func (p *CoachProfile) step(r CoachRun) {
	count := map[string]int{}
	first := map[string]string{}
	var order []string
	for _, e := range r.Events {
		if count[e.Pattern] == 0 {
			order = append(order, e.Pattern)
			first[e.Pattern] = e.Lesson
		}
		count[e.Pattern]++
	}
	for id, s := range p.Patterns {
		if count[id] == 0 {
			s.FixedStreak++
			p.Patterns[id] = s
		}
	}
	for _, id := range order {
		s, ok := p.Patterns[id]
		if !ok {
			s.FirstSeenLesson = first[id]
		}
		s.Seen += count[id]
		s.Runs++
		s.LastSeen = max(s.LastSeen, r.At)
		s.FixedStreak = 0
		p.Patterns[id] = s
	}
	if r.Mix != nil {
		p.KeyMix = append(p.KeyMix, MixPoint{At: r.At, Lesson: r.Lesson, KeyMix: *r.Mix})
		if len(p.KeyMix) > KeyMixRuns {
			p.KeyMix = p.KeyMix[len(p.KeyMix)-KeyMixRuns:]
		}
	}
	if order == nil {
		order = []string{}
	}
	p.Recent = append(p.Recent, RecentRun{At: r.At, Patterns: order})
	if len(p.Recent) > RecentRuns {
		p.Recent = p.Recent[len(p.Recent)-RecentRuns:]
	}
}

// CoachProfile derives a user's coach profile from their coached runs: those
// with a key mix or at least one event.
func (s *Store) CoachProfile(ctx context.Context, userID int64) (CoachProfile, error) {
	rows, err := s.db.QueryContext(ctx, `
SELECT r.id, r.lesson, r.at, r.moving, r.typing, r.editing,
       e.pattern, e.lesson, e.unit, e.you, e.better, e.used, e.at
FROM runs r LEFT JOIN coach_events e ON e.run_id = r.id
WHERE r.user_id = ? AND (r.moving IS NOT NULL OR e.id IS NOT NULL)
ORDER BY r.at, r.id, e.id`, userID)
	if err != nil {
		return CoachProfile{}, err
	}
	defer rows.Close()
	var runs []CoachRun
	lastID := int64(-1)
	for rows.Next() {
		var id int64
		var r CoachRun
		var moving, typing, editing *int64
		var pat, les, used *string
		var unit, you, better, at *int64
		if err := rows.Scan(&id, &r.Lesson, &r.At, &moving, &typing, &editing, &pat, &les, &unit, &you, &better, &used, &at); err != nil {
			return CoachProfile{}, err
		}
		if id != lastID {
			lastID = id
			if moving != nil && typing != nil && editing != nil {
				r.Mix = &KeyMix{Moving: *moving, Typing: *typing, Editing: *editing}
			}
			runs = append(runs, r)
		}
		if pat != nil {
			cur := &runs[len(runs)-1]
			cur.Events = append(cur.Events, CoachEvent{Pattern: *pat, Lesson: *les, Unit: *unit, You: *you, Better: *better, Used: *used, At: *at})
		}
	}
	if err := rows.Err(); err != nil {
		return CoachProfile{}, err
	}
	return BuildProfile(runs), nil
}
