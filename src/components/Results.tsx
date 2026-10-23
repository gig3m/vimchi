import { type Report, gain } from '../coach';
import type { Result } from '../lessons/runtime';
import { BetterWays } from './BetterWays';
import { Kbd } from './Kbd';
import { PATTERNS } from '../coach/patterns';
import { LESSONS } from '../lessons';
import { fmtS } from '../state/format';

type Props = {
  result: Result;
  prevBestTime: number | null;
  prevBestScore: number | null;
  nextTitle: string | null;
  onRepeat: () => void;
  onNext: () => void;
  onStats: () => void;
  /** Generated challenges: the seed that produced this file. */
  seed?: number | null;
  replayHref?: string;
  onNewSeed?: () => void;
  /** The coach's report for this run, when the lesson is coachable. */
  report?: Report;
  /** Coach memory: "You've missed this 3 runs in a row." per pattern that keeps coming back. */
  callouts?: Record<string, string>;
  unitLabel?: (u: number) => string;
  /** Reps mode: "Again" is a fresh seed, "Back to lesson" leaves Reps. */
  reps?: { onAgain: () => void; onBack: () => void };
  /** The lesson has Reps: offer them after its authored practice. */
  onReps?: () => void;
};

const CIRC = 314.16; // 2πr for r = 50

function Ring({ label, value, color, sub }: { label: string; value: number; color: string; sub: string }) {
  return (
    <div className="ring">
      <div className="ring-dial">
        <svg width="120" height="120" aria-hidden="true">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#343746" />
          <circle
            cx="60" cy="60" r="50" fill="none" stroke={color} strokeLinecap="round"
            style={{ strokeDasharray: `${(value * CIRC).toFixed(1)} ${CIRC}` }}
          />
        </svg>
        <div className="ring-pct">{Math.round(value * 100)}%</div>
      </div>
      <div className="ring-label">{label}</div>
      <div className="ring-sub">{sub}</div>
    </div>
  );
}

export function Results({ result: R, prevBestTime, prevBestScore, nextTitle, onRepeat, onNext, onStats, seed, replayHref, onNewSeed, report, callouts, unitLabel, reps, onReps }: Props) {
  const newBestTime = prevBestTime != null && R.elapsed < prevBestTime;
  const newBestScore = prevBestScore != null && R.score > prevBestScore;
  const label = unitLabel ?? ((u: number) => `Round ${u + 1}`);
  return (
    <div className="results">
      <div className="res-grid">
        <div>
          <div className="res-label">Your time</div>
          <div className="res-big">{fmtS(R.elapsed)}</div>
          <div className="res-note">Par {fmtS(R.parTime)}</div>
        </div>
        <div>
          <div className="res-label">Personal best</div>
          <div className="res-big">{fmtS(prevBestTime == null ? R.elapsed : Math.min(prevBestTime, R.elapsed))}</div>
          <div className={'res-note' + (newBestTime ? ' good' : '')}>
            {prevBestTime == null ? 'First run' : newBestTime ? 'New personal best' : `${fmtS(R.elapsed - prevBestTime)} behind your best`}
          </div>
        </div>
        <div>
          <div className="res-label">Score</div>
          <div className="res-big accent">{R.score}</div>
          <div className={'res-note' + (newBestScore ? ' good' : '')}>
            {prevBestScore == null ? 'First score' : newBestScore ? 'New high score' : `High score ${prevBestScore}`}
          </div>
        </div>
      </div>
      <div className="rings">
        <Ring label="Speed" value={R.speed} color="#ff79c6" sub={`vs par ${fmtS(R.parTime)}`} />
        <Ring label="Accuracy" value={R.acc} color="#50fa7b" sub={`${R.keys} keys, par ${R.parKeys}`} />
        <Ring label={R.correctLabel} value={R.correct} color="#f1fa8c" sub={R.correctText} />
      </div>
      {report && callouts && <Recurring report={report} callouts={callouts} unitLabel={label} />}
      {report && <BetterWays report={report} unitLabel={label} />}
      {reps ? (
        <div className="res-actions">
          <button className="res-btn primary" onClick={reps.onAgain}><span className="kbd kbd-sm">a</span>Again</button>
          <button className="res-btn" onClick={onRepeat}><span className="kbd kbd-sm">r</span>Same file</button>
          <button className="res-btn" onClick={reps.onBack}><span className="kbd kbd-sm">b</span>Back to lesson</button>
          <button className="res-btn" onClick={onStats}><span className="kbd kbd-sm">s</span>Your stats</button>
        </div>
      ) : (
      <div className="res-actions">
        <button className="res-btn" onClick={onRepeat}><span className="kbd kbd-sm">r</span>Repeat</button>
        {onReps && <button className="res-btn" onClick={onReps} title="10–15 generated edits of this lesson's keys on a real file"><span className="kbd kbd-sm">p</span>Reps</button>}
        {nextTitle && (
          <button className="res-btn" onClick={onNext}><span className="kbd kbd-sm">n</span>Next: {nextTitle}</button>
        )}
        <button className="res-btn" onClick={onStats}><span className="kbd kbd-sm">s</span>Your stats</button>
        {onNewSeed && <button className="res-btn" onClick={onNewSeed}><span className="kbd kbd-sm">f</span>New file</button>}
      </div>
      )}
      {seed != null && (
        <div className="result-seed">
          <span>seed {seed}</span>
          {replayHref && <a href={replayHref}>{reps ? 'link to these reps' : 'link to this file'}</a>}
        </div>
      )}
    </div>
  );
}

/** Patterns the coach has flagged in several recent runs, first critique of each, in whole sentences:
 * "Edit up to a character. You've missed this in 3 of your last 5 runs. In round 5, ct)… does that in
 * 6 keys instead of 14." then why, and the lesson that teaches it. */
function Recurring({ report, callouts, unitLabel }: { report: Report; callouts: Record<string, string>; unitLabel: (u: number) => string }) {
  const seen = new Set<string>();
  const rows = report.critiques.filter(c => {
    const id = c.better[0]?.pattern;
    if (!id || !callouts[id] || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (!rows.length) return null;
  return (
    <ul className="cp-recur" aria-label="habits that keep coming up">
      {rows.map(c => {
        const b = c.better[0];
        const p = PATTERNS[b.pattern];
        const lesson = p && LESSONS[p.lesson];
        return (
          <li key={b.pattern}>
            <strong className="cp-recur-name">{p?.name ?? b.pattern}.</strong>{' '}
            <span className="cp-recur-when">{callouts[b.pattern]}</span>{' '}
            In {unitLabel(c.unit).toLowerCase()},{' '}
            <span className="cp-keys">{b.chips.map((ch, i) => (ch.kind === 'text' ? <span key={i} className="cp-text">{ch.v}</span> : <Kbd key={i} k={ch.v} small />))}</span>{' '}
            does that {gain(c.keys, c.keys - b.saves)}.
            {p && <span className="cp-recur-why">{p.principle}{lesson && <> <a className="bw-review" href={`#${lesson.id}`}>Practice it in {lesson.title} →</a></>}</span>}
          </li>
        );
      })}
    </ul>
  );
}
