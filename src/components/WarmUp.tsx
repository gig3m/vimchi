import { useMemo, useState } from 'react';
import { REPS_LESSONS } from '../warmup/select';
import { WARMUP_ID, type WarmUpPlan, warmUpChallenge } from '../warmup';
import type { Lesson } from '../lessons/types';
import { fmtS } from '../state/format';
import { newSeed, warmUpHref } from '../state/seed';
import type { Run } from '../state/store';
import { Bars } from './Bars';
import { Practice } from './Practice';

type Props = {
  plan: WarmUpPlan;
  /** From `#warm-up?seed=N`; null = a fresh seed for this visit. */
  seed: number | null;
  coachLive: boolean;
  /** Earlier Warm-up runs. */
  runs: Run[];
  isGuest: boolean;
  onRun: (run: Run) => void;
  onGo: (id: string) => void;
  /** Leave the Warm-up for the lesson the learner was on. */
  onBack: () => void;
  onStats: () => void;
};

const agoText = (days: number) => {
  const d = Math.round(days);
  return d <= 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`;
};

export function WarmUp({ plan, seed: urlSeed, coachLive, runs, isGuest, onRun, onGo, onBack, onStats }: Props) {
  const [fresh] = useState(newSeed);
  const seed = urlSeed ?? fresh;
  const [finished, setFinished] = useState(false);
  const ids = plan.picks.map(p => p.lesson.id).join(',');
  // A stand-in lesson so Practice plays the Warm-up like any generated challenge; its id is the run id.
  const lesson = useMemo<Lesson | null>(() => {
    if (!plan.picks.length) return null;
    const challenge = warmUpChallenge(plan.picks, seed);
    const base = REPS_LESSONS[0];
    return { ...base, id: WARMUP_ID, title: 'Warm-up', chips: [], keyCards: [], boss: false, reps: undefined, challenge };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, seed]);
  const again = () => { setFinished(false); location.hash = warmUpHref(newSeed()); };
  const done = (run: Run) => { setFinished(true); onRun(run); };

  return (
    <>
      <div className="eyebrow">Review · spaced</div>
      <h1 className="h1">Warm-up</h1>
      <p>
        One file, a mix of edits from lessons you finished a while ago: about 1, 3, 7 and 21 days back,
        with the ones you found slow or keyed long turning up more often. A few minutes here keeps the
        keys in your fingers.
      </p>

      {!lesson ? (
        <div className="wu-empty">
          <p>Nothing to review yet. Finish a lesson that has <strong>Reps</strong>, then come back tomorrow.</p>
          <div className="wu-lessons">
            {REPS_LESSONS.slice(0, 4).map(l => (
              <button key={l.id} className="wu-lesson" onClick={() => onGo(l.id)}>{l.title}</button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="wu-lessons" aria-label="Lessons in this Warm-up">
            {plan.picks.map(p => (
              <button key={p.lesson.id} className={'wu-lesson' + (p.due ? ' due' : '')} onClick={() => onGo(p.lesson.id)} title={`Open ${p.lesson.title}`}>
                {p.lesson.title}<span className="wu-ago">{agoText(p.ago)}</span>
              </button>
            ))}
          </div>

          <h2 className="h2">Practice</h2>
          <div className="practice-note">
            <p>Work down the checklist in any order; each edit is one a lesson above taught. The goal is shown inline.</p>
          </div>

          <Practice
            lesson={lesson}
            seed={seed}
            reps={null}
            coachLive={coachLive}
            history={runs}
            nextTitle={null}
            onFlash={() => {}}
            onRun={done}
            onNext={() => {}}
            onStats={onStats}
          />
          <div className="practice-foot wu-foot">
            <span className="practice-foot-note">
              {plan.due ? `${plan.due} ${plan.due === 1 ? 'lesson' : 'lessons'} due` : 'Nothing due: your most recent lessons'}
            </span>
            {finished && <button className="link-btn" onClick={again} tabIndex={-1}>Again →</button>}
            <button className="link-btn" onClick={onBack} tabIndex={-1}>← Back to lessons</button>
          </div>

          <div className="record">
            <span className="owner">{isGuest ? 'Guest record' : 'Your record'} · warm-up</span>
            {runs.length ? (
              <>
                <span>Best <span className="best">{Math.max(...runs.map(r => r.score))}</span></span>
                <span>Best time <span className="v">{fmtS(Math.min(...runs.map(r => r.time)))}</span></span>
                <span>Runs <span className="v">{runs.length}</span></span>
                <Bars runs={runs} />
              </>
            ) : (
              <span>No warm-ups yet. Finish one to set a score.</span>
            )}
          </div>
        </>
      )}
    </>
  );
}
