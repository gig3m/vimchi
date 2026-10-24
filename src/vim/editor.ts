// The editor: modes, key dispatch, the normal-mode command parser, insert
// mode, visual mode, the command line, registers, undo, dot-repeat and
// macros. Motions, operators and actions live in commands.ts; ex commands in
// ex.ts; plugins register extra commands through the define* methods.

import { Buffer } from './buffer';
import { installCommands } from './commands';
import { continuation, leaderOf, plainFo } from './comments';
import { type ExprEnv, evaluate, valueToString } from './expr';
import { runEx } from './ex';
import { VirtualFS, norm } from './fs';
import { type Key, keysToString, parseKeys } from './keys';
import { type QfItem, Tab, Window } from './layout';
import { type Compiled, PatternError, compile } from './regex';
import { type RegKind, type RegValue, Registers, isValidRegister } from './registers';
import { displayWidth, firstNonBlank, indentOf, lastCol } from './text';
import type { ObjectCtx, TextObject } from './textobjects';
import {
  BUFFER_LOCAL, DEFAULT_OPTIONS, WINDOW_LOCAL, type Message, type Mode, type Options, type Pos, type Range, type VisualKind,
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
  /** Columns hidden at the start of a line (hidden entry ids): line → count. */
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
  /** left: the block's left column, where Vim puts the cursor after a block I / A (not c). */
  block?: { first: number; last: number; col: number; append: boolean; toEol: boolean; left?: number; pad?: boolean };
  /** Original line texts for replace mode backspacing. */
  replaced?: Map<string, string>;
  /** Pending multi-key input: <C-r>, <C-v>, <C-k>, <C-x>, <C-o>. */
  pending: '' | 'ctrl-r' | 'ctrl-v' | 'ctrl-k' | 'ctrl-x' | 'ctrl-g';
  pendingBuf: string;
  /** Text typed so far (for ". and <C-a>). */
  typed: string;
  completion?: { items: string[]; idx: number; startCol: number; line: number; orig: string };
  /** Moved by <C-g>j / <C-g>k and nothing typed since: the next edit restarts the insert. */
  arrowed?: boolean;
  /** A line opened with an automatic indent or comment leader (o, O, <CR>) and its text then: left
   * without typing on it, its trailing blanks go (Vim's did_ai: "  " → "", "  -- " → "  --"). */
  auto?: { line: number; text: string };
  /** Came from <C-o>: return here after one command. */
};


/**
 * Neovim's update_topline() for a window of `h` rows over `n` rows of text (a closed fold is one),
 * every row one screen line high ('wrap' off, as in LazyVim, so no 'smoothscroll' path): the new
 * top row for cursor row `c`, given top row `t`. A port of move.c (0.12): scroll_cursor_top(),
 * scroll_cursor_bot() and scroll_cursor_halfway(), 'scrolljump' 1. Rows are 1-based inside.
 */
function updateTopline(n: number, h: number, so: number, t0: number, c0: number, concealed = true): number {
  let T = t0 + 1;
  const C = c0 + 1, sj = 1;
  const halfway = (preferAbove: boolean) => {
    let used = 1, loff = C, boff = C, top = C;
    outer: while (top > 1) {
      let above = 0, below = 0;
      for (let round = 1; round <= 2; round++) {
        if (preferAbove ? round === 2 && below < above : round === 1 && below <= above) {
          if (boff < n) {
            boff++;
            if (++used > h) break outer;
            below++;
          } else below++;
        }
        if (preferAbove ? round === 1 && below >= above : round === 1 && below > above) {
          loff--;
          if (++used > h) break outer;
          above++;
          top = loff;
        }
      }
    }
    T = top;
  };
  const scrollTop = (minScroll: number) => {
    let scrolled = C < T ? 1 : 0, used = 1, top = C - 1, bot = C + 1, newTop = top + 1, extra = 0;
    while (top > 0) {
      if (top < T) scrolled++;
      if ((newTop >= T || scrolled > minScroll) && extra >= so) break;
      used++;
      if (extra + 1 <= so && bot < n) used++;
      if (used > h) break;
      extra++;
      newTop = top;
      top--;
      bot++;
    }
    if (used > h) halfway(false);
    else T = Math.min(newTop < T ? newTop : T, C);
  };
  const scrollBot = (minScroll: number) => {
    const B = Math.min(T + h, n + 1), empty = Math.max(0, T + h - 1 - n);
    let used = 1, scrolled = 0;
    if (C >= B) { scrolled = used; if (C === B) scrolled -= empty; }
    let loff = C, boff = C, extra = 0;
    while (loff > 1) {
      if ((((scrolled <= 0 || scrolled >= minScroll) && extra >= so) || boff + 1 > n) && loff <= B) break;
      const before = loff;
      loff--;
      if (++used > h) break;
      if (loff >= B) { scrolled++; if (loff === B && before > B) scrolled -= empty; }
      if (boff < n) {
        const bBefore = boff;
        boff++;
        if (++used > h) break;
        if (extra < so || scrolled < minScroll) {
          extra++;
          if (boff >= B) { scrolled++; if (bBefore < B) scrolled -= empty; }
        }
      }
    }
    let lineCount: number;
    if (scrolled <= 0) lineCount = 0;
    else if (used > h) lineCount = used;
    else {
      lineCount = 0;
      let bl = T - 1, i = 0;
      while (i < scrolled && bl < B) { bl++; i++; lineCount++; }
      if (i < scrolled) lineCount = 9999;
    }
    if (lineCount >= h && lineCount > minScroll) halfway(true);
    else if (lineCount > 0) T += lineCount;
  };
  let checkBot = true;
  if (T > 1 && (C < T || C - T < so)) {
    checkBot = false;
    // With folding (or conceal) active, as LazyVim always has it (foldmethod=expr, conceallevel=2),
    // win_lines_concealed() counts the lines between the cursor and topline + scrolloff one by one,
    // stopping at the last line: near the end of the file that makes it scroll, not centre.
    const half = Math.max(2, Math.floor(h / 2) - 1);
    const gap = concealed ? Math.min(Math.min(T + so, n) - C, half) : T + so - C;
    if (gap >= half) halfway(false);
    else { scrollTop(sj); checkBot = true; }
  }
  if (checkBot) {
    const B = Math.min(T + h, n + 1);
    if (B <= n && !(C < B && B - 1 - C >= so) && !(C < B - so)) {
      if (C - B + 1 + so <= h + 1) scrollBot(sj);
      else halfway(false);
    }
  }
  return Math.max(0, Math.min(T, n) - 1);
}

/** `t` with its quoted strings blanked out, so brackets inside them don't count. */
function blankStrings(t: string): string {
  return t.replace(/(["'`])(?:\\.|(?!\1).)*\1?/g, m => ' '.repeat(m.length));
}

/** The index of the outermost bracket left open on a line (brackets in strings not counted), or -1. */
function unclosedBracket(t: string): number {
  const stack: number[] = [];
  const code = blankStrings(t);
  for (let i = 0; i < code.length; i++) {
    if ('([{'.includes(code[i])) stack.push(i);
    else if (')]}'.includes(code[i])) stack.pop();
  }
  return stack.length ? stack[0] : -1;
}

/** Commands the coach counts as undo: u, <C-r>, the time-travel g- / g+, and U. */
const UNDO_KEYS = new Set(['u', '<C-r>', 'g-', 'g+', 'U']);
/** Insert keys that do not end an arrow move (they neither type nor delete). */
const ARROW_KEEPS = new Set(['<Esc>', '<C-c>', '<C-g>', '<C-o>', '<Left>', '<Right>', '<Up>', '<Down>', '<Home>', '<End>']);
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
  /** bufferline's tab order where [B / ]B have rearranged it (buffers not in it follow, by number). */
  bufferSort: Buffer[] = [];
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
  /**
   * A LazyVim-only behaviour just fired for the first time (a continued comment, the save prompt,
   * a rounded shift…): one plain sentence saying so, for the tutor to show and clear. Each kind is
   * noted once per editor.
   */
  lazyNote: string | null = null;
  private lazyNoted = new Set<string>();
  noteLazy(kind: string, text: string) {
    if (this.lazyNoted.has(kind)) return;
    this.lazyNoted.add(kind);
    this.lazyNote = text;
  }
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
  /** Run after every top-level key, like a CursorMoved autocmd (the explorer keeps the cursor on entry names). */
  cursorHooks: (() => void)[] = [];
  /** Events for challenge bookkeeping (e.g. "undo", "search"). */
  events: string[] = [];
  /** The command the most recent feed() completed, for the coach. null when the key completed nothing. */
  lastCommand: LastCommand | null = null;
  /** Keys since the current normal/visual command began, including any insert or cmdline text typed for it. */
  private cmdKeys: Key[] = [];

  /** A command that continues through a plugin's modal (flash's s): it completes when the modal closes. */
  private modalCmd: { keys: Key[]; kind: CommandKind | null; open: boolean } | null = null;
  /** For a plugin action that opens a modal: the keys typed into it belong to this command, which
   * completes (lastCommand) when the modal closes, as the kind passed to completeModal. */
  continueInModal() { this.modalCmd = { keys: [], kind: null, open: false }; }
  /** The modal's success path: the command it completes counts as `kind` (a jump is a motion). */
  completeModal(kind: CommandKind) { if (this.modalCmd) this.modalCmd.kind = kind; }

  private finishCommand(kind: CommandKind) {
    const mc = this.modalCmd;
    if (mc && !mc.open) {
      if (this.modal) {
        // The command goes on in the modal: nothing completes yet.
        mc.keys = this.cmdKeys.slice();
        mc.open = true;
        this.lastCommand = null;
        if (this.mode === 'normal' && !this.visual) this.cmdKeys = [];
        return;
      }
      this.modalCmd = null; // the modal closed at once (nothing to label)
    }
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
    return this.optIn(this.win, k);
  }
  /** An option as `win` sees it: a buffer-local one from its buffer, else its :setlocal value, else the global one. */
  optIn<K extends keyof Options>(win: Window, k: K): Options[K] {
    if (BUFFER_LOCAL.has(k as string)) return this.localsOf(win.buf)[k as string] as Options[K];
    if (WINDOW_LOCAL.has(k as string)) return this.localsOfWin(win)[k as string] as Options[K];
    const w = win.opts[k as string];
    return (w !== undefined ? w : this.options[k]) as Options[K];
  }
  /**
   * A buffer's own copy of the buffer-local options. Neovim takes it from the global values when the
   * buffer is made, then its ftplugin; here it is taken on first use, and :set takes it for every
   * buffer before it changes a global value, so a buffer never sees a later :set made elsewhere.
   */
  localsOf(buf: Buffer): Record<string, boolean | number | string> {
    if (!buf.optsCopied) {
      for (const k of BUFFER_LOCAL) if (!(k in buf.opts)) buf.opts[k] = this.options[k];
      buf.optsCopied = true;
    }
    return buf.opts;
  }
  /** A window's own copy of the window-local options, taken from the global values on first use. */
  localsOfWin(win: Window): Record<string, boolean | number | string> {
    if (!win.optsCopied) {
      for (const k of WINDOW_LOCAL) if (!(k in win.opts)) win.opts[k] = this.options[k];
      win.optsCopied = true;
    }
    return win.opts;
  }
  /** 'shiftwidth', where 0 means 'tabstop' (Go's ftplugin sets it so). */
  sw(): number {
    return Number(this.opt('shiftwidth')) || Number(this.opt('tabstop')) || 8;
  }
  /** An indent `n` columns wide: spaces with 'expandtab', else tabs then spaces (Go). */
  indentStr(n: number): string {
    if (this.opt('expandtab')) return ' '.repeat(n);
    const ts = Number(this.opt('tabstop')) || 8;
    return '\t'.repeat(Math.floor(n / ts)) + ' '.repeat(n % ts);
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
  /** Every key sequence defined or mapped in a mode (which-key and the keymaps picker read it). */
  definedKeys(mode: 'n' | 'v' | 'o' = 'n'): Key[][] {
    return [...this.tables[mode].keys()].map(k => k.split(SEP));
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

  /** The listed buffers in bufferline's tab order. :ls keeps buffer-number order. */
  bufferOrder(): Buffer[] {
    const listed = this.buffers.filter(b => b.listed);
    return [...this.bufferSort.filter(b => listed.includes(b)), ...listed.filter(b => !this.bufferSort.includes(b))];
  }

  /** bufferline's cycle (H, L, [b, ]b in LazyVim): the next tab along, wrapping, no count. */
  cycleBuffer(dir: 1 | -1) {
    const order = this.bufferOrder();
    const i = order.indexOf(this.buf);
    if (i < 0 || order.length < 2) return;
    this.showBuffer(this.win, order[(i + dir + order.length) % order.length]);
  }

  /** bufferline's move ([B, ]B in LazyVim): swap the current tab with its neighbour; stops at the ends. */
  moveBuffer(dir: 1 | -1) {
    const order = this.bufferOrder();
    const i = order.indexOf(this.buf), j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    this.bufferSort = order;
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

  /** Split the current window. The new one goes below/right with 'splitbelow'/'splitright' (both
   * on in LazyVim), above/left without; `side` overrides (the explorer always opens on the left). */
  splitWindow(dir: 'row' | 'col', buf?: Buffer, side?: 'before' | 'after'): Window {
    const after = side ? side === 'after' : !!this.opt(dir === 'col' ? 'splitbelow' : 'splitright');
    const w = new Window(buf ?? this.buf);
    // A split starts with the window's own options (Neovim copies them).
    w.opts = { ...this.localsOfWin(this.win) };
    w.optsCopied = true;
    w.cursor = { ...this.cursor };
    w.want = this.win.want;
    w.top = this.win.top;
    w.alt = this.win.alt;
    this.tab.split(this.win, w, dir, after);
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
    // 'virtualedit' block (LazyVim): in a Visual block the cursor may sit past the end of a line.
    if (this.veBlock()) { c.col = Math.max(0, c.col); return; }
    const len = this.line(c.line).length;
    c.col = Math.max(0, Math.min(c.col, allowEol ? len : Math.max(0, len - 1)));
    if (this.mode === 'visual' && !allowEol) c.col = Math.min(c.col, Math.max(0, len - 1));
  }

  /** 'virtualedit' has block (or all), as in LazyVim. */
  veOpt(): boolean {
    return String(this.opt('virtualedit')).split(',').some(v => v === 'block' || v === 'all');
  }
  /** In a Visual block with 'virtualedit' block: columns past a line's end are allowed. */
  veBlock(): boolean {
    return this.visual?.kind === '<C-v>' && this.veOpt();
  }

  setCursor(p: Pos, want?: number) {
    this.win.cursor = { line: p.line, col: p.col };
    this.clampCursor(this.mode === 'insert' || this.mode === 'replace');
    this.win.want = want ?? this.win.cursor.col;
  }

  pushJump(p: Pos = this.cursor) {
    const w = this.win;
    w.jumplist = w.jumplist.slice(0, w.jumpIdx).filter(j => !(j.buf === this.buf && j.pos.line === p.line));
    w.jumplist.push({ buf: this.buf, pos: { ...p }, top: w.top });
    if (w.jumplist.length > 100) w.jumplist.shift();
    w.jumpIdx = w.jumplist.length;
    this.buf.marks.set("'", { ...p });
  }

  // ---- folds ---------------------------------------------------------------------
  closedFoldAt(line: number, win = this.win) {
    let best: { start: number; end: number } | null = null;
    // 'foldminlines' 1: a one-line fold never shows closed.
    for (const f of win.folds) if (f.closed && f.end > f.start && line >= f.start && line <= f.end && (!best || f.start < best.start)) best = f;
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
  /**
   * Folds as LazyVim makes them, when the window has none yet, or again after the text changed (it
   * recomputes them as you type): 'foldmethod' expr by treesitter where the language has fold
   * queries (a block from its header to its closing line; Markdown by section), Vim's indent
   * folding elsewhere (text: the indented lines, not their header). Open or closed by 'foldlevel'
   * (99 in LazyVim: all open); after an edit each fold keeps its state, found by its first line.
   * Folds a lesson set up itself are left alone.
   */
  ensureFolds(win = this.win) {
    const text = win.buf.text();
    if (win.folds.length && (!win.autoFolds || win.autoFoldsText === text)) return;
    const level = Number(this.optIn(win, 'foldlevel'));
    // Old states by first line, in order: a copy of a block (same first line) doesn't take its state.
    // The old folds were already moved with the edit (foldMarkAdjust), so their lines are read in
    // the text as it is now.
    const old = new Map<string, boolean[]>();
    for (const f of [...win.folds].sort((x, y) => x.start - y.start)) {
      const k = win.buf.lines[f.start] ?? '';
      old.set(k, [...(old.get(k) ?? []), f.closed]);
    }
    const found = this.computeFolds(win);
    for (const f of found) f.depth = found.filter(g => g !== f && g.start <= f.start && f.end <= g.end).length;
    const L = win.buf.lines, first = !win.autoFolds;
    // A fold an edit makes (a put function, a typed block) starts open, as Neovim's do; on first
    // use 'foldlevel' decides.
    win.folds = found.sort((x, y) => x.start - y.start || y.end - x.end).map(f => ({ start: f.start, end: f.end, closed: old.get(L[f.start])?.shift() ?? (first && f.depth >= level) }));
    win.autoFolds = true;
    win.autoFoldsText = text;
  }

  private computeFolds(win: Window): { start: number; end: number; depth: number }[] {
    const L = win.buf.lines, ts = Number(this.optIn(win, 'tabstop')) || 8, ft = win.buf.filetype;
    const ind = (l: number) => displayWidth(indentOf(L[l]), ts);
    const blank = (l: number) => !L[l].trim();
    const found: { start: number; end: number; depth: number }[] = [];
    if (ft === 'markdown') {
      // A heading folds its section, down to the next heading as high or higher, without the blank
      // lines before it (folds.scm's #trim!); a fenced code block is a fold of its own. Headings
      // inside a fence don't count.
      const fence: boolean[] = [];
      let inFence = -1;
      L.forEach((t, i) => {
        if (/^\s*(```|~~~)/.test(t)) {
          if (inFence < 0) inFence = i;
          else { found.push({ start: inFence, end: i, depth: 0 }); fence[i] = true; inFence = -1; return; }
        }
        fence[i] = inFence >= 0;
      });
      const heads = L.map((t, i) => [i, fence[i] ? 0 : /^(#{1,6})\s/.exec(t)?.[1].length ?? 0] as const).filter(([, n]) => n > 0);
      heads.forEach(([i, n], k) => {
        const next = heads.slice(k + 1).find(([, m]) => m <= n);
        let end = (next ? next[0] : L.length) - 1;
        while (end > i && blank(end)) end--;
        if (end > i) found.push({ start: i, end, depth: 0 });
      });
      // The text before the first heading is a section too (the whole document when there is none).
      let end = (heads.length ? heads[0][0] : L.length) - 1;
      while (end > 0 && blank(end)) end--;
      if (end > 0 && !found.some(f => f.start === 0 && f.end === end)) found.push({ start: 0, end, depth: 0 });
      return found;
    }
    if (ft === 'text' || ft === 'csv') {
      // Vim's 'foldmethod' indent: a line's level is its indent in shiftwidths; a blank line takes
      // the lower of its neighbours'. A fold is each run of lines at a level or deeper.
      const sw = Number(this.optIn(win, 'shiftwidth')) || ts;
      const lv: number[] = L.map((_, i) => (blank(i) ? -1 : Math.floor(ind(i) / sw)));
      for (let i = 0; i < L.length; i++) {
        if (lv[i] >= 0) continue;
        let p = i - 1; while (p >= 0 && lv[p] < 0) p--;
        let n = i + 1; while (n < L.length && blank(n)) n++;
        lv[i] = Math.min(p >= 0 ? lv[p] : 0, n < L.length ? Math.floor(ind(n) / sw) : 0);
      }
      const max = Math.max(0, ...lv);
      for (let k = 1; k <= max; k++) {
        for (let i = 0; i < L.length; i++) {
          if (lv[i] < k) continue;
          let e = i;
          while (e + 1 < L.length && lv[e + 1] >= k) e++;
          found.push({ start: i, end: e, depth: 0 });
          i = e;
        }
      }
      return found;
    }
    for (let i = 0; i < L.length; i++) {
      if (blank(i)) continue;
      let j = i + 1;
      while (j < L.length && blank(j)) j++;
      if (j >= L.length || ind(j) <= ind(i)) continue;
      let end = j;
      for (let k = j; k < L.length; k++) {
        if (blank(k)) continue;
        if (ind(k) <= ind(i)) {
          if (ind(k) === ind(i) && /^\s*([}\])]|end\b)/.test(L[k])) end = k;
          break;
        }
        end = k;
      }
      found.push({ start: i, end, depth: 0 });
    }
    return found;
  }

  /** How deep the window's folds nest (zR sets 'foldlevel' to it). */
  foldDepth(win = this.win): number {
    const fs = win.folds;
    return fs.reduce((m, f) => Math.max(m, fs.filter(g => g !== f && g.start <= f.start && f.end <= g.end).length + 1), 0);
  }

  openFoldsAt(line: number, win = this.win) {
    for (const f of win.folds) if (line >= f.start && line <= f.end) f.closed = false;
  }

  // ---- scrolling -------------------------------------------------------------------
  scrollToCursor(win = this.win) {
    const rows = this.visibleLines(win);
    const h = Math.max(1, win.height);
    const curRow = rows.findIndex(l => l >= win.cursor.line) - (rows.includes(win.cursor.line) ? 0 : 1);
    const cr = Math.max(0, rows.indexOf(this.closedFoldAt(win.cursor.line, win)?.start ?? win.cursor.line) >= 0
      ? rows.indexOf(this.closedFoldAt(win.cursor.line, win)?.start ?? win.cursor.line) : curRow);
    // A top line past the end of the text (the file got shorter) is the last line (check_topline).
    const ti = rows.findIndex(l => l >= win.top);
    const topRow = ti < 0 ? Math.max(0, rows.length - 1) : ti;
    // A page scroll (C-f, C-d, C-e…) set the view itself and moved the cursor into it: it stays
    // until the cursor changes line or the text changes (Neovim's VALID_TOPLINE), even with the
    // last line at the top.
    if (win.topLocked) {
      if (win.lockLine === win.cursor.line && win.lockText === win.buf.text() && cr >= topRow && cr < topRow + h) return;
      win.topLocked = false;
    }
    // hasAnyFolding(): a folding 'foldmethod', or folds made by hand.
    const folding = String(this.optIn(win, 'foldmethod')) !== 'manual' || win.folds.length > 0;
    win.top = rows[Math.max(0, Math.min(updateTopline(rows.length, h, Number(this.optIn(win, 'scrolloff')), topRow, cr, folding), rows.length - 1))] ?? 0;
  }

  /** Lock the view a page scroll just set (see scrollToCursor). */
  lockTop(win = this.win, line = win.cursor.line) {
    win.topLocked = true;
    win.lockLine = line;
    win.lockText = win.buf.text();
  }

  /** 'scrolloff' as it applies to a window `h` rows high (at most half of it). */
  so(h = this.win.height): number {
    return Math.min(Number(this.options.scrolloff), Math.floor((Math.max(1, h) - 1) / 2));
  }

  /** Scroll so the cursor row sits at a screen position, 'scrolloff' rows in from an edge (zt, zb). */
  /** Returns whether 'scrolloff' put the line somewhere other than the edge itself. */
  scrollCursorTo(where: 'top' | 'center' | 'bottom'): boolean {
    const rows = this.visibleLines();
    const cr = rows.indexOf(this.closedFoldAt(this.cursor.line)?.start ?? this.cursor.line);
    // zt keeps up to half the window less one above the cursor, zb up to half below it: in an
    // even-height window zb's 'scrolloff' can reach a line further (Neovim's scroll_cursor_bot).
    const h = this.win.height, so = this.so(h), soBot = Math.min(Number(this.options.scrolloff), Math.floor(Math.max(1, h) / 2));
    const clamp = (r: number) => Math.max(0, Math.min(r, rows.length - 1));
    const topRow = where === 'top' ? cr - so : where === 'center' ? cr - Math.floor((h - 1) / 2) : cr - h + 1 + Math.min(soBot, rows.length - 1 - cr);
    const plain = where === 'top' ? cr : where === 'center' ? topRow : cr - h + 1;
    this.win.top = rows[clamp(topRow)] ?? 0;
    return clamp(topRow) !== clamp(plain);
  }

  /**
   * After a scroll that left the view where it is (C-d, C-e, C-f…), bring the cursor 'scrolloff'
   * rows in from the window's edges, as Neovim's cursor_correct() does: the view stays, the cursor
   * moves. No correction at an edge of the file that is on screen.
   */
  cursorCorrect(win = this.win) {
    // A port of move.c's cursor_correct() (0.12), rows for lines (a closed fold is one): trim the
    // window from both ends, a line at a time, until 'scrolloff' lines of context are taken (none
    // at an end of the file that is on screen), and put the cursor inside what's left.
    const rows = this.visibleLines(win), n = rows.length, h = Math.max(1, win.height);
    const so = Number(this.optIn(win, 'scrolloff'));
    if (!so || !n) return;
    const T = Math.max(0, rows.indexOf(win.top)) + 1, B = Math.min(T + h, n + 1);
    let aw = so, bw = so;
    if (T === 1) { aw = 0; bw = Math.min(bw, Math.floor(h / 2)); }
    if (B === n + 1) { bw = 0; aw = Math.min(aw, Math.floor((h - 1) / 2)); }
    let top = T, bot = B - 1, above = 0, below = 0;
    while ((above < aw || below < bw) && top < bot) {
      if (below < bw && (below <= above || above >= aw)) { below++; bot--; }
      if (above < aw && (above < below || below >= bw)) { above++; top++; }
    }
    const C0 = Math.max(0, rows.indexOf(this.closedFoldAt(win.cursor.line, win)?.start ?? win.cursor.line)) + 1;
    let C = C0;
    if (top === bot || bot === 0) C = top;
    else if (top > bot) C = bot;
    else {
      if (C < top && T > 1) C = top;
      if (C > bot && B <= n) C = bot;
    }
    if (C === C0) return;
    const line = rows[C - 1];
    win.cursor = { line, col: Math.min(win.want, Math.max(0, win.buf.line(line).length - 1)) };
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
      // block_prep(): a line that ends before the block starts yields blanks as wide as the block
      // ($: up to the longest line's end, plus one).
      let right = r.toEol ? 0 : c2;
      if (r.toEol) for (let l = r.start.line; l <= r.end.line; l++) right = Math.max(right, L[l].length);
      // With 'virtualedit' block (LazyVim) every line of the block is padded out to its width; a $
      // block to one past the longest line, as Neovim does it.
      const ve = String(this.opt('virtualedit')).split(',').some(v => v === 'block' || v === 'all');
      for (let l = r.start.line; l <= r.end.line; l++) {
        const part = L[l].length < c1 ? ' '.repeat(right - c1 + 1) : L[l].slice(c1, r.toEol ? undefined : c2 + 1);
        parts.push(!ve ? part : part.padEnd(r.toEol ? right - c1 + 1 : c2 - c1 + 1));
      }
      // op_yank(): y_width = end_vcol - start_vcol, one less for a $ block.
      const width = r.toEol ? Math.max(1, right - c1 > 0 ? right - c1 : right - c1 + 1) : c2 - c1 + 1;
      return { text: parts.join('\n'), kind: 'block', width };
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
    this.buf.checkModifiable();
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

  /** The view each mark was set in, by buffer and mark ('jumpoptions' view: 'a and `a restore it). */
  markViews = new Map<string, number>();

  /** With 'jumpoptions' view (LazyVim), show `top` again after a jump, when the cursor is in it. */
  restoreView(top: number | undefined, line = this.cursor.line) {
    if (top == null || !String(this.opt('jumpoptions')).split(',').includes('view')) return;
    const rows = this.visibleLines(), t = rows.indexOf(top), r = rows.indexOf(this.closedFoldAt(line)?.start ?? line);
    if (t < 0 || r < t || r >= t + this.win.height) return;
    // The view goes back as it was; scrollToCursor() then checks 'scrolloff' in it, as Neovim does.
    this.win.top = top;
  }

  private afterKey() {
    for (const w of this.tab.windows()) if (w.autoFolds && ['indent', 'expr'].includes(String(this.optIn(w, 'foldmethod')))) this.ensureFolds(w);
    const lc = this.buf.changelist[this.buf.changelist.length - 1];
    if (lc && lc.top === undefined) lc.top = this.win.top;
    if (this.mode === 'normal' && this.pending.length === 0) {
      this.endChange();
      this.clampCursor(false);
    }
    // A cursor inside a closed fold keeps its line (G, zM, zc leave it there, as in Neovim); the
    // fold's row shows it, j / k leave the fold whole and operators take the fold whole.
    this.clampCursor();
    for (const h of this.cursorHooks) h();
    this.scrollToCursor();
    this.version++;
    this.onChange?.();
  }

  private resetAfterError(e: VimError) {
    this.pending = [];
    // A failed <C-o> command has already resumed the insert, which records a fresh repeat.
    if (this.mode !== 'insert' && this.mode !== 'replace') this.dotCapture = null;
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
    if (this.modal && this.modal(key)) {
      const mc = this.modalCmd?.open ? this.modalCmd : null;
      if (!mc) { this.lastCommand = { keys: [key], kind: 'modal', error: false }; return; }
      mc.keys.push(key);
      if (this.modal != null) { this.lastCommand = null; return; } // the handler may have closed it
      this.modalCmd = null;
      this.lastCommand = { keys: mc.keys, kind: mc.kind ?? 'other', error: false };
      return;
    }
    switch (this.mode) {
      case 'insert':
      case 'replace':
        if (this.dotCapture) this.dotCapture.keys.push(key);
        if (this.depth === 0) this.cmdKeys.push(key);
        return this.insertKey(key);
      case 'cmdline':
        if (this.dotCapture && (this.cmdline?.type === '=' || this.pendingSearchOp)) this.dotCapture.keys.push(key);
        if (this.depth === 0) this.cmdKeys.push(key);
        try {
          return this.cmdlineKey(key);
        } finally {
          if (this.mode !== 'cmdline') this.resumeOneShot(); // a :, / or ? typed after <C-o>
        }
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
    // A command that takes the <Esc> as its own argument (r<C-v><Esc>) is not cancelled by it.
    const takesEsc = res !== 'incomplete' && res !== 'invalid' && !res.rest?.length;
    if (key === '<Esc>' && this.pending.length > 1 && !completesBefore && !takesEsc) {
      this.pending = [];
      if (this.depth === 0) this.finishCommand('other'); // a cancelled command is not part of the next one
      this.resumeOneShot();
      return;
    }
    if (res === 'incomplete') return;
    const keys = this.pending;
    this.pending = [];
    // After a <C-o> command Insert resumes however the command ended: done, cancelled or failed.
    // One that opened the command line resumes when that line is submitted or cancelled.
    try {
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
    } finally {
      this.resumeOneShot();
    }
  }

  /** Back to Insert after the one Normal command a <C-o> allowed, if it has ended. */
  private resumeOneShot() {
    if (this.oneShot && this.mode === 'normal' && this.insert) {
      this.oneShot = false;
      if (!this.dotReplaying) {
        // Vim restarts the insert (restart_edit): typing resumes as a new undo step, a count is
        // dropped, and . repeats only what is typed from here on, as an `i`.
        this.endChange();
        this.beginChange();
        Object.assign(this.insert, { count: 1, typed: '', kind: 'i', block: undefined, arrowed: false });
        this.pendingDot = { reg: null, count: null, body: ['i'], insert: [] };
        this.dotCapture = { keys: [], replaying: false };
      }
      this.mode = 'insert';
      // edit(): back past the end of the line when the <C-o> started there (same line) or
      // curswant lies beyond the cursor (<C-o>$), and the cursor is on the last character.
      const c = this.win.cursor;
      if ((this.oneShotEolLine === c.line || this.win.want > c.col) && c.col === this.line().length - 1) c.col++;
      this.oneShotEolLine = -1;
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
      // r<C-v>{char}: the character literally (a real tab, a ^M that does not split the line),
      // or a code: <C-v>065, <C-v>x41, <C-v>o101, <C-v>u00e9.
      if (kind === 'char' && (keys[j] === '<C-v>' || keys[j] === '<C-q>') && keysToString(cmdKeys) === 'r') {
        const lit = literalChar(keys, j + 1);
        if (lit === 'incomplete') return 'incomplete';
        j = lit.end;
        return lit.ch;
      }
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
      // 'foldopen' (Neovim's default): jumps and searches open folds, and so does any sideways
      // motion ("hor": l, w, f, $ …); j / k and G / gg do not.
      if (res.openFold ?? (res.jump || !res.linewise)) this.openFoldsAt(this.cursor.line);
      this.dotCapture = null;
      if (this.depth === 0) this.finishCommand(this.visual ? 'visual' : 'motion');
      return;
    }

    if (e.type === 'object') {
      // Visual mode: extend the selection to the object.
      const v = this.visual!;
      const [s, en] = this.visualBounds();
      const octx: ObjectCtx = { lines: this.lines, cur: this.cursor, count, visual: cmpPos(s, en) === 0 ? null : { start: s, end: en } };
      const r = e.obj(octx, e.inner);
      if (!r) {
        // Vim moves the cursor while searching and leaves it there on failure.
        if (octx.stop) { this.win.cursor = { ...octx.stop }; this.clampCursor(false); this.win.want = this.cursor.col; }
        fail();
      }
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
        else this.finishCommand(UNDO_KEYS.has(cmdStr) ? 'undo' : this.mode === 'insert' || this.mode === 'replace' ? 'insert' : this.visual ? 'visual' : change ? 'action' : 'other');
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
      this.opStart = range.kind === 'line' ? pos(range.start.line, 0) : range.kind === 'block' ? pos(range.start.line, Math.min(range.start.col, range.end.col)) : { ...range.start };
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
        this.opStart = { ...a };
        let r: Range | null;
        if (res.linewise) r = this.forceKind({ start: pos(a.line, 0), end: pos(b.line, 0), kind: 'line' }, target.force);
        else {
          if (!res.inclusive && cmpPos(a, b) === 0 && !target.force) fail();
          r = this.vimCharwiseRange(a, b, !!res.inclusive, cmdStr === 'd', target.force, true);
        }
        if (!r) fail();
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
  /** Where Vim's operator starts (oap->start) before a linewise range drops the column. */
  opStart: Pos = pos(0, 0);

  private operatorRange(p: Parsed, count: number, hasCount: boolean): Range | null {
    const t = p.target!;
    if (t.kind === 'self') {
      const start = this.cursor.line;
      // The count is in screen lines: a closed fold counts as one.
      let end = start;
      for (let i = 1; i < count && end < this.buf.lineCount; i++) end = (this.closedFoldAt(end)?.end ?? end) + 1;
      // Vim runs cc / dd / gcc as `_`: the start is the earlier of the cursor and the target's first non-blank.
      const fnb = pos(Math.min(end, this.buf.lineCount - 1), firstNonBlank(this.line(Math.min(end, this.buf.lineCount - 1))));
      this.opStart = cmpPos(fnb, this.cursor) < 0 ? fnb : { ...this.cursor };
      if (end >= this.buf.lineCount) {
        // Vim's cursor_down(): a count past the end stops at the last line, but fails on it.
        if ((this.closedFoldAt(start)?.end ?? start) === this.buf.lineCount - 1) return null;
        return { start: pos(this.closedFoldAt(start)?.start ?? start, 0), end: pos(this.buf.lineCount - 1, 0), kind: 'line' };
      }
      // Closed folds at either end are included whole (dd on a fold deletes it).
      return { start: pos(this.closedFoldAt(start)?.start ?? start, 0), end: pos(this.closedFoldAt(end)?.end ?? end, 0), kind: 'line' };
    }
    if (t.kind !== 'entry') return null;
    const te = t.entry;
    const cur = { ...this.cursor };
    this.opStart = { ...cur };
    if (te.type === 'object') {
      const octx: ObjectCtx = { lines: this.lines, cur, count, visual: null };
      const r = te.obj(octx, te.inner);
      if (!r) {
        // Vim moves the cursor while searching and leaves it there on failure.
        if (octx.stop) { this.win.cursor = { ...octx.stop }; this.clampCursor(false); this.win.want = this.cursor.col; }
        return null;
      }
      this.opStart = cmpPos(r.start, r.end) <= 0 ? { ...r.start } : { ...r.end };
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
    [start, end] = this.includeClosedFolds(start, end, !!res.inclusive || !!res.linewise);
    this.opStart = { ...start };
    if (res.linewise) return this.forceKind({ start: pos(start.line, 0), end: pos(end.line, 0), kind: 'line' }, t.force);
    // nvim's bundled matchit maps o_% through a forced characterwise Visual selection, so d% never
    // turns linewise (d/)/e from the same place does).
    if (mkeys === '%' && !hasCount && !t.force && res.inclusive) return { start, end, kind: 'char' };
    // Charwise: o_v, :help exclusive-linewise and :help d apply to every motion.
    if (!res.inclusive && cmpPos(start, end) === 0 && !t.force) return null;
    return this.vimCharwiseRange(start, end, !!res.inclusive, opKeys === 'd', t.force, true);
  }

  /**
   * Outside Visual mode Vim includes closed folds whole (do_pending_operator): a start inside one
   * moves to column 0 of its first line, an end inside one to the end of its last line (for an
   * exclusive motion only when the end is past column 0).
   */
  private includeClosedFolds(start: Pos, end: Pos, inclusiveOrLine: boolean): [Pos, Pos] {
    const fs = this.closedFoldAt(start.line);
    if (fs) start = pos(fs.start, 0);
    const fe = this.closedFoldAt(end.line);
    if (fe && (end.col > 0 || inclusiveOrLine)) end = pos(fe.end, this.line(fe.end).length);
    return [start, end];
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
    // Visual may sit on the end-of-line, like Vim's coladvance() while Visual is active (charwise: the newline).
    this.clampCursor(this.mode === 'visual');
    if (res.want !== undefined) this.win.want = res.want;
    else if (!res.keepWant) this.win.want = cur.col;
    // Like Vim's coladvance(MAXCOL): charwise Visual after $ lands on the end-of-line.
    if (this.visual?.kind === 'v') {
      this.visual.toEol = this.win.want === Infinity;
      if (this.visual.toEol) cur.col = this.line().length;
    }
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
  /** The line <C-o> was typed on when the cursor was past its end, else -1. */
  private oneShotEolLine = -1;

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
      if (c.visual.kind === 'v' && c.visual.toEol) this.win.cursor.col = this.line(endLine).length; // a v$ change repeats to the end-of-line
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
      // Out of a block, a cursor past the line's end ('virtualedit' block) comes back onto it.
      const c = this.cursor;
      c.col = Math.min(c.col, Math.max(0, this.line(c.line).length - 1));
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
    // An end on the end-of-line (col == length) takes the newline.
    return { start: { ...s }, end: pos(e.line, Math.min(e.col, this.line(e.line).length)), kind: 'char' }; // copy: s may alias the cursor
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
    this.buf.checkModifiable();
    this.mode = kind === 'R' ? 'replace' : 'insert';
    this.win.cursor = { ...at };
    this.clampCursor(true);
    this.openFoldsAt(this.cursor.line); // Insert mode opens the folds at the cursor (edit() → foldOpenCursor)
    this.insert = { kind, start: { ...this.cursor }, keys: [], count, pending: '', pendingBuf: '', typed: '', replaced: new Map(), ...extra };
    this.buf.marks.set('[', { ...this.cursor });
  }

  private insertKey(key: Key): void {
    const ins = this.insert!;
    if (ins.pending) return this.insertPending(key);
    if (ins.arrowed && !ARROW_KEEPS.has(key)) this.restartAfterArrow(key);
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
        this.electricIndent(ch);
        const end = this.insertText(c, ch);
        this.win.cursor = end;
        this.electricWord();
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
        const t = this.line();
        // An untyped auto line is left without its trailing blanks, but the new line takes its
        // leader from it as it was (Neovim's open_line(): "  // " gives "  //" and a new "  // ").
        const untyped = !!ins.auto && ins.auto.line === c.line && ins.auto.text === t;
        ins.auto = undefined;
        // 'formatoptions' r (LazyVim): <CR> after a comment leader continues the comment.
        const lead = String(this.opt('formatoptions')).includes('r') ? leaderOf(t, String(this.opt('comments'))) : null;
        const cont = lead && c.col >= lead.indent.length + lead.str.length ? continuation(t, String(this.opt('comments'))) : null;
        if (cont !== null) this.noteContinued('r');
        const indent = cont ?? this.openIndent(c.line, false, t);
        const rest = t.slice(c.col);
        // The first part keeps its trailing blanks (Neovim's open_line() with OPENLINE_KEEPTRAIL).
        b.setLine(c.line, untyped ? t.slice(0, c.col).replace(/[ \t]+$/, '') : t.slice(0, c.col));
        b.splice(c.line + 1, 0, [indent + rest.replace(/^[ \t]+/, '')], { split: true });
        this.win.cursor = pos(c.line + 1, indent.length);
        if (indent && !rest.trim()) ins.auto = { line: c.line + 1, text: this.line(c.line + 1) };
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
        const sw = this.sw();
        typeChar(this.opt('expandtab') ? ' '.repeat(sw - (c.col % sw)) : '\t');
        return;
      }
      // Neovim maps both to <C-g>u first (default-mappings), so each is its own undo step. Like
      // <BS> they stop at the insert start (Vim's Insstart_orig, which <C-g>u leaves alone) unless
      // they begin there; deleting past it moves it.
      case '<C-w>': {
        this.insertUndoBreak();
        const t = this.line();
        const before = t.slice(0, c.col);
        const m = /(\w+|[^\w\s]+)?\s*$/.exec(before)!;
        let cut = m[0].length || (c.col > 0 ? 1 : 0);
        if (cut === 0 && c.line > 0) return this.insertKey('<BS>');
        if (ins.start.line === c.line && ins.start.col < c.col) cut = Math.min(cut, c.col - ins.start.col);
        b.setLine(c.line, before.slice(0, before.length - cut) + t.slice(c.col));
        c.col -= cut;
        if (ins.start.line === c.line && c.col < ins.start.col) ins.start = { ...c };
        ins.keys.push(key);
        return;
      }
      case '<C-u>': {
        this.insertUndoBreak();
        const t = this.line();
        const stop = ins.start.line === c.line && ins.start.col < c.col ? ins.start.col : indentOf(t).length < c.col ? indentOf(t).length : 0;
        b.setLine(c.line, t.slice(0, stop) + t.slice(c.col));
        c.col = stop;
        if (ins.start.line === c.line && c.col < ins.start.col) ins.start = { ...c };
        ins.keys.push(key);
        return;
      }
      case '<C-t>':
      case '<C-d>': {
        const sw = this.sw();
        const t = this.line();
        const lead = indentOf(t), ind = displayWidth(lead, Number(this.opt('tabstop')) || 8);
        const nind = key === '<C-t>' ? ind + sw - (ind % sw) : Math.max(0, ind - (ind % sw || sw));
        const indent = this.indentStr(nind);
        b.setLine(c.line, indent + t.slice(lead.length));
        c.col = Math.max(0, c.col + indent.length - lead.length);
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
        this.win.want = c.col; // curswant follows the typing (it may sit past the end of the line)
        this.oneShotEolLine = c.col >= this.line().length ? c.line : -1;
        // Like leaving insert: what was typed so far is its own undo step.
        if (!this.dotReplaying) this.endChange();
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

  /**
   * An arrow-style move in Insert (Vim's start_arrow): what was typed so far is one finished
   * change, for undo and for . (a count is dropped). The insert restarts, as an i, only when
   * something is typed next (stop_arrow); leaving straight away keeps the change so far for .
   */
  private insertLineArrow(dir: 1 | -1) {
    const ins = this.insert!, c = this.win.cursor;
    const line = c.line + dir;
    if (line < 0 || line >= this.buf.lineCount) return;
    if (!ins.arrowed && !this.dotReplaying) {
      if (this.pendingDot && this.dotCapture) {
        // The capture ends in this <C-g> and its key: the change repeats as if <Esc> came here.
        this.lastChange = { ...this.pendingDot, insert: [...this.dotCapture.keys.slice(0, -2), '<Esc>'] };
      }
      this.pendingDot = null;
      this.dotCapture = null;
      this.endChange();
    }
    Object.assign(ins, { arrowed: true, count: 1, block: undefined });
    this.win.cursor = pos(line, Math.min(ins.start.col, this.line(line).length));
  }

  /** The first edit after an arrow move: a new undo step, repeated by . as an i. */
  private restartAfterArrow(key: Key) {
    const ins = this.insert!;
    if (!this.dotReplaying) {
      this.beginChange();
      this.pendingDot = { reg: null, count: null, body: [this.mode === 'replace' ? 'R' : 'i'], insert: [] };
      this.dotCapture = { keys: [key], replaying: false };
    }
    Object.assign(ins, { arrowed: false, typed: '', kind: this.mode === 'replace' ? 'R' : 'i', start: { ...this.cursor } });
  }

  /** <C-g>u: close the undo block so far and start a new one here. */
  private insertUndoBreak() {
    if (this.snapshotTaken && !this.dotReplaying) {
      this.buf.dropSnapshotIfUnchanged();
      this.buf.snapshot(this.cursor, () => this.cursor);
    }
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
      if (key === 'u') this.insertUndoBreak();
      // <C-g>j / <C-g>k: to the column the insert started in, a line down / up. Other keys
      // are swallowed with the <C-g>, as in Vim.
      const dir = ['j', '<C-j>', '<Down>'].includes(key) ? 1 : ['k', '<C-k>', '<Up>'].includes(key) ? -1 : 0;
      if (dir) this.insertLineArrow(dir);
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

  /**
   * How a new line is indented, by filetype: 'ts' where LazyVim indents with treesitter (its
   * indent queries: in a level after an opener, a closer typed first lines up with it), 'si' for
   * 'smartindent' (text and CSV: in after "{" or an "if"/"for"… line, "}" back out, "#" to column
   * 0), 'ai' for 'autoindent' only (Markdown, YAML: their treesitter indent keeps the line's
   * indent), 'zero' where it gives column 0 (JSON). Checked against LazyVim itself (nvim with the
   * user's config, LazyVim.treesitter.indentexpr()).
   */
  private indentKind(): 'ts' | 'si' | 'ai' | 'zero' {
    const ft = this.buf.filetype;
    return ft === 'json' ? 'zero' : ft === 'markdown' || ft === 'yaml' ? 'ai' : ft === 'text' || ft === 'csv' ? 'si' : 'ts';
  }

  /** Does `line` open a block whose body goes a level in, by the filetype's treesitter indent? */
  private opensBlock(line: string): boolean {
    const ft = this.buf.filetype;
    // A trailing comment doesn't count ("function f() { // a").
    const code = line.replace(ft === 'python' || ft === 'sh' || ft === 'yaml' || ft === 'toml' || ft === 'ruby' ? /\s+#.*$/ : ft === 'lua' ? /\s*--.*$/ : /\s*\/\/.*$/, '').trimEnd();
    if (/[{([]$/.test(code)) return true;
    if (ft === 'python') return /:$/.test(code);
    if (ft === 'lua') return /\b(then|do|else|repeat)$/.test(code) || (/\bfunction\b[^)]*\)$/.test(code) && !/\bend\b/.test(code));
    if (ft === 'sh') return /(\bthen|\bdo|\belse|\bin)$/.test(code);
    if (ft === 'ruby') return /\b(do|then|else)$/.test(code) || /^\s*(def|class|module|if|unless|while|until|case|begin)\b/.test(code);
    return false;
  }

  /**
   * The indent for a line opened below line `at` (o, <CR>; `text` its text when it is being split),
   * or above it (O): 'autoindent', a level more after an opener, and back to a comment's own
   * indent after the line that closes it.
   */
  openIndent(at: number, above = false, text = this.line(at)): string {
    if (!this.opt('autoindent')) return '';
    let kind = this.indentKind();
    // JSON: complete objects and arrays indent as code; an unfinished file (a bracket left open)
    // gives column 0, as LazyVim's JSON indent does while the text doesn't parse.
    if (kind === 'zero') {
      const t = blankStrings(this.buf.text());
      if ((t.match(/[{[]/g) ?? []).length !== (t.match(/[}\]]/g) ?? []).length) return '';
      kind = 'ts';
    }
    // O: treesitter indents the new line by where it is, so as an o from the line above would;
    // smartindent only goes in after an opener above.
    if (above) {
      const prev = at > 0 ? this.line(at - 1) : null;
      if (prev !== null && kind === 'ts') return this.openIndent(at - 1);
      if (prev !== null && kind === 'si' && this.siOpens(prev)) return indentOf(prev) + this.indentStr(this.sw());
      return indentOf(text);
    }
    const l = leaderOf(text, String(this.opt('comments')));
    if (l?.part === 'e') {
      for (let k = at - 1; k >= 0; k--) if (leaderOf(this.line(k), String(this.opt('comments')))?.part === 's') return indentOf(this.line(k));
    }
    const base = indentOf(text), ft = this.buf.filetype, sw = this.sw();
    const ts = Number(this.opt('tabstop')) || 8;
    const out = (n: number) => this.indentStr(Math.max(0, n));
    const width = displayWidth(base, ts);
    if (kind === 'ts' && ft === 'python') {
      // A bracket left open mid-line: the next line lines up after the outermost one, except a
      // parenthesised return value, which keeps the line's indent.
      const code = text.replace(/\s+#.*$/, '');
      const open = unclosedBracket(code);
      if (open >= 0 && open < code.trimEnd().length - 1) {
        return /^\s*return\s*\($/.test(code.slice(0, open + 1)) ? base : out(displayWidth(text.slice(0, open + 1), ts));
      }
      // After return the function is over: column 0, however deep (the indent stays when nothing
      // encloses it). After break or continue the loop's block is over: out to its header's
      // indent. pass and raise keep the indent.
      const ret = /^\s*return\b/.test(text);
      if (ret || /^\s*(break|continue)\b/.test(text)) {
        for (let k = at - 1; k >= 0; k--) {
          const u = this.line(k);
          if (u.trim() && displayWidth(indentOf(u), ts) < width) return ret ? '' : indentOf(u);
        }
        return base;
      }
    }
    if (ft === 'yaml' && /:\s*(#.*)?$/.test(text)) {
      // A list item's key goes a level in; any other key does when it has children below.
      if (/^\s*- /.test(text)) return out(width + sw);
      let k = at + 1;
      while (k < this.buf.lineCount && !this.line(k).trim()) k++;
      if (k < this.buf.lineCount && displayWidth(indentOf(this.line(k)), ts) > width) return out(width + sw);
      return base;
    }
    if (kind === 'ts' && /^(typescript|javascript|c)$/.test(ft)) {
      // A braceless `if (…)` (only if: not for, while or else) indents its one statement, and the
      // line after that statement goes back out. A condition split over lines counts from its if.
      const ifAt = (k: number) => {
        const code = blankStrings(this.line(k)).replace(/\s*\/\/.*$/, '');
        if (/^\s*if\s*\(.*\)\s*$/.test(code)) return k;
        if (!/\)\s*$/.test(code)) return -1;
        let depth = 0;
        for (let j = k; j >= 0 && j > k - 10; j--) {
          const u = blankStrings(this.line(j));
          for (let i = u.length - 1; i >= 0; i--) depth += u[i] === ')' ? 1 : u[i] === '(' ? -1 : 0;
          if (depth <= 0) return j < k && /^\s*if\s*\(/.test(u) ? j : -1;
        }
        return -1;
      };
      const head = ifAt(at);
      if (head >= 0) return out(displayWidth(indentOf(this.line(head)), ts) + sw);
      if (at > 0 && !/[{([]\s*$/.test(text)) {
        const prev = ifAt(at - 1);
        if (prev >= 0 && width > displayWidth(indentOf(this.line(prev)), ts)) return indentOf(this.line(prev));
      }
    }
    // Rust: a statement left without its ; inside a block continues on a level in.
    if (kind === 'ts' && ft === 'rust' && width > 0 && text.trim() && !/[;,{}]\s*$/.test(text.replace(/\s*\/\/.*$/, ''))) return out(width + sw);
    const opens = kind === 'ts' ? this.opensBlock(text) : kind === 'si' && this.siOpens(text);
    return opens ? base + this.indentStr(sw) : base;
  }

  private siOpens(line: string): boolean {
    return !!this.opt('smartindent') && (/\{\s*$/.test(line) || /^\s*(if|else|while|do|for|switch)\b/.test(line));
  }

  /**
   * Block-ending words typed first on a line go back to the indent of their block's opener, as
   * treesitter's indentkeys have it (Lua's end, else, elseif, until; the shell's fi, done, esac,
   * else, elif). Called after each typed character.
   */
  private electricWord() {
    if (!this.opt('autoindent') || this.indentKind() !== 'ts') return;
    const ft = this.buf.filetype;
    const words = ft === 'lua' ? /^(end|else|elseif|until)$/ : ft === 'sh' ? /^(fi|done|esac|else|elif)$/ : ft === 'ruby' ? /^(end|else|elsif|when|rescue|ensure)$/ : null;
    const c = this.cursor, t = this.line();
    if (!words || !words.test(t.slice(0, c.col).trim()) || t.slice(c.col).trim()) return;
    // The opener this closes: walking up, the first line that opens a block and sits left of
    // every line passed on the way (blocks closed in between are skipped by that).
    const ts = Number(this.opt('tabstop')) || 8;
    const width = (u: string) => displayWidth(indentOf(u), ts);
    let min = Infinity, want: string | null = null;
    for (let k = c.line - 1; k >= 0 && want === null; k--) {
      const u = this.line(k);
      if (!u.trim()) continue;
      if (width(u) < min && this.opensBlock(u)) want = indentOf(u);
      min = Math.min(min, width(u));
    }
    if (want === null) return;
    const lead = indentOf(t);
    if (want === lead) return;
    this.buf.setLine(c.line, want + t.slice(lead.length));
    c.col += want.length - lead.length;
  }

  /** A closing bracket (or smartindent's "#") typed first on a line moves the line's indent. */
  private electricIndent(ch: string) {
    const kind = this.indentKind(), ts = kind === 'ts';
    if (!this.opt('autoindent') || !(ts ? '}])' : this.opt('smartindent') ? (kind === 'si' ? '}#' : '#') : '').includes(ch)) return;
    const c = this.cursor, t = this.line();
    if (t.slice(0, c.col).trim()) return;
    let want: string;
    if (ch === '#') want = '';
    else {
      // The opener this closes: the nearest unmatched one above.
      const open = ({ '}': '{', ']': '[', ')': '(' } as Record<string, string>)[ch];
      let depth = 0, found: string | null = null;
      for (let l = c.line - 1; l >= 0 && found === null; l--) {
        const u = this.line(l);
        for (let i = u.length - 1; i >= 0; i--) {
          if (u[i] === ch) depth++;
          else if (u[i] === open && depth-- === 0) { found = indentOf(u); break; }
        }
      }
      // smartindent without a match: one level out.
      want = found ?? (ts ? indentOf(t) : this.indentStr(Math.max(0, displayWidth(indentOf(t), Number(this.opt('tabstop')) || 8) - this.sw())));
    }
    const lead = t.slice(0, c.col);
    if (want === lead) return;
    this.buf.setLine(c.line, want + t.slice(c.col));
    c.col = want.length;
  }

  /** A comment continued by o/O ('o') or <CR> ('r'): noted where plain Neovim's ftplugin wouldn't. */
  noteContinued(flag: 'o' | 'r') {
    if (plainFo(this.buf.filetype).includes(flag)) return;
    this.noteLazy('comment', `LazyVim continued the comment on the new line (formatoptions ${flag}). Plain Neovim leaves a new line empty in ${this.buf.filetype} files.`);
  }

  /** A line opened with an automatic indent or leader and left untyped loses its trailing blanks. */
  private trimAuto() {
    const a = this.insert?.auto;
    if (!a) return;
    this.insert!.auto = undefined;
    if (a.line >= this.buf.lineCount || this.line(a.line) !== a.text) return;
    const t = a.text.replace(/[ \t]+$/, '');
    if (t === a.text) return;
    this.buf.setLine(a.line, t);
    if (this.cursor.line === a.line) this.win.cursor = pos(a.line, Math.min(this.cursor.col, t.length));
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
    let blockStart: Pos | null = null;
    if (ins.block && ins.typed && !ins.typed.includes('\n')) {
      const { first, last, col, append, toEol, left } = ins.block;
      if (left !== undefined) blockStart = pos(first, left);
      for (let l = first + 1; l <= last; l++) {
        const t = this.line(l);
        if (append && toEol) this.buf.setLine(l, t + ins.typed);
        else if (t.length >= col || append || ins.block.pad) this.buf.setLine(l, t.padEnd(col) .slice(0, Math.max(col, append ? col : 0)) + ins.typed + t.slice(col));
      }
    }
    // Remove whitespace-only line left by o/O/cc when leaving immediately.
    const typedNothing = ins.typed === '' && (ins.kind === 'o' || ins.kind === 'O' || ins.kind === 'cc');
    if (typedNothing && this.line().trim() === '' && this.line() !== '') this.buf.setLine(this.cursor.line, '');
    this.trimAuto();
    this.lastInserted = ins.typed;
    this.buf.marks.set('^', { ...this.cursor });
    this.buf.marks.set(']', pos(this.cursor.line, Math.max(0, this.cursor.col - 1)));
    this.insert = null;
    this.mode = 'normal';
    if (blockStart) this.win.cursor = blockStart; // op_insert(): back to the block's top-left
    else if (this.cursor.col > 0) this.win.cursor.col--;
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
        // The view incsearch showed goes back too: the search jumps from where it started.
        if ((cl.type === '/' || cl.type === '?') && cl.saved) { this.win.cursor = { ...cl.saved.cursor }; this.win.top = cl.saved.top; }
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

  /**
   * 'ignorecase' (LazyVim, with smartcase): note it the first time a match was found only because
   * case was ignored, that is, the pattern matched case-sensitively wouldn't match there. A \c or
   * \C in the pattern is the learner's own choice: no note.
   */
  noteIgnoreCase(pattern: string, line: number, col: number, len: number, star = false) {
    if (!this.opt('ignorecase') || /\\[cC]/.test(pattern)) return;
    let re: RegExp;
    try { const c = compile(pattern, {}).re; re = new RegExp(c.source, c.flags.replace(/[gy]/g, '') + 'y'); } catch { return; }
    const t = this.buf.line(line);
    re.lastIndex = col;
    const m = re.exec(t);
    if (m && m[0].length === len) return;
    const found = t.slice(col, col + len);
    this.noteLazy('ignorecase', star
      ? `LazyVim ignores case (ignorecase), and * and # don't use smartcase, so they found "${found}". Plain Vim matches case exactly.`
      : `LazyVim ignores case unless you type a capital (ignorecase + smartcase), so "${pattern}" found "${found}". Plain Vim matches case exactly.`);
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
    this.noteIgnoreCase(pattern, m.start.line, m.start.col, (m.end.line === m.start.line ? m.end.col + 1 : this.line(m.start.line).length) - m.start.col, !!opts.noSmartcase);
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
/**
 * The character a <C-v> prefix produces from keys[i...], after Vim's get_literal(): x / o / u / U
 * switch to hex, octal or Unicode (at any point), digits accumulate up to their limit, and the
 * first other key ends the code. With no digit that key itself is the character; after digits it
 * is consumed with them (what the headless nvim oracle shows).
 */
export function literalChar(keys: Key[], i: number): { ch: string; end: number } | 'incomplete' {
  let hex = false, octal = false, unicode = '', cc = 0, n = 0, j = i;
  let last: Key | null = null;
  while (last === null) {
    const k = keys[j];
    if (k === undefined) return 'incomplete';
    j++;
    if (k === 'x' || k === 'X') hex = true;
    else if (k === 'o' || k === 'O') octal = true;
    else if (k === 'u' || k === 'U') unicode = k;
    else {
      const d = hex || unicode ? /^[0-9a-fA-F]$/ : octal ? /^[0-7]$/ : /^[0-9]$/;
      if (!d.test(k)) { last = k; break; }
      cc = cc * (hex || unicode ? 16 : octal ? 8 : 10) + parseInt(k, 16);
      n++;
      if (cc > 255 && !unicode) cc = 255;
      if (n >= (hex ? 2 : unicode === 'u' ? 4 : unicode === 'U' ? 8 : 3)) break;
    }
  }
  if (n === 0) return { ch: keysToRegister([last!]), end: j };
  return { ch: String.fromCodePoint(Math.min(cc || 10, 0x10ffff)), end: j };
}

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
