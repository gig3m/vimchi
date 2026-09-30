import { useEffect, useMemo, useRef, useState } from 'react';
import { nextOf, numberOf, sectionOf } from '../lessons';
import { Session } from '../lessons/runtime';
import type { Lesson } from '../lessons/types';
import { fmtS } from '../state/format';
import type { Run } from '../state/store';
import { Bars } from './Bars';
import { Practice } from './Practice';

type Props = {
  lesson: Lesson;
  /** Generated challenges: replay this seed (from the URL); null = fresh. */
  seed: number | null;
  coachLive: boolean;
  runs: Run[];
  isGuest: boolean;
  onRun: (run: Run) => void;
  onGo: (id: string) => void;
  onStats: () => void;
};

export function LessonPage({ lesson, seed, coachLive, runs, isGuest, onRun, onGo, onStats }: Props) {
  const [flash, setFlash] = useState<string | null>(null);
  const flashT = useRef<number>(undefined);
  useEffect(() => () => clearTimeout(flashT.current), []);
  const onFlash = (k: string) => {
    setFlash(k);
    clearTimeout(flashT.current);
    flashT.current = window.setTimeout(() => setFlash(null), 160);
  };

  const next = nextOf(lesson.id);
  const total = useMemo(() => new Session(lesson.challenge).total, [lesson]);

  return (
    <>
      <div className="eyebrow">{sectionOf(lesson.id).title} · {lesson.boss ? 'Boss' : numberOf(lesson.id)}</div>
      <h1 className="h1">{lesson.title}</h1>
      {lesson.intro}
      <div className="cards">
        {lesson.keyCards.map(k => (
          <div key={k.key} className={'card' + (lesson.narrowCards ? ' narrow' : '')}>
            <div className={'cap' + (flashes(k.key, flash) ? ' flash' : '')}>
              <span className="cap-key">{k.key}</span>
              <span className="cap-glyph" style={k.glyphColor ? { color: k.glyphColor } : undefined}>{k.glyph}</span>
            </div>
            <div className="card-label">
              {k.label}
              {k.sub && <div className="card-sub">{k.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      <h2 className="h2">Practice</h2>
      <div className="practice-note">{lesson.practice(total)}</div>

      <Practice
        lesson={lesson}
        seed={seed}
        coachLive={coachLive}
        history={runs}
        nextTitle={next?.title ?? null}
        onFlash={onFlash}
        onRun={onRun}
        onNext={() => next && onGo(next.id)}
        onStats={onStats}
      />

      <div className="record">
        <span className="owner">{isGuest ? 'Guest record' : 'Your record'}</span>
        {runs.length ? (
          <>
            <span>Best <span className="best">{Math.max(...runs.map(r => r.score))}</span></span>
            <span>Best time <span className="v">{fmtS(Math.min(...runs.map(r => r.time)))}</span></span>
            <span>Runs <span className="v">{runs.length}</span></span>
            <Bars runs={runs} />
          </>
        ) : (
          <span>No runs yet. Finish the challenge to set a score.</span>
        )}
      </div>

      <h3 className="h3"><span className="hash">#</span> {lesson.aside.title}</h3>
      {lesson.aside.body}
    </>
  );
}

/** Does a key card light up for this key press? */
function flashes(card: string, key: string | null) {
  if (!key) return false;
  const k = key === '<Esc>' ? 'esc' : key === '<CR>' ? 'enter' : key.replace(/^<(.*)>$/, '$1');
  const c = card.replace(/\s+/g, '');
  return c === k || (k.length === 1 && c.length > 1 && c.length <= 3 && c.startsWith(k) && !c.includes('-'));
}
