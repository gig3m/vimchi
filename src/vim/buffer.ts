import { type Pos, pos } from './types';

type Snapshot = { lines: string[]; cursor: Pos; changedLine: number };

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
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
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
    this.lines[n] = text;
    this.modified = true;
  }

  setText(text: string) {
    this.lines = splitText(text);
    this.modified = true;
  }

  // ---- undo --------------------------------------------------------------

  /** Record the state before a change. Call once per undoable command. */
  snapshot(cursor: Pos, changedLine = cursor.line) {
    this.undoStack.push({ lines: this.lines.slice(), cursor: { ...cursor }, changedLine });
    if (this.undoStack.length > 500) this.undoStack.shift();
    this.redoStack = [];
  }

  /** Drop the last snapshot if the command turned out not to change anything. */
  dropSnapshotIfUnchanged() {
    const top = this.undoStack[this.undoStack.length - 1];
    if (top && top.lines.length === this.lines.length && top.lines.every((l, i) => l === this.lines[i])) {
      this.undoStack.pop();
      return true;
    }
    return false;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  undo(cursor: Pos): Pos | null {
    const s = this.undoStack.pop();
    if (!s) return null;
    this.redoStack.push({ lines: this.lines, cursor: { ...cursor }, changedLine: s.changedLine });
    const firstDiff = firstDifferentLine(this.lines, s.lines);
    this.lines = s.lines;
    this.modified = true;
    return pos(Math.min(firstDiff ?? s.changedLine, this.lines.length - 1), firstDiff == null ? s.cursor.col : 0);
  }

  redo(cursor: Pos): Pos | null {
    const s = this.redoStack.pop();
    if (!s) return null;
    this.undoStack.push({ lines: this.lines, cursor: { ...cursor }, changedLine: s.changedLine });
    const firstDiff = firstDifferentLine(this.lines, s.lines);
    this.lines = s.lines;
    this.modified = true;
    return pos(Math.min(firstDiff ?? s.changedLine, this.lines.length - 1), 0);
  }

  undoCount() {
    return this.undoStack.length;
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

function firstDifferentLine(a: string[], b: string[]): number | null {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return null;
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
