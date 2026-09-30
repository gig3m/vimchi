// Challenge sessions: set up editors, check goals, count keys and score runs.
// No React here so tests and the validator can drive sessions directly.

import { PLUGINS } from '../vim/plugins';
import { Vim } from '../vim/editor';
import { type Generated, collateral, generate, itemDone } from '../challenges/generate';
import type { LastCommand } from '../vim/editor';
import { type Key, parseKeys } from '../vim/keys';
import { align } from './goalDiff';
import { wordBackward, wordEnd, wordForward } from '../vim/motions';
import { type Pos, cmpPos, eqPos, pos } from '../vim/types';
import type { Challenge, Goal, MarksChallenge, QuizChallenge, Round, RoundsChallenge, Setup, TargetChallenge } from './types';

// ---- editor setup --------------------------------------------------------------------------------

export function mergeSetup(base: Setup, over: Setup | undefined): Setup {
  if (!over) return base;
  return {
    ...base,
    ...over,
    files: over.files ?? base.files,
    options: { ...base.options, ...over.options },
    plugins: over.plugins ?? base.plugins,
    registers: { ...base.registers, ...over.registers },
    marks: over.marks ?? base.marks,
  };
}

export function createVim(setup: Setup): Vim {
  const plugins = (setup.plugins ?? []).map(id => {
    const p = PLUGINS[id];
    if (!p) throw new Error(`Unknown plugin "${id}"`);
    return p;
  });
  const text = Array.isArray(setup.text) ? setup.text.join('\n') : setup.text;
  const vim = new Vim({
    files: setup.files,
    open: setup.open,
    text: setup.open ? undefined : text ?? '',
    name: setup.name ?? (setup.open ? undefined : 'scratch.txt'),
    plugins,
  });
  // A buffer given as text still gets a file on disk so :w works.
  if (!setup.open && setup.name && vim.fs.read(setup.name) == null) vim.fs.write(setup.name, (text ?? '') + '\n');
  Object.assign(vim.options, setup.options ?? {});
  for (const [r, v] of Object.entries(setup.registers ?? {})) {
    vim.registers.set(r, typeof v === 'string' ? { text: v, kind: v.endsWith('\n') ? 'line' : 'char' } : v);
  }
  for (const [m, p] of Object.entries(setup.marks ?? {})) {
    if (/[A-Z]/.test(m)) vim.globalMarks.set(m, { buf: vim.buf, pos: p });
    else vim.buf.marks.set(m, p);
  }
  for (const f of setup.folds ?? []) vim.win.folds.push({ start: f.start, end: f.end, closed: f.closed ?? true });
  if (setup.search) {
    vim.search = { pattern: setup.search, dir: 1, offset: '' };
    vim.hlActive = true;
  }
  if (setup.cursor) {
    vim.win.cursor = { ...setup.cursor };
    vim.win.want = setup.cursor.col;
  }
  const rows = setup.height ?? Math.max(6, Math.min(20, vim.buf.lineCount + 1));
  vim.screenRows = rows;
  vim.win.height = rows;
  setup.init?.(vim);
  vim.clampCursor();
  vim.scrollToCursor();
  vim.buf.modified = false;
  return vim;
}

export function goalMet(vim: Vim, g: Goal): boolean {
  if (g.mode !== 'any' && (vim.mode !== 'normal' || vim.pending.length > 0)) return false;
  if (g.buffer != null && vim.buf.name !== g.buffer) return false;
  if (g.text != null) {
    const want = Array.isArray(g.text) ? g.text.join('\n') : g.text;
    if (vim.buf.text() !== want) return false;
  }
  if (g.cursor && !eqPos(vim.cursor, g.cursor)) return false;
  if (g.files) for (const [f, t] of Object.entries(g.files)) if ((vim.fs.read(f) ?? '').replace(/\n$/, '') !== t.replace(/\n$/, '')) return false;
  if (g.registers) for (const [r, t] of Object.entries(g.registers)) if (vim.getRegister(r).text !== t) return false;
  if (g.check && !g.check(vim)) return false;
  return true;
}

export const solutionKeys = (s: string): Key[] => parseKeys(s);

// ---- scoring -------------------------------------------------------------------------------------

export type Result = {
  elapsed: number;
  parTime: number;
  parKeys: number;
  keys: number;
  speed: number;
  acc: number;
  correct: number;
  score: number;
  correctLabel: string;
  correctText: string;
};

function finalize(elapsed: number, parTime: number, parKeys: number, keys: number, correct: number, correctLabel: string, correctText: string): Result {
  const speed = Math.min(1, parTime / Math.max(1, elapsed));
  const acc = Math.min(1, parKeys / Math.max(1, keys));
  return {
    elapsed, parTime, parKeys, keys, speed, acc, correct, correctLabel, correctText,
    score: Math.round(100 * (0.35 * speed + 0.35 * acc + 0.3 * correct)),
  };
}

// ---- session ---------------------------------------------------------------------------------------

export type MsgKind = 'info' | 'warn' | 'error';

export type SessionView = {
  vim: Vim | null;
  target: Pos | null;
  /** Characters to highlight for fix/replace: "line:col" → hint char ('' for fix). */
  marks: Map<string, string>;
  brokenLines: Set<number>;
  goalText: string[] | null;
  prompt: string | null;
  hits: number;
  total: number;
  keys: number;
  startAt: number | null;
  endAt: number | null;
  done: boolean;
  /** Round just completed; the UI shows a tick until advance(). */
  roundDone: boolean;
  msg: string;
  msgKind: MsgKind;
  quiz: { q: QuizChallenge['questions'][number]; index: number; picked: number | null; sel: number } | null;
  /** Generated challenges: the checklist, ticked live. Empty otherwise. */
  items: { text: string; kind: string; done: boolean; line: number }[];
  seed: number | null;
};

/** One fed key, for the coach. */
export type LogEntry = {
  key: Key;
  /** rounds: round index; generated: checklist item index; -1 when unattributed. */
  unit: number;
  /** Position/mode before the key, captured after any advance() the key triggered. */
  before: { pos: Pos; mode: string; want: number };
  after: { pos: Pos; mode: string; changed: boolean; pending: number };
  /** Filled when this key completed a command. */
  command: LastCommand | null;
  /** True on the first key after a hard boundary (round load, :reset, restart). */
  boundary: boolean;
};

const TARGET_EDIT_MSG = 'Editing is off in movement lessons.';
const ROUND_BASE_MS = 1500;
const PER_KEY_MS = 450;

export class Session {
  readonly challenge: Challenge;
  readonly targetCount: number;
  vim: Vim | null = null;
  target: Pos | null = null;
  hits = 0;
  keys = 0;
  startAt: number | null = null;
  endAt: number | null = null;
  done = false;
  roundDone = false;
  msg = '';
  msgKind: MsgKind = 'info';
  version = 0;
  private rand: () => number;

  // target
  private optSum = 0;
  private tDist = 0;
  private tClean = true;
  private clean = 0;
  // marks
  private edits = 0;
  private mistakes = 0;
  // rounds
  roundIdx = 0;
  private roundKeys = 0;
  private roundStats: { keys: number; par: number }[] = [];
  // quiz
  private picked: number | null = null;
  private sel = 0;
  private rightAnswers = 0;

  // generated
  generated: Generated | null = null;
  private collateralMax = 0;
  // coach log
  private entries: LogEntry[] = [];
  private pendingBoundary = true;

  log(): LogEntry[] { return this.entries; }
  /** Log index of the first key of the unit's latest attempt. */
  unitStart(unit: number): number {
    for (let i = this.entries.length - 1; i >= 0; i--) if (this.entries[i].boundary && this.entries[i].unit === unit) return i;
    return 0;
  }
  /** Log index where the current round's attempt began (0 for generated challenges). */
  currentUnitStart(): number { return this.challenge.kind === 'rounds' ? this.unitStart(this.roundIdx) : 0; }
  /** The setup a scratch Vim needs to replay this unit. */
  setupFor(unit: number): Setup {
    const c = this.challenge;
    if (c.kind === 'rounds') return mergeSetup(c.base, c.rounds[unit]?.setup);
    if (c.kind === 'generated') return { text: this.generated!.start, name: this.generated!.file };
    return { text: '' };
  }
  /** Checklist item nearest the cursor (generated challenges), for attributing keys. */
  private nearestItem(): number {
    const line = this.vim!.cursor.line + 1;
    let best = -1, dist = Infinity;
    this.view().items.forEach((it, i) => { const d = Math.abs(it.line - line); if (d < dist) { dist = d; best = i; } });
    return best;
  }

  constructor(challenge: Challenge, opts: { targetCount?: number; rand?: () => number; carryCursor?: boolean; seed?: number } = {}) {
    this.challenge = challenge;
    this.carryCursor = opts.carryCursor ?? true;
    this.targetCount = opts.targetCount ?? (challenge.kind === 'target' || challenge.kind === 'word' ? challenge.count ?? 12 : 0);
    this.rand = opts.rand ?? Math.random;
    if (challenge.kind === 'generated') this.generated = generate(challenge, opts.seed ?? Math.floor(Math.random() * 0x100000000));
    this.start();
  }

  get total(): number {
    const c = this.challenge;
    if (c.kind === 'target' || c.kind === 'word') return this.targetCount;
    if (c.kind === 'fix' || c.kind === 'replace') return marksOf(c.code, c).marks.size;
    if (c.kind === 'rounds') return c.rounds.length;
    if (c.kind === 'generated') return this.generated!.items.length;
    return (c as QuizChallenge).questions.length;
  }

  get round(): Round | null {
    return this.challenge.kind === 'rounds' ? this.challenge.rounds[this.roundIdx] ?? null : null;
  }

  private start() {
    this.pendingBoundary = true;
    const c = this.challenge;
    if (c.kind === 'target' || c.kind === 'word' || c.kind === 'fix' || c.kind === 'replace') {
      this.vim = createVim({ text: c.code, name: c.file, cursor: c.start, height: c.code.length + 1 });
      if (c.kind === 'target' || c.kind === 'word') this.newTarget(c);
    } else if (c.kind === 'rounds') {
      this.loadRound();
    } else if (c.kind === 'generated') {
      const g = this.generated!;
      this.vim = createVim({ text: g.start, name: g.file, height: Math.min(g.start.length + 1, 40) });
      this.installReset();
    }
  }

  private loadRound(carry = false) {
    this.pendingBoundary = true;
    const c = this.challenge as RoundsChallenge;
    const r = c.rounds[this.roundIdx];
    const prev = this.vim;
    const setup = mergeSetup(c.base, r.setup);
    this.vim = createVim(setup);
    this.installReset();
    this.target = r.goal.cursor ?? null;
    this.roundKeys = 0;
    this.carryExtra = 0;
    // Leave the cursor where the learner is, rather than making them find it again.
    if (carry && this.carryCursor && prev && !setup.init && prev.buf.name === this.vim.buf.name && prev.buf.text() === this.vim.buf.text() && this.vim.mode === 'normal') {
      const start = { ...this.vim.cursor };
      const line = Math.min(prev.cursor.line, this.vim.buf.lineCount - 1);
      const col = Math.min(prev.cursor.col, Math.max(0, this.vim.line(line).length - 1));
      this.vim.win.cursor = { line, col };
      this.vim.win.want = col;
      this.vim.scrollToCursor();
      if (goalMet(this.vim, r.goal)) {
        this.vim.win.cursor = start;
        this.vim.win.want = start.col;
        this.vim.scrollToCursor();
      } else {
        // Par grows by the basic moves from here to where the reference solution starts.
        this.carryExtra = eqPos(start, this.vim.cursor) ? 0 : shortestPath(this.vim.buf.lines, this.vim.cursor, start, 'hjklwbeWBE', 40);
        this.carryByRound[this.roundIdx] = this.carryExtra;
      }
    }
  }
  /** Keep the cursor between rounds (off in validation playthroughs, whose solutions assume the setup cursor). */
  private carryCursor: boolean;
  private carryExtra = 0;
  private carryByRound: number[] = [];

  /** Par keys for a finished round (reference length + carry-over path), or null. */
  roundPar(unit: number): number | null { return this.roundStats[unit]?.par ?? null; }
  roundSolution(unit: number): string | null { return this.challenge.kind === 'rounds' ? this.challenge.rounds[unit]?.solution ?? null : null; }
  /** True when the cursor was carried into this round from the previous one. */
  carried(unit: number): boolean { return (this.carryByRound[unit] ?? 0) > 0; }

  private installReset() {
    this.vim!.defineEx('reset', 3, () => {
      queueMicrotask(() => this.resetRound());
    });
  }

  resetRound() {
    if (this.challenge.kind !== 'rounds' || this.done) return;
    const keys = this.roundKeys;
    this.loadRound();
    this.roundKeys = keys;
    this.msg = 'Round reset.';
    this.msgKind = 'info';
    this.version++;
  }

  // ---- input --------------------------------------------------------------------------------------

  /** Feed one key. Returns the key to flash on the lesson's key cards, if any. */
  key(k: Key, now = Date.now()): string | null {
    if (this.done) return null;
    const c = this.challenge;
    if (c.kind === 'quiz') return this.quizKey(k, now);
    if (this.roundDone) this.advance();
    const vim = this.vim!;
    // Arrow keys are off everywhere.
    if (/^<(Up|Down|Left|Right)>$/.test(k) && vim.mode !== 'cmdline' && !vim.modal && !vim.insert?.completion) {
      this.msg = 'Arrow keys are off. Use h j k l.';
      this.msgKind = 'warn';
      this.version++;
      return null;
    }
    const round = this.round;
    this.startAt ??= now;
    this.keys++;
    this.roundKeys++;
    this.msg = '';
    this.msgKind = 'info';
    const beforeText = vim.buf.text();
    const beforeLines = vim.buf.lines.slice();
    const pendingBefore = vim.pending.length;
    const doneBefore = c.kind === 'generated' ? this.generated!.items.map(it => itemDone(it, vim.buf.lines, this.generated!.goal)) : null;
    const unit = c.kind === 'rounds' ? this.roundIdx : c.kind === 'generated' ? this.nearestItem() : -1;
    const before = { pos: { ...vim.cursor }, mode: vim.mode, want: vim.win.want };
    vim.feed(k);
    const entry: LogEntry = {
      key: k, unit, before,
      after: { pos: { ...vim.cursor }, mode: vim.mode, changed: vim.buf.text() !== beforeText, pending: vim.pending.length },
      command: vim.lastCommand, boundary: this.pendingBoundary,
    };
    this.pendingBoundary = false;
    this.entries.push(entry);
    if (doneBefore) {
      const flipped = this.generated!.items.findIndex((it, i) => !doneBefore[i] && itemDone(it, vim.buf.lines, this.generated!.goal));
      if (flipped >= 0) entry.unit = flipped;
    }
    const flash = pendingBefore === 0 && vim.pending.length === 0 ? k : vim.pending.length === 0 ? k : null;

    if (c.kind === 'target' || c.kind === 'word') {
      if (vim.buf.text() !== beforeText || vim.mode !== 'normal') {
        if (vim.mode === 'insert' || vim.mode === 'replace') vim.leaveInsert();
        if (vim.visual) vim.exitVisual();
        vim.buf.lines = beforeLines;
        this.msg = TARGET_EDIT_MSG;
        this.msgKind = 'warn';
      }
      this.checkTarget(c, now);
    } else if (c.kind === 'fix' || c.kind === 'replace') {
      if (vim.buf.text() !== beforeText) this.checkEdit(c, beforeLines);
      if (vim.buf.text() === c.correct.join('\n') && vim.mode === 'normal') this.finish(now);
    } else if (c.kind === 'rounds') {
      if (goalMet(vim, round!.goal)) {
        this.hits++;
        this.roundStats.push({ keys: this.roundKeys, par: solutionKeys(round!.solution).length + this.carryExtra });
        if (this.roundIdx >= c.rounds.length - 1) this.finish(now);
        else this.roundDone = true;
      }
    } else if (c.kind === 'generated') {
      const g = this.generated!;
      this.collateralMax = Math.max(this.collateralMax, collateral(g.items, vim.buf.lines, g.goal));
      this.hits = g.items.filter(it => itemDone(it, vim.buf.lines, g.goal)).length;
      if (goalMet(vim, { text: g.goal })) this.finish(now);
    }
    if (!this.msg && vim.message) {
      this.msg = vim.message.text.split('\n')[0];
      this.msgKind = vim.message.kind === 'error' ? 'error' : vim.message.kind === 'warn' ? 'warn' : 'info';
    }
    this.version++;
    return flash;
  }

  /** Move on to the next round after a completed one. */
  advance() {
    if (!this.roundDone) return;
    this.roundDone = false;
    this.roundIdx++;
    this.loadRound(true);
    this.version++;
  }

  private finish(now: number) {
    this.done = true;
    this.endAt = now;
    this.target = null;
  }

  // ---- targets ------------------------------------------------------------------------------------

  private newTarget(c: TargetChallenge) {
    this.target = pickTarget(this.vim!, c, this.target, this.rand);
    this.tDist = shortestPath(this.vim!.buf.lines, this.vim!.cursor, this.target, c.pathKeys);
    this.tClean = true;
    this.optSum += this.tDist;
  }

  private checkTarget(c: TargetChallenge, now: number) {
    const cur = this.vim!.cursor;
    if (this.target && eqPos(cur, this.target)) {
      this.hits++;
      if (this.tClean) this.clean++;
      if (this.hits >= this.targetCount) this.finish(now);
      else this.newTarget(c);
    } else if (this.target && this.vim!.pending.length === 0) {
      const d = shortestPath(this.vim!.buf.lines, cur, this.target, c.pathKeys);
      this.tClean = this.tClean && d <= this.tDist;
      this.tDist = d;
    }
  }

  // ---- fix / replace ------------------------------------------------------------------------------

  private checkEdit(c: MarksChallenge, before: string[]) {
    const vim = this.vim!;
    const now = vim.buf.lines;
    // Find the changed line (single-line edits in these lessons).
    for (let r = 0; r < Math.max(now.length, before.length); r++) {
      if (now[r] === before[r]) continue;
      this.edits++;
      const cor = c.correct[r];
      if (cor == null) { this.mistakes++; break; }
      if (c.kind === 'fix') {
        if (!extraChars(now[r] ?? '', cor)) {
          this.mistakes++;
          this.msg = "That wasn't a typo. Press u to undo.";
          this.msgKind = 'error';
        }
      } else {
        const t = now[r] ?? '';
        if (t.length !== cor.length) {
          this.mistakes++;
          this.msg = 'That changed the length of the line. Press u to undo.';
          this.msgKind = 'error';
        } else {
          for (let i = 0; i < t.length; i++) {
            if (t[i] !== before[r][i] && t[i] !== cor[i]) {
              this.mistakes++;
              this.msg = `Not quite. This spot should be "${cor[i]}".`;
              this.msgKind = 'error';
              break;
            }
          }
        }
      }
      break;
    }
  }

  // ---- quiz ---------------------------------------------------------------------------------------------

  private quizKey(k: Key, now: number): string | null {
    const c = this.challenge as QuizChallenge;
    const q = c.questions[this.roundIdx];
    this.startAt ??= now;
    if (this.picked != null) {
      // Any key moves on.
      this.picked = null;
      this.sel = 0;
      if (this.roundIdx >= c.questions.length - 1) this.finish(now);
      else this.roundIdx++;
      this.version++;
      return null;
    }
    let choose: number | null = null;
    if (/^[1-9]$/.test(k) && +k <= q.options.length) choose = +k - 1;
    else if (k === 'j' || k === '<Down>' || k === '<Tab>') this.sel = (this.sel + 1) % q.options.length;
    else if (k === 'k' || k === '<Up>' || k === '<S-Tab>') this.sel = (this.sel - 1 + q.options.length) % q.options.length;
    else if (k === '<CR>' || k === ' ') choose = this.sel;
    else return null;
    this.keys++;
    if (choose != null) {
      this.picked = choose;
      this.sel = choose;
      this.hits++;
      if (choose === q.answer) this.rightAnswers++;
    }
    this.version++;
    return null;
  }

  pickOption(i: number, now = Date.now()) {
    if (this.challenge.kind !== 'quiz' || this.picked != null) return;
    this.quizKey(String(i + 1), now);
  }

  // ---- view & score ---------------------------------------------------------------------------------------

  view(): SessionView {
    const c = this.challenge;
    const marks = new Map<string, string>();
    let brokenLines = new Set<number>();
    if ((c.kind === 'fix' || c.kind === 'replace') && this.vim) {
      const m = marksOf(this.vim.buf.lines, c);
      m.marks.forEach(k => {
        const [r, col] = k.split(':').map(Number);
        marks.set(k, c.kind === 'replace' ? c.correct[r][col] : '');
      });
      brokenLines = m.broken;
    }
    const round = this.round;
    const showGoal = c.kind === 'rounds' && c.showGoal !== false && round?.goal.text != null;
    const g = c.kind === 'generated' ? this.generated! : null;
    const goalText = g ? g.goal : showGoal ? (Array.isArray(round!.goal.text) ? round!.goal.text : round!.goal.text!.split('\n')) : null;
    let items: SessionView['items'] = [];
    if (g && this.vim) {
      const cur = this.vim.buf.lines;
      const g2c = new Map(align(cur, g.goal).map(([ci, gi]) => [gi, ci] as const));
      // Current-buffer line of a goal line. An unfixed line never pairs (its text differs), so
      // interpolate from the nearest paired goal line above it; the gap rule keeps neighbours
      // untouched, so that is normally the line just above.
      const curLineOf = (gl: number, fallback: number) => {
        for (let k = 0; gl - k >= 0; k++) { const c = g2c.get(gl - k); if (c !== undefined) return c + k; }
        return fallback;
      };
      items = g.items.map(it => {
        const done = this.done || itemDone(it, cur, g.goal);
        // The line the fix acts on. The anchor (goal[0]) is the line itself for character kinds;
        // the line ABOVE the junk / the line to delete for stray-line and line-to-remove (so +1
        // until it is gone); the missing line for missing-duplicate-line (so the line above it
        // until it exists).
        const anchor = curLineOf(it.goal[0], it.fixAt.line);
        let line = anchor;
        if (it.kind === 'stray-line' || it.kind === 'line-to-remove') line = anchor + (done ? 0 : 1);
        else if (it.kind === 'missing-duplicate-line' && !done) line = curLineOf(it.goal[0] - 1, it.fixAt.line);
        return { text: it.text, kind: it.kind, done, line: line + 1 };
      });
    }
    let hits = this.hits;
    if ((c.kind === 'fix' || c.kind === 'replace') && this.vim) hits = Math.max(0, this.total - marks.size - brokenLines.size);
    const quiz = c.kind === 'quiz' && !this.done ? { q: c.questions[this.roundIdx], index: this.roundIdx, picked: this.picked, sel: this.sel } : null;
    return {
      vim: this.vim, target: this.done ? null : this.target, marks, brokenLines, goalText, prompt: round?.prompt ?? null,
      hits, total: this.total, keys: this.keys, startAt: this.startAt, endAt: this.endAt, done: this.done,
      roundDone: this.roundDone, msg: this.msg, msgKind: this.msgKind, quiz,
      items, seed: g?.seed ?? null,
    };
  }

  result(): Result {
    const c = this.challenge;
    const elapsed = (this.endAt ?? 0) - (this.startAt ?? 0);
    if (c.kind === 'target' || c.kind === 'word') {
      return finalize(elapsed, c.parPer * this.targetCount, this.optSum, this.keys, this.clean / this.targetCount, 'Correct',
        `${this.clean} of ${this.targetCount} without backtracking`);
    }
    if (c.kind === 'fix' || c.kind === 'replace') {
      const total = this.total;
      const correct = this.edits ? Math.max(0, (this.edits - this.mistakes) / this.edits) : 1;
      return finalize(elapsed, c.parPer * total, parKeysFor(c), this.keys, correct, 'Correct', `${this.edits - this.mistakes} of ${this.edits} edits right`);
    }
    if (c.kind === 'rounds') {
      const par = this.roundStats.reduce((a, r) => a + r.par, 0);
      const parTime = this.roundStats.reduce((a, r) => a + ROUND_BASE_MS + PER_KEY_MS * r.par, 0);
      const clean = this.roundStats.filter(r => r.keys <= Math.ceil(r.par * 1.5) + 1).length;
      return finalize(elapsed, parTime, par, this.keys, clean / Math.max(1, this.roundStats.length), 'Clean',
        `${clean} of ${this.roundStats.length} rounds near par`);
    }
    if (c.kind === 'generated') {
      const g = this.generated!;
      const correct = Math.max(0, 1 - this.collateralMax / Math.max(1, g.items.length));
      return finalize(elapsed, g.parMs, g.parKeys, this.keys, correct, 'Clean',
        this.collateralMax ? `${this.collateralMax} stray edit${this.collateralMax === 1 ? '' : 's'} outside the list` : 'nothing touched outside the list');
    }
    const n = (c as QuizChallenge).questions.length;
    return finalize(elapsed, n * 5000, n, this.keys, this.rightAnswers / n, 'Correct', `${this.rightAnswers} of ${n} right`);
  }
}

// ---- helpers ----------------------------------------------------------------------------------------------

export function extraChars(cur: string, cor: string): number[] | null {
  const extra: number[] = [];
  let j = 0;
  for (let i = 0; i < cur.length; i++) {
    if (j < cor.length && cur[i] === cor[j]) j++;
    else extra.push(i);
  }
  return j === cor.length ? extra : null;
}

export function marksOf(lines: readonly string[], c: MarksChallenge) {
  const marks = new Set<string>(), broken = new Set<number>();
  lines.forEach((t, r) => {
    const cor = c.correct[r];
    if (cor == null) return void broken.add(r);
    if (c.kind === 'fix') {
      const extra = extraChars(t, cor);
      if (extra) extra.forEach(col => marks.add(`${r}:${col}`));
      else broken.add(r);
    } else {
      if (t.length !== cor.length) return void broken.add(r);
      for (let col = 0; col < t.length; col++) if (t[col] !== cor[col]) marks.add(`${r}:${col}`);
    }
  });
  return { marks, broken };
}

const parCache = new WeakMap<MarksChallenge, number>();

/** Greedy nearest-mark keystroke count for fix/replace lessons. */
export function parKeysFor(c: MarksChallenge): number {
  const hit = parCache.get(c);
  if (hit != null) return hit;
  let lines = c.code.slice(), p = { ...c.start }, keys = 0;
  for (let guard = 0; guard < 100; guard++) {
    const m = [...marksOf(lines, c).marks];
    if (!m.length) break;
    let best = p, bd = Infinity;
    for (const k of m) {
      const [line, col] = k.split(':').map(Number);
      const d = shortestPath(lines, p, { line, col }, c.pathKeys);
      if (d < bd) { bd = d; best = { line, col }; }
    }
    keys += bd + (c.kind === 'fix' ? 1 : 2);
    lines = lines.slice();
    const t = lines[best.line];
    lines[best.line] = c.kind === 'fix' ? t.slice(0, best.col) + t.slice(best.col + 1) : t.slice(0, best.col) + c.correct[best.line][best.col] + t.slice(best.col + 1);
    p = { line: best.line, col: Math.min(best.col, Math.max(lines[best.line].length - 1, 0)) };
  }
  parCache.set(c, keys);
  return keys;
}

export function step(lines: readonly string[], k: string, p: Pos): Pos {
  const last = (r: number) => Math.max(0, lines[r].length - 1);
  switch (k) {
    case 'h': return pos(p.line, Math.max(0, p.col - 1));
    case 'l': return pos(p.line, Math.min(last(p.line), p.col + 1));
    case 'j': { const r = Math.min(lines.length - 1, p.line + 1); return pos(r, Math.min(p.col, last(r))); }
    case 'k': { const r = Math.max(0, p.line - 1); return pos(r, Math.min(p.col, last(r))); }
    case 'w': case 'W': { const q = wordForward(lines, p, k === 'W'); return q ? pos(q.line, Math.min(q.col, last(q.line))) : p; }
    case 'e': case 'E': return wordEnd(lines, p, k === 'E') ?? p;
    case 'b': case 'B': return wordBackward(lines, p, k === 'B') ?? p;
  }
  return p;
}

/** Fewest keys from `from` to `to` using `keys` (no counts). */
export function shortestPath(lines: readonly string[], from: Pos, to: Pos, keys: string, limit = 80): number {
  if (eqPos(from, to)) return 0;
  const seen = new Set([`${from.line}:${from.col}`]);
  let frontier = [from];
  for (let d = 1; frontier.length && d <= limit; d++) {
    const next: Pos[] = [];
    for (const p of frontier) {
      for (const k of keys) {
        const q = step(lines, k, p);
        if (eqPos(q, to)) return d;
        const id = `${q.line}:${q.col}`;
        if (!seen.has(id)) { seen.add(id); next.push(q); }
      }
    }
    frontier = next;
  }
  return limit;
}

function pickTarget(vim: Vim, c: TargetChallenge, prev: Pos | null, rand: () => number): Pos {
  const lines = vim.buf.lines, cur = vim.cursor;
  let cands: Pos[] = [];
  if (c.kind === 'target') {
    lines.forEach((t, r) => {
      for (let col = 0; col < t.length; col++) {
        if (t[col] === ' ') continue;
        const d = Math.abs(r - cur.line) + Math.abs(col - cur.col);
        if (d >= 2 && d <= 7) cands.push(pos(r, col));
      }
    });
  } else {
    const seen = new Set<string>();
    const motions = c.pathKeys.replace(/[hjkl]/g, '') || 'web';
    for (const m of motions) {
      let p = cur;
      for (let i = 0; i < 3; i++) {
        p = step(lines, m, p);
        const k = `${p.line}:${p.col}`;
        if (!eqPos(p, cur) && !seen.has(k)) { seen.add(k); cands.push(p); }
      }
    }
  }
  if (prev) cands = cands.filter(p => !eqPos(p, prev));
  return cands.length ? cands[Math.floor(rand() * cands.length)] : pos(0, 0);
}

void cmpPos;
