import type { Result } from '../lessons/runtime';
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

export function Results({ result: R, prevBestTime, prevBestScore, nextTitle, onRepeat, onNext, onStats, seed, replayHref, onNewSeed }: Props) {
  const newBestTime = prevBestTime != null && R.elapsed < prevBestTime;
  const newBestScore = prevBestScore != null && R.score > prevBestScore;
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
            {prevBestTime == null ? 'First run' : newBestTime ? 'New personal best' : `+${fmtS(R.elapsed - prevBestTime)} off your best`}
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
      <div className="res-actions">
        <button className="res-btn" onClick={onRepeat}><span className="kbd kbd-sm">r</span>Repeat</button>
        {nextTitle && (
          <button className="res-btn" onClick={onNext}><span className="kbd kbd-sm">n</span>Next: {nextTitle}</button>
        )}
        <button className="res-btn" onClick={onStats}><span className="kbd kbd-sm">s</span>Your stats</button>
        {onNewSeed && <button className="res-btn" onClick={onNewSeed}><span className="kbd kbd-sm">f</span>New file</button>}
      </div>
      {seed != null && (
        <div className="result-seed">
          <span>seed {seed}</span>
          {replayHref && <a href={replayHref}>link to this file</a>}
        </div>
      )}
    </div>
  );
}
