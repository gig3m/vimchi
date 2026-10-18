import { useMemo, useState } from 'react';
import { LESSONS } from '../lessons';
import type { Lesson } from '../lessons/types';
import { type Daily as DailyT, dailyGrid, firstRun, loadGrid, saveGrid, shareText } from '../daily';
import { fmtClock } from '../state/format';
import type { Run } from '../state/store';
import { Practice } from './Practice';
import type { Session } from '../lessons/runtime';

type Props = {
  daily: DailyT;
  /** Earlier runs of today's Daily. */
  runs: Run[];
  isGuest: boolean;
  onRun: (run: Run) => void;
  onGo: (id: string) => void;
  onBack: () => void;
  onStats: () => void;
  /** A newer Daily came out while this one was open. */
  newer: number | null;
  onNewer: () => void;
};

export function Daily({ daily: d, runs, isGuest, onRun, onGo, onBack, onStats, newer, onNewer }: Props) {
  // Bumped when this page saves a grid, so the card re-reads it.
  const [saved, setSaved] = useState(0);
  const [copied, setCopied] = useState(false);
  // A stand-in lesson so Practice plays the Daily like any generated challenge; its id is the run id.
  const lesson = useMemo<Lesson>(() => {
    const base = LESSONS[d.rung.id];
    return { ...base, id: d.id, title: `Daily #${d.n}`, chips: [], keyCards: [], boss: false, reps: undefined, challenge: d.rung.challenge };
  }, [d]);
  const first = firstRun(runs);
  const g = d.generated;
  /** The first finish of the day sets the card's grid (keyed by the run's `at`, which is endAt); replays leave it alone. */
  const finish = (s: Session) => {
    if (first || !s.generated || s.endAt == null) return;
    saveGrid(d.n, s.endAt, dailyGrid(s.generated, s.ticks, s.keys));
    setSaved(saved + 1);
  };
  const grid = first ? loadGrid(d.n, first.at) : null;
  const card = first ? shareText(d, first, grid) : null;
  const copy = () => {
    if (!card) return;
    navigator.clipboard?.writeText(card).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {});
  };

  return (
    <>
      <div className="eyebrow">Daily · #{d.n}</div>
      <h1 className="h1">{d.rung.title}</h1>
      <p>
        One file a day, the same for everyone. Fix it in as few keys as you can: par is{' '}
        <strong>{g.parKeys} keys</strong> and <strong>{fmtClock(g.parMs)}</strong>. Your first finish is the score
        you share; after that it is practice. A new file comes at midnight.
      </p>

      {newer != null && (
        <p className="daily-newer">Daily #{newer} is out. <button className="link-btn" onClick={onNewer}>Play it →</button></p>
      )}

      {card && (
        <div className="daily-card" aria-label="Your Daily result">
          <pre className="daily-card-text">{card}</pre>
          <div className="daily-card-actions">
            <button className="res-btn primary" onClick={copy} tabIndex={-1}>{copied ? 'Copied' : 'Copy result'}</button>
            {!grid && <span className="daily-card-note">Finished on another device: the squares stay there.</span>}
          </div>
        </div>
      )}

      <h2 className="h2">Practice</h2>
      <div className="practice-note">
        <p>Work down the checklist in any order. Live hints are off for the Daily; the review after the run shows shorter ways.</p>
      </div>

      <Practice
        lesson={lesson}
        seed={d.seed}
        reps={null}
        coachLive={false}
        history={runs}
        nextTitle={null}
        onFlash={() => {}}
        onRun={onRun}
        onNext={() => {}}
        onStats={onStats}
        coachAs={d.rung.id}
        fixedSeed
        onFinish={finish}
      />
      <div className="practice-foot wu-foot">
        <span className="practice-foot-note">From the ladder: <button className="link-btn" onClick={() => onGo(d.rung.id)} tabIndex={-1}>{d.rung.title}</button></span>
        <button className="link-btn" onClick={onBack} tabIndex={-1}>← Back to lessons</button>
      </div>

      <div className="record">
        <span className="owner">{isGuest ? 'Guest record' : 'Your record'} · daily #{d.n}</span>
        {first ? (
          <>
            <span>First <span className="best">{first.keys} keys</span></span>
            <span>Best <span className="v">{Math.min(...runs.map(r => r.keys))} keys</span></span>
            <span>Runs <span className="v">{runs.length}</span></span>
          </>
        ) : (
          <span>Not played yet today.</span>
        )}
      </div>
    </>
  );
}
