import { type Pos, pos } from './types';

/** One state in the undo tree: the text after change `seq` (0 = the text as loaded). */
type UndoNode = {
  seq: number;
  lines: string[];
  parent: UndoNode | null;
  /** The child <C-r> redoes: the branch most recently undone from or travelled to. */
  next: UndoNode | null;
  /** Cursor when the change's first edit happened; undo and redo return there. */
  cursor: Pos;
};
/** The change being recorded, between snapshot() and its commit. */
type Pending = { before: string[]; cursor: Pos; hinted: boolean; edited: boolean; live?: () => Pos; entry?: boolean };

let nextId = 1;

export type BufferKind = 'file' | 'nofile' | 'quickfix' | 'cmdwin' | 'plugin';

export class Buffer {
  readonly id = nextId++;
  lines: string[];
  name: string;
  kind: BufferKind;
  filetype: string;
  listed = true;
  modified = false;
  readonly = false;
  /** Lowercase marks plus automatic ones: [ ] < > . ^ " */
  marks = new Map<string, Pos>();
  changelist: Pos[] = [];
  changeIdx = -1;
  /** Arbitrary per-buffer data for plugins (e.g. the oil directory it lists). */
  data: Record<string, unknown> = {};
  /** Buffer-local mappings (see Vim.mapLocal). Keys are joined key sequences. */
  localMaps: Record<'n' | 'v' | 'o', Map<string, unknown>> = { n: new Map(), v: new Map(), o: new Map() };
  localPrefixes: Record<'n' | 'v' | 'o', Set<string>> = { n: new Set(), v: new Set(), o: new Set() };
  /** For U: the line being edited and its text before the edits started. */
  lineUndo: { line: number; text: string } | null = null;

  constructor(name: string, text: string | string[], opts: { kind?: BufferKind; filetype?: string } = {}) {
    this.name = name;
    this.lines = typeof text === 'string' ? splitText(text) : text.slice();
    if (!this.lines.length) this.lines = [''];
    this.kind = opts.kind ?? 'file';
    this.filetype = opts.filetype ?? filetypeOf(name);
    this.undoRoot.lines = this.lines.slice();
  }

  get lineCount() {
    return this.lines.length;
  }

  line(n: number) {
    return this.lines[n] ?? '';
  }

  text() {
    return this.lines.join('\n');
  }

  // ---- editing -----------------------------------------------------------

  /** Replace `count` lines starting at `start` with `repl`, shifting marks. */
  splice(start: number, count: number, repl: string[]) {
    if (count || repl.length) this.markEdited();
    this.lines.splice(start, count, ...repl);
    if (!this.lines.length) this.lines = [''];
    const delta = repl.length - count;
    if (delta !== 0) {
      for (const [k, p] of this.marks) {
        if (p.line >= start + count) this.marks.set(k, pos(p.line + delta, p.col));
        else if (p.line >= start + repl.length && delta < 0) {
          // Line holding the mark was deleted.
          if (/^[a-z]$/.test(k) || k.startsWith('\u0001')) this.marks.delete(k);
          else this.marks.set(k, pos(Math.max(0, Math.min(start, this.lines.length - 1)), 0));
        }
      }
    }
    this.modified = true;
  }

  setLine(n: number, text: string) {
    if (this.lines[n] !== text) this.markEdited();
    this.lines[n] = text;
    this.modified = true;
  }

  setText(text: string) {
    if (text !== this.lines.join('\n')) this.markEdited();
    this.lines = splitText(text);
    this.modified = true;
  }

  // ---- undo --------------------------------------------------------------
  //
  // Undo history is a tree of whole-buffer states, as in Vim: every committed change is a node
  // numbered in time order (`seq`), a change made after undoing starts a new branch, `u`/<C-r>
  // walk the current branch and g-/g+ step through the states in time order across branches.
  //
  // Cursor placement follows Neovim's u_undoredo(): each change remembers the cursor at the
  // moment its first edit happened (for an operator: the start of the operated text). Undo and
  // redo put the cursor back there when that line borders the changed block, else on the first
  // changed line.

  private undoRoot: UndoNode = { seq: 0, lines: [], parent: null, next: null, cursor: pos(0, 0) };
  private undoCur: UndoNode = this.undoRoot;
  private undoNodes: UndoNode[] = [this.undoRoot];
  private pending: Pending | null = null;

  /**
   * Record the state before a change. Call once per undoable command; it is committed by
   * dropSnapshotIfUnchanged() (or the next snapshot/undo). `live` reports the cursor so the
   * change can remember where its first edit happened.
   */
  snapshot(cursor: Pos, live?: () => Pos) {
    this.commitPending();
    this.pending = { before: this.lines.slice(), cursor: { ...cursor }, hinted: false, edited: false, live };
  }

  /**
   * Where undo/redo of the open change put the cursor (an operator's start). Ignored once the
   * change has edited the text, unless `force`d; a later call before the first edit wins.
   */
  setUndoCursor(p: Pos, force = false) {
    const pd = this.pending;
    if (pd && (force || !pd.edited)) {
      pd.cursor = { ...p };
      pd.hinted = true;
    }
  }

  /**
   * Called by every mutator before it changes the text; also by commands that save undo state
   * in Vim without changing anything (x on an empty line), which costs the redo branch.
   */
  markEdited() {
    const pd = this.pending;
    if (!pd) return;
    if (!pd.edited && !pd.hinted && pd.live) pd.cursor = { ...pd.live() };
    pd.edited = true;
  }

  /**
   * Close the open change: commit it, or drop it if the text did not change. A dropped change
   * that still edited the text (typed then erased) loses the redo branch, as in Vim; one that
   * never touched the text (an empty insert, a failed command) keeps it.
   */
  /**
   * The open change is an undo step even if the text comes out the same (r onto the same
   * character: Vim saved the line, so undo has a step to take and redo is gone).
   */
  markUndoEntry() {
    this.markEdited();
    if (this.pending) this.pending.entry = true;
  }

  dropSnapshotIfUnchanged() {
    const pd = this.pending;
    if (!pd) return false;
    if (sameLines(pd.before, this.lines) && !pd.entry) {
      this.pending = null;
      if (pd.edited) this.undoCur.next = null;
      return true;
    }
    this.commitPending();
    return false;
  }

  private commitPending() {
    const pd = this.pending;
    if (!pd) return;
    this.pending = null;
    if (sameLines(pd.before, this.lines) && !pd.entry) {
      if (pd.edited) this.undoCur.next = null;
      return;
    }
    const parent = this.undoCur;
    // Text changed outside undo (a plugin assigning lines) belongs to the parent state.
    parent.lines = pd.before;
    const node: UndoNode = { seq: this.undoNodes.length, lines: this.lines.slice(), parent, next: null, cursor: pd.cursor };
    this.undoNodes.push(node);
    parent.next = node;
    this.undoCur = node;
  }

  get canUndo() {
    return this.undoCur !== this.undoRoot || (!!this.pending && !sameLines(this.pending.before, this.lines));
  }

  /** Undo one change; returns where the cursor goes, or null at the oldest change. */
  undo(cursor: Pos, want = cursor.col): Pos | null {
    this.commitPending();
    const node = this.undoCur;
    if (!node.parent) return null;
    const before = this.lines;
    this.restore(node.parent);
    node.parent.next = node;
    return this.placeCursor(node, before, want);
  }

  /** Redo one change on the current branch; null at the newest change. */
  redo(cursor: Pos, want = cursor.col): Pos | null {
    this.commitPending();
    const node = this.undoCur.next;
    if (!node) return null;
    const before = this.lines;
    this.restore(node);
    return this.placeCursor(node, before, want);
  }

  /** g- / g+: move `steps` states back (negative) or forward in time; null if already there. */
  undoTime(steps: number, cursor: Pos, want = cursor.col): Pos | null {
    this.commitPending();
    const from = this.undoCur;
    const seq = Math.max(0, Math.min(this.undoNodes.length - 1, from.seq + steps));
    const target = this.undoNodes[seq];
    if (target === from) return null;
    // Point every redo link from the root down at the target, so <C-r> continues its branch.
    for (let n = target; n.parent; n = n.parent) n.parent.next = n;
    let ancestor = false;
    for (let n: UndoNode | null = from; n; n = n.parent) if (n === target) ancestor = true;
    if (ancestor) {
      // Pure undo: the last step undid target's child on the path from `from`.
      let child = from;
      while (child.parent !== target) child = child.parent!;
      const before = child.lines;
      this.restore(target);
      return this.placeCursor(child, before, want);
    }
    // The last step redid `target` itself.
    this.restore(target);
    return this.placeCursor(target, target.parent!.lines, want);
  }

  undoCount() {
    let n = 0;
    for (let c: UndoNode | null = this.undoCur; c && c.parent; c = c.parent) n++;
    return n;
  }

  private restore(n: UndoNode) {
    this.lines = n.lines.slice();
    this.undoCur = n;
    this.modified = true;
  }

  /** Neovim's cursor rule after undoing/redoing `node` (u_undoredo in undo.c). */
  private placeCursor(node: UndoNode, before: string[], want: number): Pos {
    const after = this.lines;
    let pre = 0;
    while (pre < before.length && pre < after.length && before[pre] === after[pre]) pre++;
    let suf = 0;
    while (suf < before.length - pre && suf < after.length - pre && before[before.length - 1 - suf] === after[after.length - 1 - suf]) suf++;
    const newSize = after.length - pre - suf;
    const uh = node.cursor;
    // The remembered line wins when it touches the changed block (one line above to one below).
    let line = uh.line >= pre - 1 && uh.line <= pre + newSize ? uh.line : pre;
    // Off by one line below the remembered position: go back to it (Vim's rule for "o").
    if (uh.line + 1 === line && line > 0) line--;
    line = Math.max(0, Math.min(line, after.length - 1));
    return pos(line, line === uh.line ? uh.col : want);
  }

  recordChange(p: Pos) {
    const last = this.changelist[this.changelist.length - 1];
    if (last && last.line === p.line) this.changelist[this.changelist.length - 1] = { ...p };
    else this.changelist.push({ ...p });
    if (this.changelist.length > 100) this.changelist.shift();
    this.changeIdx = this.changelist.length;
    this.marks.set('.', { ...p });
  }
}

function sameLines(a: string[], b: string[]) {
  return a.length === b.length && a.every((l, i) => l === b[i]);
}

export function splitText(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function filetypeOf(name: string): string {
  const ext = /\.([A-Za-z0-9]+)$/.exec(name)?.[1]?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', json: 'json',
    lua: 'lua', md: 'markdown', py: 'python', go: 'go', rs: 'rust', html: 'html', css: 'css', sh: 'sh',
    vim: 'vim', txt: 'text', csv: 'csv', yaml: 'yaml', yml: 'yaml', toml: 'toml', c: 'c', h: 'c', rb: 'ruby',
  };
  if (/(^|\/)\.?(bashrc|zshrc)$/.test(name)) return 'sh';
  return map[ext] ?? 'text';
}

export const COMMENT_STRINGS: Record<string, string> = {
  typescript: '// %s', javascript: '// %s', go: '// %s', rust: '// %s', c: '// %s', css: '/* %s */', json: '// %s',
  lua: '-- %s', python: '# %s', sh: '# %s', yaml: '# %s', toml: '# %s', ruby: '# %s', vim: '" %s',
  html: '<!-- %s -->', markdown: '<!-- %s -->', text: '# %s', csv: '# %s',
};
