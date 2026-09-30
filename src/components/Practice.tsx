import { useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import { diffGoal } from '../lessons/goalDiff';
import { Session } from '../lessons/runtime';
import type { Lesson } from '../lessons/types';
import { fmtClock } from '../state/format';
import type { Run } from '../state/store';
import { C, colorize } from '../ui/syntax';
import { keyFromEvent } from '../vim/keys';
import { EditorView } from './EditorView';
import { Checklist } from './Checklist';
import { Results } from './Results';
import { seedHref } from '../state/seed';
import { type Critique, type Report, coach, coachSegment, nudgeText } from '../coach';
import { closedSegments } from '../coach/live';
import { segment } from '../coach/segment';
import { coachable } from '../coach/vocab';

type Props = {
  lesson: Lesson;
  /** Generated challenges: replay this seed (from the URL); null = fresh. */
  seed: number | null;
  /** Show a coach hint under the editor as segments close. */
  coachLive: boolean;
  /** Earlier runs of this lesson, for personal-best comparisons. */
  history: Run[];
  nextTitle: string | null;
  onFlash: (key: string) => void;
  onRun: (run: Run) => void;
  onNext: () => void;
  onStats: () => void;
};

type Finished = { result: ReturnType<Session['result']>; prevBestTime: number | null; prevBestScore: number | null; report?: Report };

/** Browser-reserved Ctrl keys get an Alt stand-in outside fullscreen. */
const STAND_INS: Record<string, string> = { '<A-w>': '<C-w>', '<A-n>': '<C-n>', '<A-t>': '<C-t>', '<A-q>': '<C-q>' };

export function Practice(p: Props) {
  const { lesson } = p;
  const session = useRef<Session>(null as unknown as Session);
  const seedRef = useRef<number | null>(p.seed);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [finished, setFinished] = useState<Finished | null>(null);
  // The component stays mounted across lessons (a remount would drop full screen), so a
  // lesson change resets the per-lesson state here instead of via a React key.
  const lessonRef = useRef(lesson.id);
  if (lessonRef.current !== lesson.id) {
    lessonRef.current = lesson.id;
    seedRef.current = p.seed;
    session.current = null as unknown as Session;
    if (finished) setFinished(null);
  }
  if (!session.current || session.current.challenge !== lesson.challenge) session.current = new Session(lesson.challenge, { seed: seedRef.current ?? undefined });
  const s = session.current;
  const [focused, setFocused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const advanceT = useRef<number>(undefined);

  const v = s.view();

  useEffect(() => {
    if (!v.startAt || v.done) return;
    const t = setInterval(rerender, 100);
    return () => clearInterval(t);
  }, [v.startAt, v.done]);

  useEffect(() => {
    clearTimeout(advanceT.current); // a round tick from the previous lesson must not advance this one
    clearNudge(); segCount.current = 0; nudgedEnd.current = -1; nudgedUnit.current = -1;
    ref.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      clearTimeout(advanceT.current);
    };
  }, []);

  const unitLabel = (u: number) => (lesson.challenge.kind === 'generated' ? `Edit ${u + 1}` : `Round ${u + 1}`);

  // Live nudge: one line under the editor when a just-closed segment has a better way.
  const [nudge, setNudge] = useState<string | null>(null);
  const nudgeT = useRef<number>(undefined);
  const segCount = useRef(0);
  const clearNudge = () => { clearTimeout(nudgeT.current); setNudge(null); };
  const showNudge = (c: Critique) => {
    const b = c.better[0];
    void b;
    clearTimeout(nudgeT.current);
    setNudge(nudgeText(c));
    nudgeT.current = window.setTimeout(() => setNudge(null), 4000);
  };
  /** After a key (or a round/run end), critique a segment that has closed: at most one hint per round. */
  const nudgedEnd = useRef(-1);
  const nudgedUnit = useRef(-1);
  const liveCoach = (closing: boolean) => {
    if (!p.coachLive || !coachable(lesson.id)) return;
    const log = s.log();
    const segs = segment(log);
    segCount.current = segs.length;
    if (!segs.length) return;
    const unitStart = s.currentUnitStart();
    const unit = log[log.length - 1].unit;
    if (unit === nudgedUnit.current) return;
    // Newest closed segment first; never a run still being typed, never one already critiqued.
    for (const i of closedSegments(segs, log, closing).reverse()) {
      if (segs[i].logStart < unitStart || segs[i].logEnd <= nudgedEnd.current) continue;
      const c = coachSegment(s, lesson.id, segs[i], segs, i);
      if (!c) continue;
      nudgedEnd.current = c.logEnd;
      nudgedUnit.current = unit;
      showNudge(c);
      return;
    }
  };

  /** Repeat: the same seed for a generated challenge, so a replay races the same file. */
  const restart = () => {
    session.current = new Session(lesson.challenge, { seed: s.view().seed ?? undefined });
    setFinished(null);
    clearNudge(); segCount.current = 0; nudgedEnd.current = -1; nudgedUnit.current = -1;
    rerender();
    ref.current?.focus({ preventScroll: true });
  };
  /** New file: a fresh seed; the URL drops the old one so a reload does not bring it back. */
  const newFile = () => {
    seedRef.current = null;
    session.current = new Session(lesson.challenge);
    setFinished(null);
    clearNudge(); segCount.current = 0; nudgedEnd.current = -1; nudgedUnit.current = -1;
    if (location.hash.includes('?')) history.replaceState(null, '', '#' + lesson.id);
    rerender();
    ref.current?.focus({ preventScroll: true });
  };
  // A seed arriving by URL while this lesson is open (pasted link, back/forward, the results
  // screen's own "link to this file") loads that file.
  useEffect(() => {
    if (p.seed == null || p.seed === session.current.view().seed) return;
    seedRef.current = p.seed;
    session.current = new Session(lesson.challenge, { seed: p.seed });
    setFinished(null);
    rerender();
    ref.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.seed]);

  const complete = (now: number) => {
    const result = s.result();
    const times = p.history.map(r => r.time), scores = p.history.map(r => r.score);
    setFinished({
      result,
      prevBestTime: times.length ? Math.min(...times) : null,
      prevBestScore: scores.length ? Math.max(...scores) : null,
      report: coachable(lesson.id) ? coach(s, lesson.id) : undefined,
    });
    p.onRun({
      lesson: lesson.id, at: now, time: result.elapsed, keys: result.keys,
      speed: result.speed, acc: result.acc, correct: result.correct, score: result.score,
    });
  };

  const handle = (key: string) => {
    if (s.done) {
      if (key === '<CR>' || key === 'r') restart();
      else if (key === 'f' && s.view().seed != null) newFile();
      else if (key === 'n' && p.nextTitle) p.onNext();
      else if (key === 's') p.onStats();
      return;
    }
    const now = Date.now();
    const wasDone = s.done;
    clearTimeout(advanceT.current);
    const flash = s.key(key, now);
    if (flash) p.onFlash(flash);
    liveCoach(s.roundDone || s.done);
    // The round's closing hint stays through the advance (it names keys, not text); the 4 s timer clears it.
    if (s.roundDone) advanceT.current = window.setTimeout(() => { s.advance(); segCount.current = segment(s.log()).length; rerender(); }, 450);
    if (s.done && !wasDone) { complete(now); clearNudge(); }
    rerender();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    let key = keyFromEvent(e.nativeEvent);
    if (!key) return;
    if (STAND_INS[key]) key = STAND_INS[key];
    const vim = s.vim;
    const wantsTab = vim && (vim.mode === 'insert' || vim.mode === 'cmdline' || vim.modal);
    if ((key === '<Tab>' || key === '<S-Tab>') && !wantsTab && !s.done && s.challenge.kind !== 'quiz') return;
    e.preventDefault();
    e.stopPropagation();
    handle(key);
  };

  const toggleFullscreen = async () => {
    const el = frame.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await el.requestFullscreen?.();
    // Escape is in the lock so it reaches Vim instead of leaving full screen (Chromium: hold
    // Esc to leave). Browsers without keyboard lock exit on Esc; Ctrl-[ is the fallback.
    const kb = (navigator as Navigator & { keyboard?: { lock?: (keys: string[]) => Promise<void> } }).keyboard;
    await kb?.lock?.(['Escape', 'KeyW', 'KeyN', 'KeyT', 'KeyQ', 'Digit6']).catch(() => {});
    ref.current?.focus({ preventScroll: true });
  };

  // Show the goal inline where the diff is small; fall back to the pane below.
  const forced = s.challenge.kind === 'rounds' ? s.challenge.showGoal : s.challenge.kind === 'generated' ? 'inline' : undefined;
  const goalView = v.goalText && s.vim ? diffGoal(s.vim.buf.lines, v.goalText, { force: forced === 'inline' }) : { mode: 'none' as const };
  const inline = goalView.mode === 'inline' && forced !== 'pane' && s.vim?.tab.windows().length === 1 ? goalView.ann : null;
  const showPane = !!v.goalText && !inline && goalView.mode !== 'none';
  const overlay = useMemo(() => ({
    ann: inline,
    target: v.target, marks: v.marks, brokenLines: v.brokenLines,
    markKind: s.challenge.kind === 'fix' ? 'fix' as const : s.challenge.kind === 'replace' ? 'replace' as const : null,
  }), [inline, v.target, v.marks, v.brokenLines, s.challenge.kind]);

  const elapsed = v.startAt ? (v.endAt ?? Date.now()) - v.startAt : 0;
  const status = { keys: v.keys, time: fmtClock(elapsed) };
  const fileName = s.vim?.buf.name ?? (s.challenge.kind === 'quiz' ? 'quiz' : '');
  const msg = v.msg || (focused || v.done ? '' : '-- editor not focused --');
  // Tutor notes (not Vim's own messages) go in the command-line row.
  const vimMsg = s.vim?.message?.text.split('\n')[0];
  // A tutor note wins, then Vim's own message; a coach hint never covers either.
  const note = v.msg && v.msg !== vimMsg ? { text: v.msg, kind: v.msgKind } : nudge && !v.done && !vimMsg ? { text: nudge, kind: 'coach' } : null;
  const isQuiz = s.challenge.kind === 'quiz';
  const kind = s.challenge.kind;
  const roundLabel = kind === 'rounds' || kind === 'quiz' ? `${Math.min(v.hits + (v.done ? 0 : 1), v.total)} of ${v.total}` : `${v.hits} / ${v.total}`;

  return (
    <div ref={frame} className={'practice' + (fullscreen ? ' fullscreen' : '')}>
      <div
        ref={ref}
        tabIndex={0}
        className={'editor' + (focused ? ' focused' : '')}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={`${lesson.title} practice editor`}
      >
        <div className="ed-title">
          <span className="dots"><span /><span /><span /></span>
          <span className="ed-file">{fileName}</span>
          <button className="ed-fs" onClick={toggleFullscreen} title="Full screen captures Esc, Ctrl-W, Ctrl-N and Ctrl-T (hold Esc, or use the button, to leave)" tabIndex={-1}>
            {fullscreen ? 'exit full screen' : 'full screen'}
          </button>
          <span>{roundLabel}</span>
        </div>
        <div className="ed-progress">
          <div style={{ width: (v.done ? 100 : Math.round((v.hits / Math.max(1, v.total)) * 100)) + '%' }} />
        </div>

        {!v.done && v.prompt && (
          <div className={'ed-prompt' + (v.roundDone ? ' ok' : '')}>
            <span className="ed-prompt-n">{v.roundDone ? '✓' : `${v.hits + 1}.`}</span>
            {v.prompt}
          </div>
        )}

        {!v.done && isQuiz && v.quiz && <Quiz q={v.quiz} onPick={i => { s.pickOption(i); rerender(); ref.current?.focus(); }} onNext={() => handle(' ')} />}

        {!v.done && !isQuiz && s.vim && (
          <div className={'ed-body' + (v.roundDone ? ' round-ok' : '') + (v.items.length ? ' with-list' : '')}>
            <EditorView vim={s.vim} focused={focused} overlay={overlay} status={status} note={note} />
            {showPane && v.goalText && <GoalPane goal={v.goalText} current={s.vim.buf.lines} filetype={s.vim.buf.filetype} />}
            {v.items.length > 0 && <Checklist items={v.items} />}
          </div>
        )}

        {v.done && finished && (
          <Results
            {...finished}
            nextTitle={p.nextTitle}
            seed={v.seed}
            replayHref={v.seed != null ? seedHref(lesson.id, v.seed) : undefined}
            onNewSeed={v.seed != null ? newFile : undefined}
            unitLabel={unitLabel}
            onRepeat={restart}
            onNext={p.onNext}
            onStats={p.onStats}
          />
        )}

        {(v.done || isQuiz) && (
          <div className="status">
            <span className="mode">{v.done ? 'DONE' : 'QUIZ'}</span>
            <span className="seg">{lesson.title}</span>
            <span className="grow" />
            <span>{v.keys} keys</span>
            <span>{fmtClock(elapsed)}</span>
          </div>
        )}
        {(isQuiz || v.done) && <div className={'cmdline-msg ' + v.msgKind}>{msg}</div>}

        {!focused && !v.done && (
          <div className="focus-hint" onMouseDown={e => { e.preventDefault(); ref.current?.focus({ preventScroll: true }); }}>
            <span>Click to focus the editor</span>
          </div>
        )}
      </div>
    </div>
  );
}

function GoalPane({ goal, current, filetype }: { goal: string[]; current: readonly string[]; filetype: string }) {
  return (
    <div className="goal">
      <div className="goal-label">goal</div>
      {goal.map((t, i) => {
        const same = current[i] === t;
        const cols = colorize(t, filetype);
        return (
          <div key={i} className={'goal-row' + (same ? ' same' : ' diff')}>
            <span className="goal-mark">{same ? ' ' : '›'}</span>
            <span className="goal-text">
              {t.length ? [...t].map((ch, c) => <span key={c} style={{ color: same ? undefined : cols[c] }}>{ch}</span>) : ' '}
            </span>
          </div>
        );
      })}
      {current.length > goal.length && <div className="goal-row diff"><span className="goal-mark">›</span><span className="goal-text" style={{ color: C.red }}>(delete the extra lines)</span></div>}
    </div>
  );
}

type QuizView = NonNullable<ReturnType<Session['view']>['quiz']>;

function Quiz({ q, onPick, onNext }: { q: QuizView; onPick: (i: number) => void; onNext: () => void }) {
  const answered = q.picked != null;
  return (
    <div className="quiz">
      <div className="quiz-q">{q.q.prompt}</div>
      {q.q.code && <pre className="quiz-code">{q.q.code}</pre>}
      <div className="quiz-options">
        {q.q.options.map((o, i) => {
          const state = !answered ? (i === q.sel ? ' sel' : '') : i === q.q.answer ? ' right' : i === q.picked ? ' wrong' : ' dim';
          return (
            <button key={i} className={'quiz-opt' + state} onClick={() => (answered ? onNext() : onPick(i))} tabIndex={-1}>
              <span className="kbd kbd-sm">{i + 1}</span>
              <span className="quiz-opt-text">{o}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={'quiz-explain' + (q.picked === q.q.answer ? ' right' : ' wrong')}>
          <strong>{q.picked === q.q.answer ? 'Right.' : 'Not quite.'}</strong> {q.q.explain}
          <div className="quiz-next">Press any key for the next question.</div>
        </div>
      )}
      {!answered && <div className="quiz-hint">Press 1–{q.q.options.length}, or j / k and Enter.</div>}
    </div>
  );
}
