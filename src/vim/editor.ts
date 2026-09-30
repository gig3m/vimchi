// The editor: modes, key dispatch, the normal-mode command parser, insert
// mode, visual mode, the command line, registers, undo, dot-repeat and
// macros. Motions, operators and actions live in commands.ts; ex commands in
// ex.ts; plugins register extra commands through the define* methods.

import { Buffer } from './buffer';
import { installCommands } from './commands';
import { type ExprEnv, evaluate, valueToString } from './expr';
import { runEx } from './ex';
import { VirtualFS, norm } from './fs';
import { type Key, keysToString, parseKeys } from './keys';
import { type QfItem, Tab, Window } from './layout';
import { type Compiled, PatternError, compile } from './regex';
import { type RegKind, type RegValue, Registers, isValidRegister } from './registers';
import { firstNonBlank, indentOf, lastCol } from './text';
import type { TextObject } from './textobjects';
import {
  DEFAULT_OPTIONS, type Message, type Mode, type Options, type Pos, type Range, type VisualKind,
  VimError, cmpPos, fail, maxPos, minPos, pos,
} from './types';

// ---- command specs ---------------------------------------------------------------

export type MotionCtx = { count: number; hasCount: boolean; arg: string; op: string | null; visual: boolean };
export type MotionResult = {
  pos: Pos;
  linewise?: boolean;
  inclusive?: boolean;
  jump?: boolean;
  /** Explicit curswant (Infinity for $). */
  want?: number;
  /** Leave curswant alone (j, k). */
  keepWant?: boolean;
  /** Open folds at the destination. */
  openFold?: boolean;
};
export type MotionSpec = {
  run: (ctx: MotionCtx) => MotionResult | null;
  arg?: 'char';
  /** Operator-pending only: the motion picks its target interactively (flash's d s…). Call done() or cancel(). */
  pick?: (done: (res: MotionResult, typed: Key[]) => void, cancel: () => void) => void;
  /** Count defaults to 0 rather than 1 (e.g. G). */
};

export type OpCtx = { reg: string | null; count: number; hasCount: boolean; visual: VisualKind | null; keys: string };
export type OperatorSpec = {
  run: (range: Range, ctx: OpCtx) => void;
  /** Makes a change (undo + dot). */
  change?: boolean;
  /** Needs a character argument after the motion (e.g. surround's ys{motion}{char}). */
  argAfter?: 'char' | 'surround';
};

export type ActionCtx = { count: number; hasCount: boolean; reg: string | null; arg: string; keys: string };
export type ActionSpec = {
  run: (ctx: ActionCtx) => void;
  /** 'surround' reads like OperatorSpec.argAfter; 'tag' reads a name up to <CR> (or <tag>). */
  arg?: 'char' | 'char2' | 'surround' | 'tag';
  change?: boolean;
};

type Entry =
  | { type: 'motion'; spec: MotionSpec }
  | { type: 'operator'; spec: OperatorSpec }
  | { type: 'action'; spec: ActionSpec }
  | { type: 'object'; obj: TextObject; inner: boolean }
  | { type: 'map'; rhs: Key[] | ((ctx: ActionCtx) => void); change?: boolean };

type Table = Map<string, Entry>;
const SEP = '\x1f';
const keyOf = (keys: Key[]) => keys.join(SEP);

export type ModeName = 'n' | 'v' | 'o' | 'i' | 'c';

export type Decoration = {
  signs?: Map<number, { text: string; color: string }>;
  virt?: Map<number, { text: string; color: string }>;
  hl?: { line: number; start: number; end: number; color: string; bg?: string; /** Characters drawn over the cells (flash labels). */ text?: string; /** Draw `text` as virtual text before column `start` instead. */ inline?: boolean }[];
  lineBg?: Map<number, string>;
  /** Virtual rows drawn above a line (diff filler); key = lineCount draws after the last line. */
  virtLines?: Map<number, { text: string; color?: string; bg?: string }[]>;
  /** Columns hidden at the start of a line (oil's entry ids): line → count. */
  conceal?: Map<number, number>;
};

export type Float = {
  id: string;
  title?: string;
  lines: { text: string; color?: string; bg?: string }[];
  /** Highlighted row in `lines`. */
  sel?: number;
  anchor: 'center' | 'cursor' | 'top';
  width?: number;
  /** A prompt line shown at the top of the float. */
  prompt?: { label: string; text: string; cursor: number };
  footer?: string;
  /** Two-pane floats (pickers with preview). */
  preview?: { title?: string; lines: string[]; highlight?: number };
  /** An editable float: renders this window's buffer and cursor (harpoon's menu). */
  win?: Window;
};

export type Plugin = { name: string; setup: (vim: Vim) => void };

type Cmdline = {
  type: ':' | '/' | '?' | '=' | 'input';
  text: string;
  cursor: number;
  prompt?: string;
  onSubmit?: (text: string) => void;
  onCancel?: () => void;
  histIdx: number;
  /** While browsing history: the text before the cursor when <Up>/<Down> began. */
  histPrefix?: string | null;
  /** Waiting for a register name after <C-r>. */
  ctrlR: boolean;
  /** Search state to restore on cancel (incsearch). */
  saved?: { cursor: Pos; top: number };
};

type InsertState = {
  kind: string;
  start: Pos;
  keys: Key[];
  count: number;
  /** Visual block insert: lines and column to replicate into on <Esc>. */
  block?: { first: number; last: number; col: number; append: boolean; toEol: boolean };
  /** Original line texts for replace mode backspacing. */
  replaced?: Map<string, string>;
  /** Pending multi-key input: <C-r>, <C-v>, <C-k>, <C-x>, <C-o>. */
  pending: '' | 'ctrl-r' | 'ctrl-v' | 'ctrl-k' | 'ctrl-x' | 'ctrl-g';
  pendingBuf: string;
  /** Text typed so far (for ". and <C-a>). */
  typed: string;
  completion?: { items: string[]; idx: number; startCol: number; line: number; orig: string };
  /** Came from <C-o>: return here after one command. */
};

export type CommandKind = 'motion' | 'operator' | 'action' | 'insert' | 'visual' | 'cmdline' | 'modal' | 'undo' | 'other';
export type LastCommand = { keys: Key[]; kind: CommandKind; error: boolean };

type LastChange = {
  reg: string | null;
  count: number | null;
  body: Key[];
  insert: Key[];
  visual?: { kind: VisualKind; lines: number; cols: number; toEol: boolean };
};

export type Snapshot = {
  version: number;
};

export class Vim {
  // ---- state ---------------------------------------------------------------
  fs: VirtualFS;
  buffers: Buffer[] = [];
  tabs: Tab[] = [];
  tabIdx = 0;
  options: Options = { ...DEFAULT_OPTIONS };
  registers = new Registers();
  globalMarks = new Map<string, { buf: Buffer; pos: Pos }>();
  mode: Mode = 'normal';
  visual: { kind: VisualKind; anchor: Pos; toEol: boolean } | null = null;
  lastVisual: { kind: VisualKind; start: Pos; end: Pos; toEol: boolean; buf: Buffer } | null = null;
  cmdline: Cmdline | null = null;
  insert: InsertState | null = null;
  /** Keys of the normal command being parsed. */
  pending: Key[] = [];
  message: Message | null = null;
  search: { pattern: string; dir: 1 | -1; offset: string; noSmartcase?: boolean } = { pattern: '', dir: 1, offset: '' };
  /** Set while an operator waits for a / or ? search target. */
  pendingSearchOp: ((res: MotionResult) => void) | null = null;
  pendingSearchCount = 0;
  /** Cursor when the command line was opened (for jumps after a search). */
  cmdlineSaved: Pos | null = null;
  hlActive = false;
  lastFind: { ch: string; forward: boolean; till: boolean } | null = null;
  lastSub: { pattern: string; replacement: string; flags: string } | null = null;
  history: Record<':' | '/', string[]> = { ':': [], '/': [] };
  lastEx = '';
  lastInserted = '';
  lastChange: LastChange | null = null;
  lastMacro: string | null = null;
  recording: { reg: string; keys: Key[] } | null = null;
  quickfix: { items: QfItem[]; idx: number; title: string } = { items: [], idx: 0, title: '' };
  args: string[] = [];
  argIdx = 0;
  leader = ' ';
  version = 0;
  /** Number of keys the user typed (not replayed). */
  typedKeys = 0;
  floats: Float[] = [];
  /** A key handler that takes priority over modes (pickers, prompts). */
  modal: ((key: Key) => boolean) | null = null;
  confirm: { onKey: (k: Key) => void; prompt: string } | null = null;
  /** Called after every top-level key; lessons watch this. */
  onChange: (() => void) | null = null;
  /** Hooks plugins use to decorate buffers. */
  decorators: ((buf: Buffer, win: Window) => Decoration | null)[] = [];
  /** Run after every top-level key, like a CursorMoved autocmd (oil keeps the cursor off entry ids). */
  cursorHooks: (() => void)[] = [];
  /** Events for challenge bookkeeping (e.g. "undo", "search"). */
  events: string[] = [];
  /** The command the most recent feed() completed, for the coach. null when the key completed nothing. */
  lastCommand: LastCommand | null = null;
  /** Keys since the current normal/visual command began, including any insert or cmdline text typed for it. */
  private cmdKeys: Key[] = [];

  private finishCommand(kind: CommandKind) {
    this.lastCommand = { keys: this.cmdKeys.slice(), kind, error: false };
    if (this.mode === 'normal' && !this.visual) this.cmdKeys = [];
  }
  /** Screen rows available to the whole editor layout. */
  screenRows = 18;
  screenCols = 100;
  /** Data plugins keep. */
  pluginData: Record<string, unknown> = {};

  private tables: Record<'n' | 'v' | 'o', Table> = { n: new Map(), v: new Map(), o: new Map() };
  private prefixes: Record<'n' | 'v' | 'o', Set<string>> = { n: new Set(), v: new Set(), o: new Set() };
  private insertMaps = new Map<string, (vim: Vim) => void | boolean>();
  exCommands = new Map<string, { min: number; run: (args: ExArgs) => void }>();
  private depth = 0;
  private snapshotTaken = false;
  private dotCapture: { keys: Key[]; replaying: boolean } | null = null;
  private dotReplaying = false;

  constructor(opts: { files?: Record<string, string>; open?: string; text?: string; name?: string; plugins?: Plugin[] } = {}) {
    this.fs = new VirtualFS(opts.files ?? {});
    const name = opts.open ?? opts.name ?? '[No Name]';
    const text = opts.text ?? (opts.open ? this.fs.read(opts.open) ?? '' : '');
    const buf = new Buffer(name, text);
    buf.modified = false;
    this.buffers.push(buf);
    const win = new Window(buf);
    this.tabs.push(new Tab(win));
    this.registers.readonly = n => this.readonlyRegister(n);
    installCommands(this);
    for (const p of opts.plugins ?? []) p.setup(this);
  }

  // ---- accessors -----------------------------------------------------------
  get tab() { return this.tabs[this.tabIdx]; }
  get win() { return this.tab.cur; }
  get buf() { return this.win.buf; }
  get cursor() { return this.win.cursor; }
  get lines() { return this.buf.lines; }
  line(n = this.cursor.line) { return this.buf.line(n); }
  opt<K extends keyof Options>(k: K): Options[K] {
    const w = this.win.opts[k as string];
    return (w !== undefined ? w : this.options[k]) as Options[K];
  }

  // ---- definitions -----------------------------------------------------------
  private define(modes: ('n' | 'v' | 'o')[], keys: string | Key[], entry: Entry) {
    const k = typeof keys === 'string' ? parseKeys(keys) : keys;
    for (const m of modes) {
      this.tables[m].set(keyOf(k), entry);
      for (let i = 1; i < k.length; i++) this.prefixes[m].add(keyOf(k.slice(0, i)));
    }
  }
  defineMotion(keys: string, spec: MotionSpec) {
    this.define(['n', 'v', 'o'], keys, { type: 'motion', spec });
  }
  defineOperator(keys: string, spec: OperatorSpec, modes: ('n' | 'v')[] = ['n', 'v']) {
    this.define(modes, keys, { type: 'operator', spec });
  }
  defineAction(keys: string, spec: ActionSpec, modes: ('n' | 'v' | 'o')[] = ['n']) {
    this.define(modes, keys, { type: 'action', spec });
  }
  defineObject(keys: string, obj: TextObject) {
    // keys is like "iw" or "in(": first char i/a.
    const k = parseKeys(keys);
    this.define(['o', 'v'], k, { type: 'object', obj, inner: k[0] === 'i' });
  }
  /** Map keys (with <leader>) to other keys or a function. */
  map(modes: ('n' | 'v' | 'o')[], lhs: string, rhs: string | ((ctx: ActionCtx) => void), opts: { change?: boolean } = {}) {
    const k = parseKeys(lhs).flatMap(x => (x === '<leader>' ? [this.leader] : [x]));
    this.define(modes, k, { type: 'map', rhs: typeof rhs === 'string' ? parseKeys(rhs) : rhs, change: opts.change });
  }
  /** Map keys in one buffer only (plugin UIs such as fugitive's status buffer). */
  mapLocal(buf: Buffer, modes: ('n' | 'v' | 'o')[], lhs: string, rhs: string | ((ctx: ActionCtx) => void), opts: { change?: boolean } = {}) {
    const k = parseKeys(lhs).flatMap(x => (x === '<leader>' ? [this.leader] : [x]));
    const entry: Entry = { type: 'map', rhs: typeof rhs === 'string' ? parseKeys(rhs) : rhs, change: opts.change };
    for (const m of modes) {
      buf.localMaps[m].set(keyOf(k), entry);
      for (let i = 1; i < k.length; i++) buf.localPrefixes[m].add(keyOf(k.slice(0, i)));
    }
  }
  unmap(modes: ('n' | 'v' | 'o')[], lhs: string) {
    const k = parseKeys(lhs).flatMap(x => (x === '<leader>' ? [this.leader] : [x]));
    for (const m of modes) this.tables[m].delete(keyOf(k));
  }
  /** Map a key in insert mode. Returning `false` falls through to the key's normal handling. */
  mapInsert(lhs: string, fn: (vim: Vim) => void | boolean) {
    this.insertMaps.set(lhs, fn);
  }
  defineEx(name: string, min: number, run: (args: ExArgs) => void) {
    this.exCommands.set(name, { min, run });
  }

  getAction(keys: string, mode: 'n' | 'v' | 'o' = 'n'): ActionSpec | undefined {
    const e = this.tables[mode].get(keyOf(parseKeys(keys)));
    return e && e.type === 'action' ? e.spec : undefined;
  }
  getOperator(keys: string): OperatorSpec | undefined {
    const e = this.tables.n.get(keyOf(parseKeys(keys)));
    return e && e.type === 'operator' ? e.spec : undefined;
  }
  getMotion(keys: string): MotionSpec | undefined {
    const e = this.tables.o.get(keyOf(parseKeys(keys)));
    return e && e.type === 'motion' ? e.spec : undefined;
  }
  /** Open the / or ? prompt (the action registered in commands.ts). */
  openSearchFor(dir: 1 | -1) {
    this.getAction(dir === 1 ? '/' : '?', 'o')!.run({ count: 1, hasCount: false, reg: null, arg: '', keys: dir === 1 ? '/' : '?' });
  }

  // ---- messages & events -------------------------------------------------------
  msg(text: string, kind: Message['kind'] = 'info') {
    this.message = { text, kind };
  }
  emit(ev: string) {
    this.events.push(ev);
  }

  // ---- buffers & windows ---------------------------------------------------------
  findBuffer(name: string): Buffer | undefined {
    return this.buffers.find(b => b.name === name);
  }

  /** Open a file (or existing buffer) in the current window. */
  edit(name: string, opts: { win?: Window; force?: boolean } = {}): Buffer {
    const win = opts.win ?? this.win;
    let buf = this.findBuffer(name);
    if (!buf) {
      const text = this.fs.read(name);
      buf = new Buffer(name, text ?? '');
      buf.modified = false;
      if (text == null && this.fs.isDir(name)) buf.data.isDir = true;
      this.buffers.push(buf);
    }
    this.showBuffer(win, buf);
    return buf;
  }

  showBuffer(win: Window, buf: Buffer) {
    if (win.buf === buf) return;
    win.lastPos.set(win.buf.id, { ...win.cursor });
    win.alt = win.buf;
    win.buf = buf;
    buf.listed = buf.kind === 'file' ? true : buf.listed;
    const p = win.lastPos.get(buf.id) ?? buf.marks.get('"') ?? pos(0, 0);
    win.cursor = pos(Math.min(p.line, buf.lineCount - 1), 0);
    win.cursor.col = Math.min(p.col, lastCol(buf.line(win.cursor.line)));
    win.want = win.cursor.col;
    win.top = 0;
    win.folds = [];
    this.scrollToCursor(win);
  }

  /** Find a file by name: exact, relative to the current file, or anywhere in the project. */
  resolveFile(name: string): string | null {
    const clean = name.replace(/^\.\//, '');
    if (this.fs.read(clean) != null) return clean;
    const dir = this.buf.name.includes('/') ? this.buf.name.slice(0, this.buf.name.lastIndexOf('/') + 1) : '';
    const exts = ['', '.ts', '.tsx', '.js', '.lua', '.md', '/index.ts', '/index.js'];
    for (const e of exts) {
      const rel = norm(dir + clean + e);
      if (this.fs.read(rel) != null) return rel;
      if (this.fs.read(clean + e) != null) return clean + e;
    }
    const base = clean.split('/').pop()!;
    const hit = this.fs.list().find(p => p === clean || p.endsWith('/' + clean) || p.split('/').pop() === base);
    return hit ?? null;
  }

  newTab(buf?: Buffer) {
    const w = new Window(buf ?? new Buffer('[No Name]', ''));
    if (!buf) this.buffers.push(w.buf);
    this.tabs.splice(this.tabIdx + 1, 0, new Tab(w));
    this.tabIdx++;
    return w;
  }

  /** q: — the command-line window. */
  openCmdWindow() {
    const hist = this.history[':'];
    const buf = new Buffer('[Command Line]', [...hist, ''], { kind: 'cmdwin', filetype: 'vim' });
    buf.listed = false;
    this.buffers.push(buf);
    const w = new Window(buf);
    this.tab.split(this.win, w, 'col', true);
    this.tab.prev = this.win;
    this.tab.cur = w;
    w.cursor = pos(buf.lineCount - 1, 0);
  }

  addBuffer(buf: Buffer) {
    if (!this.buffers.includes(buf)) this.buffers.push(buf);
    return buf;
  }

  splitWindow(dir: 'row' | 'col', buf?: Buffer): Window {
    const w = new Window(buf ?? this.buf);
    w.cursor = { ...this.cursor };
    w.want = this.win.want;
    w.top = this.win.top;
    w.alt = this.win.alt;
    this.tab.split(this.win, w, dir, false);
    this.tab.prev = this.win;
    this.tab.cur = w;
    return w;
  }

  focusWindow(w: Window) {
    if (w === this.win) return;
    this.tab.prev = this.win;
    this.tab.cur = w;
  }

  closeWindow(w: Window = this.win) {
    const wins = this.tab.windows();
    if (wins.length === 1) {
      if (this.tabs.length > 1) {
        this.tabs.splice(this.tabIdx, 1);
        this.tabIdx = Math.min(this.tabIdx, this.tabs.length - 1);
        return;
      }
      fail('E444: Cannot close last window');
    }
    const idx = wins.indexOf(w);
    this.tab.close(w);
    if (this.tab.cur === w) {
      const rest = this.tab.windows();
      this.tab.cur = this.tab.prev && rest.includes(this.tab.prev) ? this.tab.prev : rest[Math.max(0, idx - 1)];
    }
  }

  // ---- cursor helpers ------------------------------------------------------------
  clampCursor(allowEol = this.mode === 'insert' || this.mode === 'replace' || (this.mode === 'visual') || (this.mode === 'cmdline' && this.cmdline?.type === '=')) {
    const c = this.win.cursor;
    c.line = Math.max(0, Math.min(c.line, this.buf.lineCount - 1));
    const len = this.line(c.line).length;
    c.col = Math.max(0, Math.min(c.col, allowEol ? len : Math.max(0, len - 1)));
    if (this.mode === 'visual' && !allowEol) c.col = Math.min(c.col, Math.max(0, len - 1));
  }

  setCursor(p: Pos, want?: number) {
    this.win.cursor = { line: p.line, col: p.col };
    this.clampCursor(this.mode === 'insert' || this.mode === 'replace');
    this.win.want = want ?? this.win.cursor.col;
  }

  pushJump(p: Pos = this.cursor) {
    const w = this.win;
    w.jumplist = w.jumplist.slice(0, w.jumpIdx).filter(j => !(j.buf === this.buf && j.pos.line === p.line));
    w.jumplist.push({ buf: this.buf, pos: { ...p } });
    if (w.jumplist.length > 100) w.jumplist.shift();
    w.jumpIdx = w.jumplist.length;
    this.buf.marks.set("'", { ...p });
  }

  // ---- folds ---------------------------------------------------------------------
  closedFoldAt(line: number, win = this.win) {
    let best: { start: number; end: number } | null = null;
    for (const f of win.folds) if (f.closed && line >= f.start && line <= f.end && (!best || f.start < best.start)) best = f;
    return best;
  }
  /** Buffer lines shown as screen rows (a closed fold is one row). */
  visibleLines(win = this.win): number[] {
    const out: number[] = [];
    for (let l = 0; l < win.buf.lineCount; l++) {
      const f = this.closedFoldAt(l, win);
      if (f) {
        out.push(f.start);
        l = f.end;
      } else out.push(l);
    }
    return out;
  }
  openFoldsAt(line: number, win = this.win) {
    for (const f of win.folds) if (line >= f.start && line <= f.end) f.closed = false;
  }

  // ---- scrolling -------------------------------------------------------------------
  scrollToCursor(win = this.win) {
    const rows = this.visibleLines(win);
    const h = Math.max(1, win.height);
    const so = Math.min(Number(this.options.scrolloff), Math.floor((h - 1) / 2));
    const curRow = rows.findIndex(l => l >= win.cursor.line) - (rows.includes(win.cursor.line) ? 0 : 1);
    const cr = Math.max(0, rows.indexOf(this.closedFoldAt(win.cursor.line, win)?.start ?? win.cursor.line) >= 0
      ? rows.indexOf(this.closedFoldAt(win.cursor.line, win)?.start ?? win.cursor.line) : curRow);
    let topRow = Math.max(0, rows.findIndex(l => l >= win.top));
    if (cr < topRow + so) topRow = Math.max(0, cr - so);
    if (cr > topRow + h - 1 - so) topRow = Math.min(Math.max(0, rows.length - 1), cr - h + 1 + so);
    win.top = rows[Math.max(0, Math.min(topRow, rows.length - 1))] ?? 0;
  }

  /** Scroll so the cursor row sits at a screen position. */
  scrollCursorTo(where: 'top' | 'center' | 'bottom') {
    const rows = this.visibleLines();
    const cr = rows.indexOf(this.closedFoldAt(this.cursor.line)?.start ?? this.cursor.line);
    const h = this.win.height;
    const topRow = where === 'top' ? cr : where === 'center' ? cr - Math.floor((h - 1) / 2) : cr - h + 1;
    this.win.top = rows[Math.max(0, Math.min(topRow, rows.length - 1))] ?? 0;
  }

  // ---- text access ----------------------------------------------------------------
  getText(r: Range): RegValue {
    const L = this.lines;
    if (r.kind === 'line') {
      return { text: L.slice(r.start.line, r.end.line + 1).join('\n') + '\n', kind: 'line' };
    }
    if (r.kind === 'block') {
      const [c1, c2] = [Math.min(r.start.col, r.end.col), Math.max(r.start.col, r.end.col)];
      const parts: string[] = [];
      for (let l = r.start.line; l <= r.end.line; l++) parts.push(L[l].slice(c1, r.toEol ? undefined : c2 + 1));
      return { text: parts.join('\n'), kind: 'block' };
    }
    const { start, end } = r;
    if (start.line === end.line) return { text: L[start.line].slice(start.col, end.col + 1) + (end.col >= L[end.line].length && end.line < L.length - 1 ? '\n' : ''), kind: 'char' };
    const parts = [L[start.line].slice(start.col)];
    for (let l = start.line + 1; l < end.line; l++) parts.push(L[l]);
    parts.push(L[end.line].slice(0, end.col + 1) + (end.col >= L[end.line].length && end.line < L.length - 1 ? '\n' : ''));
    return { text: parts.join('\n'), kind: 'char' };
  }

  /** Delete a range; returns the removed text. Sets '[ and ']. */
  deleteRange(r: Range): RegValue {
    const val = this.getText(r);
    const b = this.buf;
    if (r.kind === 'line') {
      b.splice(r.start.line, r.end.line - r.start.line + 1, []);
      const l = Math.min(r.start.line, b.lineCount - 1);
      b.marks.set('[', pos(l, 0));
      b.marks.set(']', pos(l, 0));
      b.recordChange(pos(l, 0));
      return val;
    }
    if (r.kind === 'block') {
      const [c1, c2] = [Math.min(r.start.col, r.end.col), Math.max(r.start.col, r.end.col)];
      for (let l = r.start.line; l <= r.end.line; l++) {
        const t = b.line(l);
        b.setLine(l, t.slice(0, c1) + (r.toEol ? '' : t.slice(c2 + 1)));
      }
      b.marks.set('[', pos(r.start.line, c1));
      b.marks.set(']', pos(r.end.line, c1));
      b.recordChange(pos(r.start.line, c1));
      return val;
    }
    const { start, end } = r;
    const endLine = b.line(end.line);
    const joinNext = end.col >= endLine.length && end.line < b.lineCount - 1;
    const after = joinNext ? b.line(end.line + 1) : endLine.slice(end.col + 1);
    const newLine = b.line(start.line).slice(0, start.col) + after;
    b.splice(start.line, end.line - start.line + 1 + (joinNext ? 1 : 0), [newLine]);
    b.marks.set('[', { ...start });
    b.marks.set(']', { ...start });
    b.recordChange(start);
    return val;
  }

  /** Insert text (may contain newlines) at p. Returns the position after it. */
  insertText(p: Pos, text: string): Pos {
    const b = this.buf;
    const t = b.line(p.line);
    const parts = text.split('\n');
    const before = t.slice(0, p.col), after = t.slice(p.col);
    if (parts.length === 1) {
      b.setLine(p.line, before + text + after);
      b.recordChange({ ...p });
      return pos(p.line, p.col + text.length);
    }
    const repl = [before + parts[0], ...parts.slice(1, -1), parts[parts.length - 1] + after];
    b.splice(p.line, 1, repl);
    const end = pos(p.line + parts.length - 1, parts[parts.length - 1].length);
    b.recordChange(end);
    return end;
  }

  insertLines(at: number, lines: string[]) {
    this.buf.splice(at, 0, lines);
    this.buf.recordChange(pos(at, 0));
  }

  // ---- undo -----------------------------------------------------------------------
  /** Open an undoable change. `at`: where undo/redo return the cursor (an operator's start). */
  beginChange(at?: Pos) {
    if (this.snapshotTaken) {
      if (at) this.buf.setUndoCursor(at);
      return;
    }
    this.buf.snapshot(this.cursor, () => this.cursor);
    if (at) this.buf.setUndoCursor(at);
    if (!this.buf.lineUndo || this.buf.lineUndo.line !== this.cursor.line) {
      this.buf.lineUndo = { line: this.cursor.line, text: this.line() };
    }
    this.snapshotTaken = true;
  }
  /**
   * Where Vim's undo remembers an operator's cursor: the start of the operated text; for a
   * linewise motion the column the cursor had there, for a linewise text object, c or a case
   * operator column 0.
   */
  private opUndoCursor(p: Parsed, r: Range): Pos {
    if (r.kind === 'char') return r.start;
    if (r.kind === 'block') return pos(r.start.line, Math.min(r.start.col, r.end.col));
    const col0 = (p.target?.kind === 'entry' && p.target.entry.type === 'object') || /^(c|g[uU~?]|~)$/.test((p.opStr ?? '').split(SEP).join(''));
    if (col0) return pos(r.start.line, 0);
    return pos(r.start.line, r.start.line === this.cursor.line ? this.cursor.col : this.win.want);
  }
  private endChange() {
    if (this.snapshotTaken) this.buf.dropSnapshotIfUnchanged();
    this.snapshotTaken = false;
  }

  // ---- registers ------------------------------------------------------------------
  private readonlyRegister(n: string): string | null {
    if (n === '.') return this.lastInserted;
    if (n === ':') return this.lastEx;
    if (n === '/') return this.search.pattern;
    if (n === '%') return this.buf.name;
    return null;
  }
  getRegister(name: string | null): RegValue {
    if (name === '=') return { text: '', kind: 'char' };
    return this.registers.get(name ?? '"');
  }

  // ---- key entry points --------------------------------------------------------------

  /** Feed one user key. Errors abort the current command and any macro. */
  feed(key: Key) {
    this.typedKeys++;
    if (this.recording && this.depth === 0) this.recording.keys.push(key);
    this.events = [];
    this.lastCommand = null;
    try {
      this.handleKey(key);
    } catch (e) {
      if (!(e instanceof VimError)) throw e;
      this.resetAfterError(e);
      // An error ends the command; a bad f/t target is the common case, hence 'motion'.
      this.lastCommand = { keys: this.cmdKeys.slice(), kind: 'motion', error: true };
      this.cmdKeys = [];
    }
    this.afterKey();
  }

  /** Feed a notation string as if typed (tests, :normal, macros). */
  feedKeys(keys: string | Key[]) {
    for (const k of typeof keys === 'string' ? parseKeys(keys) : keys) this.feed(k);
  }

  private afterKey() {
    if (this.mode === 'normal' && this.pending.length === 0) {
      this.endChange();
      this.clampCursor(false);
    }
    const f = this.closedFoldAt(this.cursor.line);
    if (f && this.mode !== 'visual') this.win.cursor = pos(f.start, this.win.cursor.col);
    this.clampCursor();
    for (const h of this.cursorHooks) h();
    this.scrollToCursor();
    this.version++;
    this.onChange?.();
  }

  private resetAfterError(e: VimError) {
    this.pending = [];
    this.dotCapture = null;
    if (e.message) this.msg(e.message, 'error');
    if (this.mode === 'visual' && !this.visual) this.mode = 'normal';
    this.emit('error');
  }

  /** Replay keys inside the current command (macros, dot, mappings). */
  runKeys(keys: Key[], opts: { catchErrors?: boolean } = {}) {
    this.depth++;
    try {
      for (const k of keys) this.handleKey(k);
    } catch (e) {
      if (!(e instanceof VimError) || !opts.catchErrors) throw e;
      this.pending = [];
      if (this.mode === 'insert' || this.mode === 'replace') this.leaveInsert();
      if (e.message) this.msg(e.message, 'error');
    } finally {
      this.depth--;
    }
  }

  private handleKey(key: Key) {
    if (this.confirm) return this.confirm.onKey(key);
    if (this.modal && this.modal(key)) { this.lastCommand = { keys: [key], kind: 'modal', error: false }; return; }
    switch (this.mode) {
      case 'insert':
      case 'replace':
        if (this.dotCapture) this.dotCapture.keys.push(key);
        if (this.depth === 0) this.cmdKeys.push(key);
        return this.insertKey(key);
      case 'cmdline':
        if (this.dotCapture && (this.cmdline?.type === '=' || this.pendingSearchOp)) this.dotCapture.keys.push(key);
        if (this.depth === 0) this.cmdKeys.push(key);
        return this.cmdlineKey(key);
      default:
        return this.normalKey(key);
    }
  }

  // ---- normal & visual parsing ---------------------------------------------------------

  private normalKey(key: Key) {
    if (this.pending.length === 0 && key === 'q' && this.recording) {
      this.stopRecording();
      if (this.depth === 0) { this.cmdKeys = [key]; this.finishCommand('other'); }
      return;
    }
    if (this.pending.length === 0 && key === '<CR>' && this.buf.kind === 'cmdwin') {
      const text = this.line();
      this.closeWindow();
      this.ex(text);
      return;
    }
    if (this.pending.length === 0) {
      if (this.depth === 0) this.message = null;
      if (!this.dotReplaying) this.dotCapture = { keys: [], replaying: false };
      if (this.depth === 0 && !this.visual) this.cmdKeys = [];
    }
    this.pending.push(key);
    if (this.depth === 0) this.cmdKeys.push(key);
    this.dotCapture?.keys.push(key);
    const res = this.parse(this.pending, this.visual ? 'v' : 'n');
    // <Esc> cancels a pending command, unless the keys before it already were one (`s` with a
    // plugin's `sa` mapped): then it runs and the <Esc> is handled after it, as after 'timeoutlen'.
    const completesBefore = res !== 'incomplete' && res !== 'invalid' && res.rest?.length === 1 && res.rest[0] === '<Esc>';
    if (key === '<Esc>' && this.pending.length > 1 && !completesBefore) {
      this.pending = [];
      if (this.depth === 0) this.finishCommand('other'); // a cancelled command is not part of the next one
      return;
    }
    if (res === 'incomplete') return;
    const keys = this.pending;
    this.pending = [];
    if (res === 'invalid') {
      if (keys.length === 1 && keys[0] === '<Esc>') {
        if (this.visual) this.exitVisual();
        if (this.depth === 0) this.finishCommand('other');
        return;
      }
      fail();
    }
    const rest = res.rest ?? [];
    if (rest.length) {
      if (this.depth === 0) this.cmdKeys.splice(-rest.length);
      this.dotCapture?.keys.splice(-rest.length);
    }
    this.execute(res, keys.slice(0, keys.length - rest.length));
    for (const k of rest) this.handleKey(k); // same depth and bookkeeping as the key that arrived
    if (this.oneShot && this.mode === 'normal' && this.insert) {
      this.oneShot = false;
      this.mode = 'insert';
      if (this.win.want === Infinity) this.win.cursor.col = this.line().length;
      this.clampCursor(true);
    }
  }

  private match(table: 'n' | 'v' | 'o', keys: Key[], i: number): { entry: Entry; end: number } | 'incomplete' | null {
    const LT = this.buf.localMaps[table] as Map<string, Entry>, LP = this.buf.localPrefixes[table];
    if (LT.size) {
      // Buffer-local maps win when they match.
      let exact: { entry: Entry; end: number } | null = null;
      for (let j = i + 1; j <= keys.length; j++) {
        const k = keyOf(keys.slice(i, j));
        const e = LT.get(k);
        if (e) exact = { entry: e, end: j };
        if (!LP.has(k)) break;
        if (j === keys.length) return 'incomplete';
      }
      if (exact) return exact;
    }
    const T = this.tables[table], P = this.prefixes[table];
    let exact: { entry: Entry; end: number } | null = null;
    for (let j = i + 1; j <= keys.length; j++) {
      const k = keyOf(keys.slice(i, j));
      const e = T.get(k);
      if (e) exact = { entry: e, end: j };
      if (!P.has(k)) return exact;
      if (j === keys.length) return 'incomplete';
    }
    return exact;
  }

  private parse(keys: Key[], mode: 'n' | 'v'): Parsed | 'incomplete' | 'invalid' {
    let i = 0;
    let reg: string | null = null;
    let count1 = '';
    for (;;) {
      if (keys[i] === '"') {
        if (i + 1 >= keys.length) return 'incomplete';
        if (!isValidRegister(keys[i + 1])) return 'invalid';
        reg = keys[i + 1];
        i += 2;
        continue;
      }
      if (/^[1-9]$/.test(keys[i] ?? '') || (count1 && keys[i] === '0')) {
        count1 += keys[i++];
        continue;
      }
      break;
    }
    if (i >= keys.length) return 'incomplete';
    const m = this.match(mode, keys, i);
    if (m === 'incomplete') return 'incomplete';
    if (!m) return 'invalid';
    let j = m.end;
    const cmdKeys = keys.slice(i, j);
    const e = m.entry;
    const base = { reg, count1: count1 ? +count1 : null, cmdKeys };

    const takeArg = (kind: 'char' | 'char2' | undefined): string | 'incomplete' | null => {
      if (!kind) return '';
      const need = kind === 'char2' ? 2 : 1;
      if (keys.length < j + need) return 'incomplete';
      const a = keys.slice(j, j + need);
      if (a.includes('<Esc>')) return null;
      j += need;
      return a.join('');
    };

    if (e.type === 'motion' || e.type === 'action' || e.type === 'map') {
      const akind = e.type === 'motion' ? e.spec.arg : e.type === 'action' ? e.spec.arg : undefined;
      let arg: string | null;
      if (akind === 'surround' || akind === 'tag') {
        const a = this.opArg(akind, keys, j);
        arg = a === 'incomplete' || a === null ? a : a.arg;
        if (a && a !== 'incomplete') j = a.end;
      } else arg = takeArg(akind);
      if (arg === 'incomplete') return 'incomplete';
      if (arg === null) return 'invalid';
      // Keys past the command came from a prefix ambiguity (`s` vs a plugin's `sa`): the command
      // runs and the rest is fed again, as Vim does after 'timeoutlen'.
      return { ...base, entry: e, arg, count2: null, target: null, rest: j < keys.length ? keys.slice(j) : undefined };
    }
    if (e.type === 'object') {
      if (mode !== 'v') return 'invalid';
      return { ...base, entry: e, arg: '', count2: null, target: null };
    }
    // operator
    if (mode === 'v') {
      // Visual operators can take an argument too (surround's S{char}).
      const after = this.opArg(e.spec.argAfter, keys, j);
      if (after === 'incomplete') return 'incomplete';
      if (after === null || (e.spec.argAfter && after.end < keys.length)) return 'invalid';
      return { ...base, entry: e, arg: after.arg, count2: null, target: null };
    }
    let count2 = '';
    while (j < keys.length && (/^[1-9]$/.test(keys[j]) || (count2 && keys[j] === '0'))) count2 += keys[j++];
    if (j >= keys.length) return 'incomplete';
    // Doubled operator: dd, gUU, gUgU, gcc, >>.
    const opStr = keyOf(cmdKeys);
    const last = cmdKeys[cmdKeys.length - 1];
    for (const self of cmdKeys.length > 1 ? [cmdKeys, [last]] : [cmdKeys]) {
      const slice = keys.slice(j, j + self.length);
      // gcgc: a same-named text object (Neovim's o_gc) wins over the doubled form.
      if (keyOf(slice) === keyOf(self) && !(self.length > 1 && this.tables.o.get(keyOf(self))?.type === 'object')) {
        j += self.length;
        const after = this.opArg(e.spec.argAfter, keys, j);
        if (after === 'incomplete') return 'incomplete';
        if (after === null || after.end < keys.length) return 'invalid';
        return { ...base, entry: e, arg: after.arg, count2: count2 ? +count2 : null, target: { kind: 'self' }, end: after.end, opStr };
      }
      if (slice.length < self.length && keyOf(self).startsWith(keyOf(slice)) && j + slice.length === keys.length && self.length > 1) {
        // Could still become gUgU; but may also be a motion prefix like g.
        const t0 = this.match('o', keys, j);
        if (t0 === 'incomplete' || !t0) return 'incomplete';
      }
    }
    // Forced motion type: v V <C-v>
    let force: VisualKind | null = null;
    if (keys[j] === 'v' || keys[j] === 'V' || keys[j] === '<C-v>') force = keys[j++] as VisualKind;
    if (j >= keys.length) return 'incomplete';
    const tStart = j;
    const t = this.match('o', keys, j);
    if (t === 'incomplete') return 'incomplete';
    if (!t) return 'invalid';
    const te = t.entry;
    if (te.type === 'action' && (keyOf(keys.slice(tStart, t.end)) === '/' || keyOf(keys.slice(tStart, t.end)) === '?') && t.end === keys.length) {
      return { ...base, entry: e, arg: '', count2: count2 ? +count2 : null, opStr, target: { kind: 'search', dir: keys[tStart] === '/' ? 1 : -1, force } };
    }
    if (te.type === 'motion' && te.spec.pick && t.end === keys.length) {
      // Interactive motion (flash): the target arrives later, like a search.
      return { ...base, entry: e, arg: '', count2: count2 ? +count2 : null, opStr, target: { kind: 'search', dir: 1, force, pick: te.spec.pick, keys: keys.slice(tStart, t.end) } };
    }
    if (te.type !== 'motion' && te.type !== 'object') return 'invalid';
    j = t.end;
    let marg = '';
    if (te.type === 'motion' && te.spec.arg) {
      const a = takeArg(te.spec.arg);
      if (a === 'incomplete') return 'incomplete';
      if (a === null) return 'invalid';
      marg = a;
    }
    const after = this.opArg(e.spec.argAfter, keys, j);
    if (after === 'incomplete') return 'incomplete';
    if (after === null) return 'invalid';
    if (after.end < keys.length) return 'invalid';
    return {
      ...base, entry: e, arg: after.arg, count2: count2 ? +count2 : null, opStr,
      target: { kind: 'entry', entry: te, keys: keys.slice(tStart, t.end), arg: marg, force },
      end: after.end,
    };
  }

  /** Operators like ys{motion}{char} need an argument after the motion. */
  private opArg(kind: OperatorSpec['argAfter'] | 'tag', keys: Key[], j: number): { arg: string; end: number } | 'incomplete' | null {
    if (!kind) return { arg: '', end: j };
    if (j >= keys.length) return 'incomplete';
    const k = keys[j];
    if (k === '<Esc>') return null;
    if (kind === 'tag') {
      // A name typed at a prompt: up to <CR>, or a whole <tag>.
      const close = keys.findIndex((x, idx) => idx >= j && (x === '<CR>' || (k === '<' && idx > j && x === '>')));
      if (close < 0) return 'incomplete';
      return { arg: keys.slice(j, close + 1).join(''), end: close + 1 };
    }
    if (kind === 'surround' && (k === 't' || k === '<' || k === 'f')) {
      // Tag or function name: read until <CR> or '>'.
      const close = keys.findIndex((x, idx) => idx > j && (x === '<CR>' || (k !== 'f' && x === '>')));
      if (close < 0) return 'incomplete';
      return { arg: keys.slice(j, close + 1).join(''), end: close + 1 };
    }
    return { arg: k, end: j + 1 };
  }

  // ---- execution -------------------------------------------------------------------

  private execute(p: Parsed, keys: Key[]) {
    const e = p.entry;
    const count = (p.count1 ?? 1) * (p.count2 ?? 1);
    const hasCount = p.count1 != null || p.count2 != null;
    const cmdStr = keysToString(p.cmdKeys);

    if (e.type === 'map') {
      if (typeof e.rhs === 'function') {
        if (e.change) this.beginChange();
        e.rhs({ count, hasCount, reg: p.reg, arg: p.arg, keys: cmdStr });
      } else {
        const pre: Key[] = [];
        if (p.reg) pre.push('"', p.reg);
        if (hasCount) pre.push(...String(count).split(''));
        this.dotCapture = null;
        this.runKeys([...pre, ...e.rhs]);
      }
      if (e.change) this.finishDot(p, keys);
      if (this.depth === 0) this.finishCommand(e.change ? 'action' : this.mode === 'insert' ? 'insert' : this.visual ? 'visual' : 'other');
      return;
    }

    if (e.type === 'motion') {
      const res = e.spec.run({ count, hasCount, arg: p.arg, op: null, visual: !!this.visual });
      if (!res) fail();
      if (res.jump) this.pushJump();
      this.applyMotion(res);
      if (res.openFold || res.jump) this.openFoldsAt(this.cursor.line);
      this.dotCapture = null;
      if (this.depth === 0) this.finishCommand(this.visual ? 'visual' : 'motion');
      return;
    }

    if (e.type === 'object') {
      // Visual mode: extend the selection to the object.
      const v = this.visual!;
      const [s, en] = this.visualBounds();
      const r = e.obj({ lines: this.lines, cur: this.cursor, count, visual: cmpPos(s, en) === 0 ? null : { start: s, end: en } }, e.inner);
      if (!r) fail();
      if (r.kind === 'line' && v.kind === 'v') v.kind = 'V';
      if (r.kind === 'char' && v.kind === 'V' && r.start.line === r.end.line) v.kind = 'v';
      v.anchor = r.start;
      this.win.cursor = { ...r.end };
      this.win.want = r.end.col;
      this.dotCapture = null;
      if (this.depth === 0) this.finishCommand('visual');
      return;
    }

    if (e.type === 'action') {
      const change = !!e.spec.change;
      if (change) this.beginChange(this.visual ? (this.visual.kind === 'V' ? pos(this.visualRange().start.line, 0) : this.visualRange().start) : undefined);
      const shape = this.visual ? this.visualShape() : undefined;
      e.spec.run({ count, hasCount, reg: p.reg, arg: p.arg, keys: cmdStr });
      if (change) this.finishDot(p, keys, shape);
      else if (this.mode !== 'insert') this.dotCapture = null;
      if (this.depth === 0) {
        if (this.mode === 'cmdline') this.lastCommand = null; // completes on <CR>
        else this.finishCommand(cmdStr === 'u' || cmdStr === '<C-r>' ? 'undo' : this.mode === 'insert' || this.mode === 'replace' ? 'insert' : this.visual ? 'visual' : change ? 'action' : 'other');
      }
      return;
    }

    // Operators
    const op = e.spec;
    const ctx: OpCtx = { reg: p.reg, count, hasCount, visual: this.visual?.kind ?? null, keys: cmdStr };
    let range: Range;
    let dotVisual: LastChange['visual'];
    if (this.visual) {
      range = this.visualRange();
      dotVisual = this.visualShape();
      this.exitVisual();
      this.win.cursor = { ...range.start };
      if (range.kind === 'block') this.win.cursor.col = Math.min(range.start.col, range.end.col);
    } else if (p.target?.kind === 'search') {
      const target = p.target;
      const start = { ...this.cursor };
      this.pendingSearchCount = count;
      this.pendingSearchOp = res => {
        let a = start, b = res.pos;
        const back = cmpPos(b, a) < 0;
        if (back) [a, b] = [b, a];
        let r: Range;
        if (res.linewise) r = { start: pos(a.line, 0), end: pos(b.line, 0), kind: 'line' };
        else if (res.inclusive) r = { start: a, end: b, kind: 'char' };
        else {
          if (cmpPos(a, b) === 0) fail();
          r = { start: a, end: b.col > 0 ? pos(b.line, b.col - 1) : pos(b.line - 1, this.line(b.line - 1).length), kind: 'char' };
        }
        r = this.forceKind(r, target.force);
        this.win.cursor = { ...start };
        if (op.change) this.beginChange(this.opUndoCursor(p, r));
        op.run(r, { ...ctx, keys: cmdStr });
        if (op.change) this.finishDot(p, keys);
        if (this.depth === 0) this.finishCommand(this.mode === 'insert' ? 'insert' : op.change ? 'operator' : 'other');
      };
      if (target.pick) {
        target.pick((res, typed) => {
          target.typed = typed;
          const f = this.pendingSearchOp;
          this.pendingSearchOp = null;
          f?.(res);
        }, () => { this.pendingSearchOp = null; });
      } else this.openSearchFor(target.dir);
      this.lastCommand = null;
      return;
    } else {
      const r = this.operatorRange(p, count, hasCount);
      if (!r) fail();
      range = r;
    }
    if (op.change) this.beginChange(this.visual || dotVisual ? undefined : this.opUndoCursor(p, range));
    (this as { opArgument?: string }).opArgument = p.arg;
    op.run(range, { ...ctx, keys: cmdStr + (p.arg ? `\u0000${p.arg}` : '') });
    if (op.change) this.finishDot(p, keys, dotVisual);
    else if (this.mode !== 'insert') this.dotCapture = null;
    if (this.depth === 0) this.finishCommand(this.mode === 'insert' ? 'insert' : op.change ? 'operator' : 'other');
  }

  /** Argument read after the motion for operators with argAfter. */
  opArgument = '';

  private operatorRange(p: Parsed, count: number, hasCount: boolean): Range | null {
    const t = p.target!;
    if (t.kind === 'self') {
      const start = this.cursor.line;
      const end = start + count - 1;
      if (end >= this.buf.lineCount) {
        if (start === this.buf.lineCount - 1 || count > 1) {
          return { start: pos(start, 0), end: pos(this.buf.lineCount - 1, 0), kind: 'line' };
        }
        return null;
      }
      return { start: pos(start, 0), end: pos(end, 0), kind: 'line' };
    }
    if (t.kind !== 'entry') return null;
    const te = t.entry;
    const cur = { ...this.cursor };
    if (te.type === 'object') {
      const r = te.obj({ lines: this.lines, cur, count, visual: null }, te.inner);
      if (!r) return null;
      // Word objects report Vim's inclusive flag; apply the charwise operator rules.
      if ('inclusive' in r && typeof r.inclusive === 'boolean') {
        return this.vimCharwiseRange(r.start, r.end, r.inclusive, keysToString(p.cmdKeys) === 'd', t.force, true);
      }
      return this.forceKind(r, t.force);
    }
    if (te.type === 'map') {
      if (typeof te.rhs === 'function') return null;
      return null;
    }
    if (te.type !== 'motion') return null;
    const opKeys = keysToString(p.cmdKeys);
    const mkeys = keysToString(t.keys);
    // cw / cW on a non-blank act like ce / cE.
    const spec = te.spec;
    if (opKeys === 'c' && (mkeys === 'w' || mkeys === 'W')) {
      const ch = this.line()[cur.col];
      if (ch !== undefined && ch !== ' ' && ch !== '\t') {
        const res0 = this.wordEndForChange(mkeys === 'W', count);
        if (res0) return this.forceKind({ start: cur, end: res0, kind: 'char' }, t.force);
      }
    }
    if (mkeys === 'w' || mkeys === 'W') return this.operatorWordRange(mkeys === 'W', count, opKeys === 'd', t.force);
    const res = spec.run({ count, hasCount, arg: t.arg, op: opKeys, visual: false });
    if (!res) return null;
    if (res.jump) this.pushJump(cur);
    let start = cur, end = res.pos;
    const backwards = cmpPos(end, start) < 0;
    if (backwards) [start, end] = [end, start];
    if (res.linewise) return this.forceKind({ start: pos(start.line, 0), end: pos(end.line, 0), kind: 'line' }, t.force);
    if (res.inclusive) return this.forceKind({ start, end, kind: 'char' }, t.force);
    // Exclusive motion.
    if (cmpPos(start, end) === 0) return t.force ? this.forceKind({ start, end, kind: 'char' }, t.force) : null;
    if (end.col === 0 && end.line > start.line && !t.force) {
      // Exclusive-to-linewise rule (:help exclusive-linewise).
      const prevLen = this.line(end.line - 1).length;
      if (start.col <= firstNonBlank(this.line(start.line)) && this.line(start.line).slice(0, start.col).trim() === '') {
        return { start: pos(start.line, 0), end: pos(end.line - 1, 0), kind: 'line' };
      }
      return { start, end: pos(end.line - 1, Math.max(0, prevLen)), kind: 'char' };
    }
    end = end.col > 0 ? pos(end.line, end.col - 1) : pos(end.line - 1, this.line(end.line - 1).length);
    return this.forceKind({ start, end, kind: 'char' }, t.force);
  }

  /** cw/cW: like ce/cE, but a cursor on a word's last character stays put. */
  private wordEndForChange(big: boolean, count: number): Pos | null {
    const cls = (ch: string | undefined) => (ch === undefined || /\s/.test(ch) ? 0 : big ? 2 : /\w/.test(ch) ? 2 : 1);
    const e = this.tables.o.get(big ? 'E' : 'e');
    if (!e || e.type !== 'motion') return null;
    let p = { ...this.cursor };
    const save = this.win.cursor;
    try {
      for (let n = 0; n < count; n++) {
        const line = this.line(p.line);
        const k = cls(line[p.col]);
        if (n === 0 && k !== 0 && cls(line[p.col + 1]) !== k) continue;
        this.win.cursor = p;
        const r = e.spec.run({ count: 1, hasCount: false, arg: '', op: 'c', visual: false });
        if (!r) {
          // Out of words: Vim's end_word() fails past the last one, and the
          // operator still runs to the buffer's last character.
          const last = this.buf.lineCount - 1;
          return pos(last, Math.max(0, this.line(last).length - 1));
        }
        p = r.pos;
      }
    } finally {
      this.win.cursor = save;
    }
    return p;
  }

  /**
   * w / W under an operator, after Vim's fwd_word(count, eol = TRUE) and
   * adjust_cursor(): the last word stops at its line's end (so dw never joins
   * lines) and running out of words ends at the end of the buffer. Then the
   * exclusive-linewise rule and d's own linewise rule (:help d).
   */
  private operatorWordRange(big: boolean, count: number, isDelete: boolean, force: VisualKind | null): Range | null {
    const L = this.lines, last = L.length - 1;
    const start = { ...this.cursor };
    const cls = (q: Pos) => {
      const ch = L[q.line][q.col];
      return ch === undefined || ch === ' ' || ch === '\t' ? 0 : big || /[\wÀ-￿]/.test(ch) ? 2 : 1;
    };
    let p = { ...start };
    // inc_cursor(): 0 same line, 2 onto the line's end, 1 next line, -1 end of buffer.
    const inc = () => {
      const len = L[p.line].length;
      if (p.col < len) { p = pos(p.line, p.col + 1); return p.col < len ? 0 : 2; }
      if (p.line < last) { p = pos(p.line + 1, 0); return 1; }
      return -1;
    };
    words: for (let n = count - 1; n >= 0; n--) {
      const sclass = cls(p);
      const lastLine = p.line === last;
      let i = inc();
      if (i === -1 || (i >= 1 && lastLine)) break; // no more words
      if (i >= 1 && n === 0) break; // started on the last char of the line
      if (sclass !== 0) {
        while (cls(p) === sclass) {
          i = inc();
          if (i === -1 || (i >= 1 && n === 0)) break words;
        }
      }
      while (cls(p) === 0) {
        if (p.col === 0 && L[p.line].length === 0) break; // an empty line is a word
        i = inc();
        if (i === -1 || (i >= 1 && n === 0)) break words;
      }
    }
    let inclusive = false;
    if (cmpPos(start, p) < 0 && p.col > 0 && p.col >= L[p.line].length) {
      p = pos(p.line, p.col - 1);
      inclusive = true;
    }
    return this.vimCharwiseRange(start, p, inclusive, isDelete, force, false);
  }

  /**
   * Turn a charwise operator region in Vim's terms (end position plus an
   * inclusive flag) into a Range: o_v / o_V / o_CTRL-V, the exclusive-linewise
   * rule, d's linewise rule (:help d), and an end on a line's NUL. An empty
   * region is null, or (allowEmpty) a zero-width range the operator can run on.
   */
  private vimCharwiseRange(start: Pos, end: Pos, inclusive: boolean, isDelete: boolean, force: VisualKind | null, allowEmpty: boolean): Range | null {
    const L = this.lines;
    let p = end;
    if (force === 'V' || force === '<C-v>') return this.forceKind({ start, end: p, kind: 'char' }, force);
    if (force === 'v') inclusive = !inclusive;
    const inIndent = /^[ \t]*$/.test(L[start.line].slice(0, start.col));
    if (!inclusive && p.col === 0 && p.line > start.line) {
      // :help exclusive-linewise
      if (inIndent) return { start: pos(start.line, 0), end: pos(p.line - 1, 0), kind: 'line' };
      const len = L[p.line - 1].length;
      p = pos(p.line - 1, Math.max(0, len - 1));
      inclusive = len > 0;
    }
    // :help d — a multi-line delete from the indent to a line's end is linewise.
    if (isDelete && !force && p.line > start.line && inIndent && /^[ \t]*$/.test(L[p.line].slice(p.col + (inclusive ? 1 : 0)))) {
      return { start: pos(start.line, 0), end: pos(p.line, 0), kind: 'line' };
    }
    // Inclusive of a line's NUL covers nothing more than exclusive of it.
    if (inclusive && p.col >= L[p.line].length) { inclusive = false; p = pos(p.line, L[p.line].length); }
    if (!inclusive) {
      if (cmpPos(start, p) >= 0) return allowEmpty ? { start, end: pos(start.line, start.col - 1), kind: 'char' } : null;
      p = p.col > 0 ? pos(p.line, p.col - 1) : pos(p.line - 1, L[p.line - 1].length);
    }
    return { start, end: p, kind: 'char' };
  }

  private forceKind(r: Range, force: VisualKind | null): Range {
    if (!force) return r;
    if (force === 'V') return { start: pos(r.start.line, 0), end: pos(r.end.line, 0), kind: 'line' };
    if (force === '<C-v>') return { ...r, kind: 'block' };
    if (r.kind === 'line') return { start: pos(r.start.line, 0), end: pos(r.end.line, Math.max(0, this.line(r.end.line).length - 1)), kind: 'char' };
    return r;
  }

  applyMotion(res: MotionResult) {
    const cur = this.win.cursor;
    cur.line = Math.max(0, Math.min(res.pos.line, this.buf.lineCount - 1));
    cur.col = res.pos.col;
    this.clampCursor(this.mode === 'visual' && this.visual?.kind !== 'v' ? false : this.mode === 'visual');
    if (this.visual) cur.col = Math.min(cur.col, Math.max(0, this.line().length - (this.line().length ? 1 : 0)));
    if (res.want !== undefined) this.win.want = res.want;
    else if (!res.keepWant) this.win.want = cur.col;
    if (this.visual?.kind === '<C-v>') this.visual.toEol = res.want === Infinity;
  }

  private finishDot(p: Parsed, _keys: Key[], visual?: LastChange['visual']) {
    if (this.dotReplaying || !this.dotCapture) return;
    const body = [...p.cmdKeys];
    if (p.target?.kind === 'self') body.push(p.cmdKeys[p.cmdKeys.length - 1]);
    if (p.target?.kind === 'search') {
      if (p.target.force) body.push(p.target.force);
      if (p.target.pick) body.push(...(p.target.keys ?? []), ...(p.target.typed ?? []));
      else body.push(...(this.dotCapture?.keys.slice(this.dotCapture.keys.lastIndexOf(p.target.dir === 1 ? '/' : '?')) ?? []));
    }
    if (p.target?.kind === 'entry') {
      if (p.target.force) body.push(p.target.force);
      body.push(...p.target.keys);
      if (p.target.arg) body.push(...p.target.arg.split(''));
    }
    if (p.arg) body.push(...parseKeys(p.arg));
    const count = p.count1 != null || p.count2 != null ? (p.count1 ?? 1) * (p.count2 ?? 1) : null;
    const change: LastChange = { reg: p.reg, count, body, insert: [], visual };
    if (this.mode === 'insert' || this.mode === 'replace') {
      this.pendingDot = change;
    } else {
      this.lastChange = change;
    }
    this.dotCapture = this.mode === 'insert' || this.mode === 'replace' ? { keys: [], replaying: false } : null;
  }
  private pendingDot: LastChange | null = null;
  /** <C-o> in insert mode: run one normal command, then return to insert. */
  private oneShot = false;

  /** Repeat the last change (.). */
  repeatChange(count: number | null) {
    const c = this.lastChange;
    if (!c) return;
    const keys: Key[] = [];
    let reg = c.reg;
    if (reg && /^[1-8]$/.test(reg)) {
      reg = String(+reg + 1);
      c.reg = reg;
    }
    if (reg) keys.push('"', reg);
    const n = count ?? c.count;
    if (c.visual) {
      // Re-create a selection of the same shape at the cursor.
      const cur = { ...this.cursor };
      this.visual = { kind: c.visual.kind, anchor: cur, toEol: c.visual.toEol };
      this.mode = 'visual';
      const endLine = Math.min(this.buf.lineCount - 1, cur.line + c.visual.lines);
      this.win.cursor = pos(endLine, c.visual.kind === 'V' ? cur.col : c.visual.lines ? c.visual.cols + (c.visual.kind === 'v' ? 0 : cur.col) : cur.col + c.visual.cols);
      this.dotReplaying = true;
      try {
        this.runKeys([...keys, ...c.body, ...c.insert]);
      } finally {
        this.dotReplaying = false;
      }
      return;
    }
    if (n != null) keys.push(...String(n).split(''));
    this.dotReplaying = true;
    try {
      this.runKeys([...keys, ...c.body, ...c.insert]);
    } finally {
      this.dotReplaying = false;
    }
  }

  // ---- visual mode ---------------------------------------------------------------------

  enterVisual(kind: VisualKind) {
    if (this.visual) {
      if (this.visual.kind === kind) return this.exitVisual();
      this.visual.kind = kind;
      return;
    }
    this.visual = { kind, anchor: { ...this.cursor }, toEol: false };
    this.mode = 'visual';
  }

  exitVisual() {
    if (!this.visual) return;
    const [s, e] = this.visualBounds();
    this.lastVisual = { kind: this.visual.kind, start: { ...s }, end: { ...e }, toEol: this.visual.toEol, buf: this.buf }; // copies: bounds may alias the cursor
    const r = this.visualRange();
    this.buf.marks.set('<', r.kind === 'line' ? pos(r.start.line, 0) : r.kind === 'block' ? pos(r.start.line, Math.min(r.start.col, r.end.col)) : r.start);
    this.buf.marks.set('>', r.kind === 'line' ? pos(r.end.line, Math.max(0, this.line(r.end.line).length - 1)) : r.kind === 'block' ? pos(r.end.line, Math.max(r.start.col, r.end.col)) : r.end);
    this.visual = null;
    this.mode = 'normal';
    this.clampCursor(false);
  }

  /** Size of the selection, for repeating a visual-mode change with '.'. */
  private visualShape(): LastChange['visual'] {
    const r = this.visualRange();
    return {
      kind: this.visual!.kind, lines: r.end.line - r.start.line,
      cols: r.kind === 'block' ? Math.abs(r.end.col - r.start.col) : r.end.col - r.start.col,
      toEol: this.visual!.toEol,
    };
  }

  visualBounds(): [Pos, Pos] {
    const v = this.visual!;
    return [minPos(v.anchor, this.cursor), maxPos(v.anchor, this.cursor)];
  }

  visualRange(): Range {
    const v = this.visual!;
    const [s, e] = this.visualBounds();
    if (v.kind === 'V') return { start: pos(s.line, 0), end: pos(e.line, 0), kind: 'line' };
    if (v.kind === '<C-v>') {
      const c1 = Math.min(v.anchor.col, this.cursor.col), c2 = Math.max(v.anchor.col, this.cursor.col);
      return { start: pos(s.line, c1), end: pos(e.line, c2), kind: 'block', toEol: v.toEol };
    }
    const endLen = this.line(e.line).length;
    return { start: s, end: pos(e.line, Math.min(e.col, Math.max(0, endLen - 1)) + (endLen === 0 ? 0 : 0)), kind: 'char' };
  }

  reselectVisual() {
    const lv = this.lastVisual;
    if (!lv || lv.buf !== this.buf) fail();
    this.visual = { kind: lv.kind, anchor: { ...lv.start }, toEol: lv.toEol };
    this.mode = 'visual';
    this.win.cursor = pos(Math.min(lv.end.line, this.buf.lineCount - 1), lv.end.col);
  }

  // ---- insert mode ---------------------------------------------------------------------

  startInsert(kind: string, at: Pos, count = 1, extra: Partial<InsertState> = {}) {
    this.mode = kind === 'R' ? 'replace' : 'insert';
    this.win.cursor = { ...at };
    this.clampCursor(true);
    this.insert = { kind, start: { ...this.cursor }, keys: [], count, pending: '', pendingBuf: '', typed: '', replaced: new Map(), ...extra };
    this.buf.marks.set('[', { ...this.cursor });
  }

  private insertKey(key: Key): void {
    const ins = this.insert!;
    if (ins.pending) return this.insertPending(key);
    const mapped = this.insertMaps.get(key);
    if (mapped && mapped(this) !== false) return;
    if (ins.completion && !['<C-n>', '<C-p>', '<C-y>', '<C-e>', '<Down>', '<Up>'].includes(key)) ins.completion = undefined;
    const b = this.buf, c = this.win.cursor;
    const typeChar = (ch: string) => {
      if (this.mode === 'replace' && c.col < this.line().length && ch !== '\n') {
        const k = `${c.line}:${c.col}`;
        if (!ins.replaced!.has(k)) ins.replaced!.set(k, this.line()[c.col]);
        const t = this.line();
        b.setLine(c.line, t.slice(0, c.col) + ch + t.slice(c.col + 1));
        c.col++;
        b.recordChange({ ...c });
      } else {
        const end = this.insertText(c, ch);
        this.win.cursor = end;
      }
      ins.keys.push(key);
      ins.typed += ch;
    };
    switch (key) {
      case '<Esc>':
      case '<C-c>':
        return this.leaveInsert();
      case '<CR>':
      case '<C-j>':
      case '<C-m>': {
        const indent = this.opt('autoindent') ? indentOf(this.line()) : '';
        const t = this.line();
        const rest = t.slice(c.col);
        b.setLine(c.line, t.slice(0, c.col).replace(/[ \t]+$/, (m) => (t.slice(0, c.col).trim() ? '' : m)));
        b.splice(c.line + 1, 0, [indent + rest.replace(/^[ \t]+/, '')]);
        this.win.cursor = pos(c.line + 1, indent.length);
        b.recordChange({ ...this.cursor });
        ins.keys.push(key);
        ins.typed += '\n';
        return;
      }
      case '<BS>':
      case '<C-h>': {
        ins.keys.push(key);
        ins.typed = ins.typed.slice(0, -1);
        if (this.mode === 'replace') {
          if (c.col === 0) return;
          c.col--;
          const orig = ins.replaced!.get(`${c.line}:${c.col}`);
          if (orig !== undefined) {
            const t = this.line();
            b.setLine(c.line, t.slice(0, c.col) + orig + t.slice(c.col + 1));
          }
          return;
        }
        if (c.col > 0) {
          const t = this.line();
          b.setLine(c.line, t.slice(0, c.col - 1) + t.slice(c.col));
          c.col--;
        } else if (c.line > 0) {
          const prev = this.line(c.line - 1);
          b.splice(c.line - 1, 2, [prev + this.line()]);
          this.win.cursor = pos(c.line - 1, prev.length);
        }
        return;
      }
      case '<Del>': {
        const t = this.line();
        if (c.col < t.length) b.setLine(c.line, t.slice(0, c.col) + t.slice(c.col + 1));
        else if (c.line + 1 < b.lineCount) b.splice(c.line, 2, [t + this.line(c.line + 1)]);
        ins.keys.push(key);
        return;
      }
      case '<Tab>': {
        const sw = Number(this.opt('shiftwidth')) || 8;
        typeChar(this.opt('expandtab') ? ' '.repeat(sw - (c.col % sw)) : '\t');
        return;
      }
      case '<C-w>': {
        const t = this.line();
        const before = t.slice(0, c.col);
        const m = /(\w+|[^\w\s]+)?\s*$/.exec(before)!;
        const cut = m[0].length || (c.col > 0 ? 1 : 0);
        if (cut === 0 && c.line > 0) return this.insertKey('<BS>');
        b.setLine(c.line, before.slice(0, before.length - cut) + t.slice(c.col));
        c.col -= cut;
        ins.keys.push(key);
        return;
      }
      case '<C-u>': {
        const t = this.line();
        const stop = ins.start.line === c.line && ins.start.col < c.col ? ins.start.col : indentOf(t).length < c.col ? indentOf(t).length : 0;
        b.setLine(c.line, t.slice(0, stop) + t.slice(c.col));
        c.col = stop;
        ins.keys.push(key);
        return;
      }
      case '<C-t>':
      case '<C-d>': {
        const sw = Number(this.opt('shiftwidth')) || 8;
        const t = this.line();
        const ind = indentOf(t).length;
        const nind = key === '<C-t>' ? ind + sw - (ind % sw) : Math.max(0, ind - (ind % sw || sw));
        b.setLine(c.line, ' '.repeat(nind) + t.slice(ind));
        c.col = Math.max(0, c.col + nind - ind);
        ins.keys.push(key);
        return;
      }
      case '<C-r>': ins.pending = 'ctrl-r'; ins.keys.push(key); return;
      case '<C-v>':
      case '<C-q>': ins.pending = 'ctrl-v'; ins.pendingBuf = ''; ins.keys.push(key); return;
      case '<C-k>': ins.pending = 'ctrl-k'; ins.pendingBuf = ''; ins.keys.push(key); return;
      case '<C-x>': ins.pending = 'ctrl-x'; ins.keys.push(key); return;
      case '<C-g>': ins.pending = 'ctrl-g'; ins.keys.push(key); return;
      case '<C-a>': for (const ch of this.lastInserted) typeChar(ch === '\n' ? '\n' : ch); return;
      case '<C-e>':
      case '<C-y>': {
        if (ins.completion) {
          if (key === '<C-e>') {
            const cp = ins.completion;
            const t = this.line(cp.line);
            b.setLine(cp.line, t.slice(0, cp.startCol) + cp.orig + t.slice(c.col));
            c.col = cp.startCol + cp.orig.length;
          }
          ins.completion = undefined;
          return;
        }
        const other = this.line(c.line + (key === '<C-e>' ? 1 : -1));
        if (other && c.col < other.length) typeChar(other[c.col]);
        return;
      }
      case '<C-n>':
      case '<C-p>':
      case '<Down>':
      case '<Up>':
        if (key === '<Down>' || key === '<Up>') {
          if (!ins.completion) {
            this.win.cursor = pos(Math.max(0, Math.min(b.lineCount - 1, c.line + (key === '<Down>' ? 1 : -1))), c.col);
            this.clampCursor(true);
            return;
          }
        }
        ins.keys.push(key);
        return this.complete(key === '<C-n>' || key === '<Down>' ? 1 : -1, 'word');
      case '<C-o>':
        ins.keys.push(key);
        this.oneShot = true;
        this.mode = 'normal';
        return;
      case '<Left>': if (c.col > 0) c.col--; ins.start = { ...c }; return;
      case '<Right>': if (c.col < this.line().length) c.col++; ins.start = { ...c }; return;
      case '<Home>': c.col = 0; return;
      case '<End>': c.col = this.line().length; return;
    }
    if (key.length === 1) return typeChar(key);
    if (key === '<Space>') return typeChar(' ');
    // Unknown special keys are ignored in insert mode.
  }

  private insertPending(key: Key) {
    const ins = this.insert!;
    ins.keys.push(key);
    const kind = ins.pending;
    if (key === '<Esc>' && kind !== 'ctrl-v') {
      ins.pending = '';
      return;
    }
    if (kind === 'ctrl-g') {
      ins.pending = '';
      // <C-g>u: close the undo block so far and start a new one here. A dot repeat replays
      // the whole insert as one change, as in Vim.
      if (key === 'u' && this.snapshotTaken && !this.dotReplaying) {
        this.buf.dropSnapshotIfUnchanged();
        this.buf.snapshot(this.cursor, () => this.cursor);
      }
      return;
    }
    if (kind === 'ctrl-r') {
      if (key === '<C-w>' || key === '<C-r>' || key === '<C-o>' || key === '<C-p>') return; // literal variants: wait for the register
      ins.pending = '';
      if (key === '=') {
        this.openCmdline('=', '', text => {
          const v = this.evalExpr(text);
          this.mode = 'insert';
          this.typeText(v);
        }, () => { this.mode = 'insert'; });
        this.mode = 'cmdline';
        return;
      }
      const r = this.getRegister(key);
      this.typeText(r.kind === 'line' && !r.text.endsWith('\n') ? r.text + '\n' : r.text);
      return;
    }
    if (kind === 'ctrl-v') {
      const buf = ins.pendingBuf + (key.length === 1 ? key : '');
      if (ins.pendingBuf === '' && key.length === 1 && /[uUxXoO0-9]/.test(key)) {
        ins.pendingBuf = key;
        if (/[0-9]/.test(key)) ins.pendingBuf = key;
        return;
      }
      if (ins.pendingBuf) {
        const mode = /[0-9]/.test(ins.pendingBuf[0]) ? 'd' : ins.pendingBuf[0].toLowerCase();
        const digits = buf.slice(mode === 'd' ? 0 : 1);
        const max = mode === 'u' ? (ins.pendingBuf[0] === 'U' ? 8 : 4) : mode === 'x' ? 2 : 3;
        const valid = mode === 'd' ? /^[0-9]*$/ : mode === 'o' ? /^[0-7]*$/ : /^[0-9a-fA-F]*$/;
        if (valid.test(digits) && digits.length < max && key.length === 1) {
          ins.pendingBuf = buf;
          return;
        }
        const done = valid.test(digits) ? digits : digits.slice(0, -1);
        ins.pending = '';
        ins.pendingBuf = '';
        const code = parseInt(done, mode === 'd' ? 10 : mode === 'o' ? 8 : 16);
        if (!isNaN(code)) this.typeText(String.fromCodePoint(code));
        if (!valid.test(digits) || key.length !== 1) this.insertKey(key);
        return;
      }
      ins.pending = '';
      const lit: Record<string, string> = { '<Tab>': '\t', '<CR>': '\r', '<Esc>': '\x1b' };
      this.typeText(key.length === 1 ? key : lit[key] ?? '');
      return;
    }
    if (kind === 'ctrl-k') {
      ins.pendingBuf += key;
      if (ins.pendingBuf.length < 2) return;
      ins.pending = '';
      const d = DIGRAPHS[ins.pendingBuf] ?? DIGRAPHS[ins.pendingBuf[1] + ins.pendingBuf[0]];
      this.typeText(d ?? ins.pendingBuf[1]);
      ins.pendingBuf = '';
      return;
    }
    if (kind === 'ctrl-x') {
      ins.pending = '';
      if (key === '<C-l>') return this.complete(1, 'line');
      if (key === '<C-f>') return this.complete(1, 'file');
      if (key === '<C-n>' || key === '<C-p>') return this.complete(key === '<C-n>' ? 1 : -1, 'word');
      if (key === '<C-o>') return this.complete(1, 'word');
      return;
    }
  }

  /** Insert text as if typed (used by <C-r>, completion). */
  typeText(text: string) {
    const c = this.cursor;
    const end = this.insertText(c, text);
    this.win.cursor = end;
    if (this.insert) this.insert.typed += text;
  }

  private complete(dir: 1 | -1, kind: 'word' | 'line' | 'file') {
    const ins = this.insert!;
    const c = this.cursor;
    if (ins.completion && ins.completion.items.length) {
      const cp = ins.completion;
      cp.idx = (cp.idx + dir + cp.items.length + 1) % (cp.items.length + 1);
      const word = cp.idx === cp.items.length ? cp.orig : cp.items[cp.idx];
      const t = this.line(cp.line);
      this.buf.setLine(cp.line, t.slice(0, cp.startCol) + word + t.slice(c.col));
      c.col = cp.startCol + word.length;
      return;
    }
    const t = this.line();
    let startCol: number, prefix: string, items: string[];
    if (kind === 'line') {
      startCol = indentOf(t).length;
      prefix = t.slice(startCol, c.col);
      const seen = new Set<string>();
      items = [];
      // Like Vim, search backwards from the cursor line (wrapping), then other buffers.
      const L = this.lines;
      const all = [...L.slice(0, c.line).reverse(), ...L.slice(c.line + 1).reverse(), ...this.buffers.filter(b => b.kind === 'file' && b !== this.buf).flatMap(b => b.lines)];
      for (const l of all) {
        const s = l.trim();
        if (s && s.startsWith(prefix) && s !== prefix && !seen.has(s)) { seen.add(s); items.push(s); }
      }
    } else if (kind === 'file') {
      const m = /[\w./~-]*$/.exec(t.slice(0, c.col))!;
      startCol = c.col - m[0].length;
      prefix = m[0];
      const dir = prefix.includes('/') ? prefix.slice(0, prefix.lastIndexOf('/') + 1) : '';
      items = this.fs.readdir(dir.replace(/^\.\//, '')).map(n => dir + n).filter(n => n.startsWith(prefix) && n !== prefix);
    } else {
      const m = /\w*$/.exec(t.slice(0, c.col))!;
      startCol = c.col - m[0].length;
      prefix = m[0];
      const words: string[] = [];
      const seen = new Set<string>();
      // Search order: forward from the cursor for <C-n>, backward for <C-p>; other buffers last.
      const fwd = [t.slice(c.col), ...this.lines.slice(c.line + 1), ...this.lines.slice(0, c.line), t.slice(0, startCol)].flatMap(l => l.match(/\w+/g) ?? []);
      const order = dir === 1 ? fwd : fwd.reverse();
      for (const w of order) {
        if (w.startsWith(prefix) && w !== prefix && !seen.has(w)) { seen.add(w); words.push(w); }
      }
      for (const b of this.buffers) if (b !== this.buf) for (const l of b.lines) for (const w of l.match(/\w+/g) ?? []) {
        if (w.startsWith(prefix) && w !== prefix && !seen.has(w)) { seen.add(w); words.push(w); }
      }
      // The list reads in forward order; <C-p> starts at its end (the nearest match above).
      items = dir === 1 ? words : words.reverse();
    }
    if (!items.length) {
      this.msg('-- Pattern not found', 'error');
      return;
    }
    ins.completion = { items, idx: dir === 1 ? 0 : items.length - 1, startCol, line: c.line, orig: prefix };
    const word = items[ins.completion.idx];
    this.buf.setLine(c.line, t.slice(0, startCol) + word + t.slice(c.col));
    c.col = startCol + word.length;
  }

  leaveInsert() {
    const ins = this.insert;
    if (!ins) {
      this.mode = 'normal';
      return;
    }
    // Repeat the insert for a count (3ia<Esc>, 2o...).
    if (ins.count > 1 && ins.typed && !ins.block) {
      const typed = ins.typed;
      ins.typed = typed;
      for (let n = 1; n < ins.count; n++) {
        if (ins.kind === 'o' || ins.kind === 'O') {
          const indent = indentOf(this.line());
          this.buf.splice(this.cursor.line + 1, 0, [indent + typed]);
          this.win.cursor = pos(this.cursor.line + 1, indent.length + typed.length);
        } else if (this.mode === 'replace') {
          for (const ch of typed) {
            const t = this.line(), c = this.cursor;
            this.buf.setLine(c.line, t.slice(0, c.col) + ch + t.slice(c.col + 1));
            c.col++;
          }
        } else this.typeText(typed);
      }
      ins.typed = typed;
    }
    if (ins.block && ins.typed && !ins.typed.includes('\n')) {
      const { first, last, col, append, toEol } = ins.block;
      for (let l = first + 1; l <= last; l++) {
        const t = this.line(l);
        if (append && toEol) this.buf.setLine(l, t + ins.typed);
        else if (t.length >= col || append) this.buf.setLine(l, t.padEnd(col) .slice(0, Math.max(col, append ? col : 0)) + ins.typed + t.slice(col));
      }
    }
    // Remove whitespace-only line left by o/O/cc when leaving immediately.
    const typedNothing = ins.typed === '' && (ins.kind === 'o' || ins.kind === 'O' || ins.kind === 'cc');
    if (typedNothing && this.line().trim() === '' && this.line() !== '') this.buf.setLine(this.cursor.line, '');
    this.lastInserted = ins.typed;
    this.buf.marks.set('^', { ...this.cursor });
    this.buf.marks.set(']', pos(this.cursor.line, Math.max(0, this.cursor.col - 1)));
    this.insert = null;
    this.mode = 'normal';
    if (this.cursor.col > 0) this.win.cursor.col--;
    this.clampCursor(false);
    this.win.want = this.cursor.col;
    if (this.pendingDot && this.dotCapture) {
      this.pendingDot.insert = this.dotCapture.keys.slice();
      this.lastChange = this.pendingDot;
    }
    this.pendingDot = null;
    this.dotCapture = null;
    this.emit('insert-leave');
    if (this.depth === 0) this.finishCommand('insert');
  }

  // ---- command line ----------------------------------------------------------------------

  openCmdline(type: Cmdline['type'], initial = '', onSubmit?: (t: string) => void, onCancel?: () => void, prompt?: string) {
    this.cmdline = {
      type, text: initial, cursor: initial.length, prompt, onSubmit, onCancel, ctrlR: false,
      histIdx: type === ':' ? this.history[':'].length : this.history['/'].length,
      saved: { cursor: { ...this.cursor }, top: this.win.top },
    };
    this.mode = 'cmdline';
  }

  private cmdlineKey(key: Key) {
    const cl = this.cmdline!;
    if (key !== '<Up>' && key !== '<Down>') cl.histPrefix = null;
    if (cl.ctrlR) {
      cl.ctrlR = false;
      let ins = '';
      if (key === '<C-w>') ins = this.wordUnderCursor(false) ?? '';
      else if (key === '<C-a>') ins = this.wordUnderCursor(true) ?? '';
      else if (key === '<C-l>') ins = this.line(cl.saved?.cursor.line ?? this.cursor.line);
      else if (key.length === 1) ins = this.getRegister(key).text.replace(/\n$/, '').replace(/\n/g, '\r');
      cl.text = cl.text.slice(0, cl.cursor) + ins + cl.text.slice(cl.cursor);
      cl.cursor += ins.length;
      return this.incsearch();
    }
    const hist = cl.type === ':' ? this.history[':'] : this.history['/'];
    switch (key) {
      case '<Esc>':
      case '<C-c>':
        return this.cancelCmdline();
      case '<CR>':
      case '<C-j>':
      case '<C-m>': {
        const text = cl.text;
        this.cmdline = null;
        this.cmdlineSaved = cl.saved?.cursor ?? null;
        if ((cl.type === '/' || cl.type === '?') && cl.saved) this.win.cursor = { ...cl.saved.cursor };
        this.mode = this.visual ? 'visual' : 'normal';
        if (cl.type === ':' || cl.type === '/' || cl.type === '?') {
          if (text) {
            const h = this.history[cl.type === ':' ? ':' : '/'];
            const idx = h.indexOf(text);
            if (idx >= 0) h.splice(idx, 1);
            h.push(text);
          }
        }
        const hadOp = !!this.pendingSearchOp;
        if (cl.onSubmit) cl.onSubmit(text);
        if (this.depth === 0 && this.mode === 'normal' && !hadOp) this.finishCommand(cl.type === ':' ? 'cmdline' : cl.type === '/' || cl.type === '?' ? 'motion' : 'other');
        return;
      }
      case '<BS>':
      case '<C-h>':
        if (cl.text === '' ) return this.cancelCmdline();
        if (cl.cursor > 0) {
          cl.text = cl.text.slice(0, cl.cursor - 1) + cl.text.slice(cl.cursor);
          cl.cursor--;
        }
        return this.incsearch();
      case '<Del>':
        cl.text = cl.text.slice(0, cl.cursor) + cl.text.slice(cl.cursor + 1);
        return this.incsearch();
      case '<C-u>':
        cl.text = cl.text.slice(cl.cursor);
        cl.cursor = 0;
        return this.incsearch();
      case '<C-w>': {
        const before = cl.text.slice(0, cl.cursor);
        const m = /(\w+|[^\w\s]+)?\s*$/.exec(before)!;
        const cut = m[0].length || 1;
        cl.text = before.slice(0, Math.max(0, before.length - cut)) + cl.text.slice(cl.cursor);
        cl.cursor = Math.max(0, cl.cursor - cut);
        return this.incsearch();
      }
      case '<C-r>': cl.ctrlR = true; return;
      case '<Left>': cl.cursor = Math.max(0, cl.cursor - 1); return;
      case '<Right>': cl.cursor = Math.min(cl.text.length, cl.cursor + 1); return;
      case '<Home>': case '<C-b>': cl.cursor = 0; return;
      case '<End>': case '<C-e>': cl.cursor = cl.text.length; return;
      case '<Up>':
      case '<Down>': {
        if (cl.type === 'input' || cl.type === '=') return;
        // Vim keeps the text typed before the first <Up>/<Down> as a prefix:
        // only entries starting with it are visited, and stepping past the
        // newest one brings the typed text back. No match leaves everything.
        const d = key === '<Up>' ? -1 : 1;
        const prefix = cl.histPrefix ?? cl.text.slice(0, cl.cursor);
        let i = cl.histIdx + d;
        while (i >= 0 && i < hist.length && !hist[i].startsWith(prefix)) i += d;
        if (i < 0 || i > hist.length || (i === hist.length && cl.histIdx >= hist.length)) return;
        cl.histPrefix = prefix;
        cl.histIdx = i;
        cl.text = i === hist.length ? prefix : hist[i];
        cl.cursor = cl.text.length;
        return this.incsearch();
      }
      case '<Tab>':
        return this.cmdlineComplete();
      case '<C-v>':
        return;
    }
    if (key.length === 1) {
      cl.text = cl.text.slice(0, cl.cursor) + key + cl.text.slice(cl.cursor);
      cl.cursor++;
      return this.incsearch();
    }
  }

  private cancelCmdline() {
    const cl = this.cmdline!;
    if ((cl.type === '/' || cl.type === '?') && cl.saved) {
      this.win.cursor = cl.saved.cursor;
      this.win.top = cl.saved.top;
    }
    this.cmdline = null;
    this.mode = this.visual ? 'visual' : 'normal';
    this.incsearchPos = null;
    cl.onCancel?.();
  }

  /** Where the incremental search currently matches (for highlighting). */
  incsearchPos: { start: Pos; end: Pos } | null = null;

  private incsearch() {
    const cl = this.cmdline!;
    this.incsearchPos = null;
    if ((cl.type !== '/' && cl.type !== '?') || !this.opt('incsearch') || !cl.text) return;
    try {
      const pat = splitSearchOffset(cl.text, cl.type).pattern;
      const m = this.findMatch(pat, cl.saved!.cursor, cl.type === '/' ? 1 : -1, false);
      if (m) {
        this.incsearchPos = m;
        this.win.cursor = { ...m.start };
        this.scrollToCursor();
      }
    } catch {
      /* incomplete pattern */
    }
  }

  private cmdlineComplete() {
    const cl = this.cmdline!;
    if (cl.type !== ':') return;
    const m = /^(\s*\w+!?\s+)(\S*)$/.exec(cl.text);
    if (m) {
      const cmd = m[1].trim();
      const prefix = m[2];
      let cands: string[] = [];
      if (/^(e|edit|sp|split|vs|vsplit|find|fin|tabe|tabnew|new|vnew|r|read|diffs|diffsplit|args)$/.test(cmd)) {
        const all = this.fs.list();
        cands = /^(find|fin)$/.test(cmd) ? all.filter(p => p.split('/').pop()!.startsWith(prefix)) : all.filter(p => p.startsWith(prefix));
      } else if (/^(b|buffer|sb|bd|bdelete)$/.test(cmd)) {
        cands = this.buffers.filter(b => b.listed && b.name.includes(prefix)).map(b => b.name);
      }
      if (cands.length) {
        const first = cands[0];
        cl.text = m[1] + first;
        cl.cursor = cl.text.length;
        this.msg(cands.join('  '), 'more');
      }
      return;
    }
    const names = [...this.exCommands.keys()].filter(n => n.startsWith(cl.text)).sort();
    if (names.length) {
      cl.text = names[0];
      cl.cursor = cl.text.length;
    }
  }

  // ---- search -----------------------------------------------------------------------------

  compilePattern(pattern: string, opts: { noSmartcase?: boolean } = {}): Compiled {
    try {
      return compile(pattern, { ignorecase: !!this.opt('ignorecase'), smartcase: !opts.noSmartcase && !!this.opt('smartcase') });
    } catch (e) {
      if (e instanceof PatternError) fail(e.message);
      throw e;
    }
  }

  /** All matches of a pattern in a buffer (for highlighting and n/N). */
  matches(pattern: string, buf = this.buf, opts: { noSmartcase?: boolean } = {}): { start: Pos; end: Pos }[] {
    if (!pattern) return [];
    const cacheKey = `${pattern}\u0000${buf.id}\u0000${this.opt('ignorecase')}${this.opt('smartcase')}${opts.noSmartcase}`;
    const text = buf.text();
    if (this.matchCache && this.matchCache.key === cacheKey && this.matchCache.text === text) return this.matchCache.result;
    let re: RegExp;
    try {
      re = compile(pattern, { ignorecase: !!this.opt('ignorecase'), smartcase: !opts.noSmartcase && !!this.opt('smartcase') }).re;
    } catch {
      return [];
    }
    const starts = lineStarts(buf.lines);
    const out: { start: Pos; end: Pos }[] = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = re.exec(text)) && guard++ < 20000) {
      const s = offsetToPos(starts, m.index);
      const len = m[0].length;
      const e = offsetToPos(starts, m.index + Math.max(0, len - 1));
      out.push({ start: s, end: len === 0 ? s : e });
      if (len === 0) re.lastIndex++;
    }
    this.matchCache = { key: cacheKey, text, result: out };
    return out;
  }
  private matchCache: { key: string; text: string; result: { start: Pos; end: Pos }[] } | null = null;

  findMatch(pattern: string, from: Pos, dir: 1 | -1, skipCurrent = true, opts: { noSmartcase?: boolean } = {}): { start: Pos; end: Pos; wrapped?: boolean } | null {
    this.compilePattern(pattern, opts); // surfaces syntax errors
    const all = this.matches(pattern, this.buf, opts);
    if (!all.length) return null;
    if (dir === 1) {
      const m = all.find(x => cmpPos(x.start, from) > 0 || (!skipCurrent && cmpPos(x.start, from) === 0));
      if (m) return m;
      return this.opt('wrapscan') ? { ...all[0], wrapped: true } : null;
    }
    for (let i = all.length - 1; i >= 0; i--) if (cmpPos(all[i].start, from) < 0 || (!skipCurrent && cmpPos(all[i].start, from) === 0)) return all[i];
    return this.opt('wrapscan') ? { ...all[all.length - 1], wrapped: true } : null;
  }

  /** Run a search motion (/, ?, n, N, *, #). Returns the destination. */
  searchMotion(pattern: string, dir: 1 | -1, offset: string, count: number, opts: { noSmartcase?: boolean } = {}): MotionResult | null {
    if (!pattern) fail('E35: No previous regular expression');
    let from = { ...this.cursor };
    // With an end offset, searching again from the match end would find the same match.
    const off = parseOffset(offset);
    if (off.type === 'e' && dir === 1) from = pos(from.line, from.col - off.n);
    let m: { start: Pos; end: Pos; wrapped?: boolean } | null = null;
    let wrapped = false;
    for (let i = 0; i < count; i++) {
      m = this.findMatch(pattern, from, dir, true, opts);
      if (!m) fail(`E486: Pattern not found: ${pattern}`);
      if (m.wrapped) wrapped = true;
      from = m.start;
    }
    if (!m) return null;
    this.hlActive = true;
    if (wrapped) this.msg(dir === 1 ? 'search hit BOTTOM, continuing at TOP' : 'search hit TOP, continuing at BOTTOM', 'warn');
    else this.msg((dir === 1 ? '/' : '?') + pattern);
    this.emit('search');
    if (off.type === 'line') {
      const l = Math.max(0, Math.min(this.buf.lineCount - 1, m.start.line + off.n));
      return { pos: pos(l, 0), linewise: true, jump: true, openFold: true }; // Vim puts line offsets in column 1
    }
    if (off.type === 'e') return { pos: pos(m.end.line, m.end.col + off.n), inclusive: true, jump: true, openFold: true };
    if (off.type === 's') return { pos: pos(m.start.line, m.start.col + off.n), jump: true, openFold: true, inclusive: off.n > 0 };
    return { pos: m.start, jump: true, openFold: true };
  }

  wordUnderCursor(big: boolean): string | null {
    const t = this.line();
    let c = this.cursor.col;
    const isW = (ch: string | undefined) => !!ch && (big ? /\S/.test(ch) : /\w/.test(ch));
    // Use the first keyword at or after the cursor.
    while (c < t.length && !isW(t[c])) c++;
    if (c >= t.length) return null;
    let s = c, e = c;
    while (s > 0 && isW(t[s - 1])) s--;
    while (e + 1 < t.length && isW(t[e + 1])) e++;
    return t.slice(s, e + 1);
  }

  // ---- ex & expressions ----------------------------------------------------------------------

  ex(cmdline: string) {
    runEx(this, cmdline);
  }

  evalExpr(src: string, env: Partial<ExprEnv> = {}): string {
    try {
      return valueToString(evaluate(src, {
        line: a => (a === '.' ? this.cursor.line + 1 : a === '$' ? this.buf.lineCount : 0),
        col: a => (a === '.' ? this.cursor.col + 1 : a === '$' ? this.line().length + 1 : 0),
        getreg: n => this.getRegister(n).text,
        ...env,
      }));
    } catch (e) {
      fail((e as Error).message);
    }
  }

  // ---- macros -----------------------------------------------------------------------------------

  startRecording(reg: string) {
    this.recording = { reg, keys: [] };
  }

  stopRecording() {
    const r = this.recording!;
    // Drop the q that ended the recording.
    const keys = r.keys.slice(0, -1);
    this.recording = null;
    this.registers.set(r.reg, { text: keysToRegister(keys), kind: 'char' });
  }

  executeRegister(reg: string, count: number) {
    if (reg === '@') {
      if (!this.lastMacro) fail('E748: No previously used register');
      reg = this.lastMacro;
    }
    if (reg === ':') {
      if (!this.lastEx) fail('E30: No previous command line');
      for (let i = 0; i < count; i++) this.ex(this.lastEx);
      this.lastMacro = ':';
      return;
    }
    const v = this.getRegister(reg);
    this.lastMacro = reg;
    const keys = registerToKeys(v.kind === 'line' ? v.text.replace(/\n$/, '\n') : v.text);
    for (let i = 0; i < count; i++) {
      if (v.kind === 'line') this.runKeys(keys.map(k => (k === '\n' ? '<CR>' : k)));
      else this.runKeys(keys);
    }
  }
}

// ---- helpers ------------------------------------------------------------------------------------

type Parsed = {
  reg: string | null;
  count1: number | null;
  count2: number | null;
  cmdKeys: Key[];
  entry: Entry;
  arg: string;
  opStr?: string;
  end?: number;
  /** Keys after the command that belong to the next one (prefix ambiguity); fed again after it runs. */
  rest?: Key[];
  target: null | { kind: 'self' } | { kind: 'entry'; entry: Entry; keys: Key[]; arg: string; force: VisualKind | null } | { kind: 'search'; dir: 1 | -1; force: VisualKind | null; pick?: MotionSpec['pick']; keys?: Key[]; typed?: Key[] };
};

export type ExArgs = {
  range: { start: number; end: number } | null;
  /** How many addresses were given (0, 1 or 2). */
  addrCount: number;
  bang: boolean;
  arg: string;
  name: string;
  count: number | null;
  reg: string | null;
};

export function lineStarts(lines: readonly string[]) {
  const s: number[] = [];
  let o = 0;
  for (const l of lines) {
    s.push(o);
    o += l.length + 1;
  }
  return s;
}

export function offsetToPos(starts: number[], off: number): Pos {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= off) lo = mid;
    else hi = mid - 1;
  }
  return pos(lo, off - starts[lo]);
}

export function splitSearchOffset(text: string, sep: '/' | '?'): { pattern: string; offset: string } {
  // Find an unescaped separator.
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === sep) return { pattern: text.slice(0, i), offset: text.slice(i + 1) };
  }
  return { pattern: text, offset: '' };
}

function parseOffset(off: string): { type: 'none' | 'line' | 'e' | 's'; n: number } {
  if (!off) return { type: 'none', n: 0 };
  const m = /^([esb]?)([+-]?\d*)$/.exec(off);
  if (!m) return { type: 'none', n: 0 };
  const num = m[2] === '' ? 0 : m[2] === '+' ? 1 : m[2] === '-' ? -1 : parseInt(m[2], 10);
  if (!m[1]) return { type: 'line', n: m[2] === '' ? 0 : num };
  return { type: m[1] === 'e' ? 'e' : 's', n: num };
}

/** Store keys in a register the way Vim does: control keys become control characters. */
export function keysToRegister(keys: Key[]): string {
  return keys.map(k => {
    if (k.length === 1) return k;
    if (k === '<Esc>') return '\x1b';
    if (k === '<CR>') return '\r';
    if (k === '<BS>') return '\x08';
    if (k === '<Tab>') return '\t';
    const m = /^<C-(.)>$/.exec(k);
    if (m && /[a-z@[\\\]^_]/.test(m[1])) return String.fromCharCode(m[1].toUpperCase().charCodeAt(0) & 0x1f);
    return k;
  }).join('');
}

export function registerToKeys(text: string): Key[] {
  const out: Key[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = ch.charCodeAt(0);
    if (ch === '\x1b') out.push('<Esc>');
    else if (ch === '\r' || ch === '\n') out.push('<CR>');
    else if (ch === '\x08') out.push('<BS>');
    else if (ch === '\t') out.push('<Tab>');
    else if (code < 32) out.push(`<C-${String.fromCharCode(code + 96)}>`);
    else if (ch === '<') {
      const m = /^<[A-Za-z][\w-]*>/.exec(text.slice(i));
      if (m && parseKeys(m[0]).length === 1 && m[0] !== '<') {
        out.push(parseKeys(m[0])[0]);
        i += m[0].length - 1;
      } else out.push('<');
    } else out.push(ch);
  }
  return out;
}

/** How a register's contents render (control chars as ^X). */
export function showRegister(text: string) {
  return text.replace(/[\x00-\x1f]/g, c => (c === '\n' ? '^J' : '^' + String.fromCharCode(c.charCodeAt(0) + 64)));
}

export const REG_KIND_LABEL: Record<RegKind, string> = { char: 'c', line: 'l', block: 'b' };

export const DIGRAPHS: Record<string, string> = {
  "e'": 'é', "a'": 'á', "i'": 'í', "o'": 'ó', "u'": 'ú', "E'": 'É', "A'": 'Á',
  'e!': 'è', 'a!': 'à', 'e>': 'ê', 'a>': 'â', 'o>': 'ô', 'e:': 'ë', 'a:': 'ä', 'o:': 'ö', 'u:': 'ü', 'A:': 'Ä', 'O:': 'Ö', 'U:': 'Ü',
  'i:': 'ï', 'I:': 'Ï', 'E:': 'Ë', 'y:': 'ÿ', 'i>': 'î', 'u>': 'û', 'i!': 'ì', 'o!': 'ò', 'u!': 'ù', 'o~': 'õ', 'a~': 'ã', 'aa': 'å', 'ae': 'æ', 'o/': 'ø',
  'n?': 'ñ', 'N?': 'Ñ', 'c,': 'ç', 'ss': 'ß', 'a*': 'α', 'b*': 'β', 'l*': 'λ', 'p*': 'π', 'm*': 'μ', 'S*': 'Σ', 'W*': 'Ω',
  '-M': '—', '-N': '–', 'Eu': '€', 'Pd': '£', 'Ye': '¥', 'Co': '©', 'Rg': '®', 'TM': '™', 'DG': '°', '+-': '±',
  '->': '→', '<-': '←', '-!': '↑', '-v': '↓', '=>': '⇒', '!=': '≠', '=<': '≤', '>=': '≥', '*X': '×', '-:': '÷',
  'OK': '✓', 'XX': '✗', '12': '½', '14': '¼', '34': '¾', '1S': '¹', '2S': '²', '3S': '³', 'SE': '§', 'PI': '¶',
  '"6': '“', '"9': '”', "'6": '‘', "'9": '’', '<<': '«', '>>': '»', '.M': '·', 'Db': '◆', 'oo': '•',
};

export type { Key };
