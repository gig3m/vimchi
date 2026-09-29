// Edit rules: windows of segments a better Vim user would have typed differently.
import type { Segment } from './segment';

export type Suggestion = { keys: string; saves: number; why: string; rule: string; uses: string[] };
export type RuleCtx = { lines: readonly string[] };
export type Rule = { id: string; uses: string[]; apply(segs: Segment[], i: number, ctx: RuleCtx): { consumed: number; suggestion: Suggestion } | null };

export const WHY: Record<string, string> = {
  'count-x': 'A count repeats a command: 3x deletes three characters.',
  'count-x-word': 'de deletes to the end of the word in one go.',
  'x-i-to-r': 'r replaces the character under the cursor without entering insert mode.',
  'A-at-eol': 'A appends at the end of the line from anywhere on it.',
  'I-at-bol': 'I inserts at the first non-blank character of the line.',
  ddp: 'ddp swaps a line with the one below it.',
  'count-dd': 'A count before dd deletes several lines at once.',
  'dot-repeat': '. repeats the last change.',
  cw: 'cw changes the word and drops you into insert mode.',
  'o-not-A-CR': 'o opens a new line below and enters insert mode.',
  motion: 'Fewer keys to the same spot.',
};

const keys = (s: Segment) => s.keys.join('');
const edit = (s: Segment | undefined) => (s && s.kind === 'edit' ? s : null);
const motion = (s: Segment | undefined) => (s && s.kind === 'motion' ? s : null);
const insertText = (k: string) => { const m = /^[iaAIoO](.*)<Esc>$/.exec(k); return m ? m[1] : null; };
const isWord = (l: string, col: number, n: number) => {
  const span = l.slice(col, col + n);
  return /^[A-Za-z0-9_]+$/.test(span) && (col === 0 || !/[A-Za-z0-9_]/.test(l[col - 1])) && !/[A-Za-z0-9_]/.test(l[col + n] ?? ' ');
};
/** Key count of a notation string: <Esc>, <CR> etc. are one key each. */
export const keyCount = (s: string) => s.replace(/<[^>]+>/g, 'K').length;
const mk = (rule: string, keys: string, learnerKeys: number, uses: string[], why = WHY[rule]): Suggestion => ({ keys, saves: learnerKeys - keyCount(keys), why, rule, uses });

export const RULES: Rule[] = [
  {
    id: 'count-x', uses: ['x', 'COUNT'],
    apply(segs, i, ctx) {
      let n = 0;
      while (edit(segs[i + n]) && keys(segs[i + n]) === 'x') n++;
      if (n < 3) return null;
      const s = segs[i] as Segment & { kind: 'edit' };
      const l = ctx.lines[s.from.line];
      if (s.from.col + n > l.length) return null; // x walked backwards at end of line
      if (isWord(l, s.from.col, n)) return { consumed: n, suggestion: mk('count-x', 'de', n, ['d', 'e'], WHY['count-x-word']) };
      return { consumed: n, suggestion: mk('count-x', `${n}x`, n, ['x', 'COUNT']) };
    },
  },
  {
    id: 'x-i-to-r', uses: ['r'],
    apply(segs, i) {
      const a = edit(segs[i]), b = edit(segs[i + 1]);
      if (!a || !b || keys(a) !== 'x') return null;
      const t = insertText(keys(b));
      if (t === null || t.length !== 1 || !/^[ia]/.test(keys(b))) return null;
      if (b.from.line !== a.from.line || b.from.col !== a.from.col) return null;
      return { consumed: 2, suggestion: mk('x-i-to-r', `r${t}`, a.keys.length + b.keys.length, ['r']) };
    },
  },
  {
    id: 'A-at-eol', uses: ['A'],
    apply(segs, i, ctx) {
      const m = motion(segs[i]), e = edit(segs[i + 1]);
      if (!m || !e || !/^a/.test(keys(e))) return null;
      if (m.to.col !== Math.max(0, ctx.lines[m.to.line].length - 1)) return null;
      const t = insertText(keys(e)); if (t === null) return null;
      return { consumed: 2, suggestion: mk('A-at-eol', `A${t}<Esc>`, m.keys.length + e.keys.length, ['A']) };
    },
  },
  {
    id: 'I-at-bol', uses: ['I'],
    apply(segs, i) {
      const m = motion(segs[i]), e = edit(segs[i + 1]);
      if (!m || !e || keys(m) !== '^' || !/^i/.test(keys(e))) return null;
      const t = insertText(keys(e)); if (t === null) return null;
      return { consumed: 2, suggestion: mk('I-at-bol', `I${t}<Esc>`, m.keys.length + e.keys.length, ['I']) };
    },
  },
  {
    id: 'ddp', uses: ['dd', 'p'],
    apply(segs, i) {
      const a = edit(segs[i]), m = motion(segs[i + 1]), b = edit(segs[i + 2]);
      if (!a || !m || !b || keys(a) !== 'dd') return null;
      if (keys(m) === 'j' && keys(b) === 'P') return { consumed: 3, suggestion: mk('ddp', 'ddp', 4, ['dd', 'p']) };
      if (keys(m) === 'k' && keys(b) === 'P') return { consumed: 3, suggestion: mk('ddp', 'ddkP', 4, ['dd', 'k', 'P']) };
      return null;
    },
  },
  {
    id: 'count-dd', uses: ['dd', 'COUNT'],
    apply(segs, i) {
      let n = 0;
      while (edit(segs[i + n]) && keys(segs[i + n]) === 'dd') n++;
      if (n < 2) return null;
      return { consumed: n, suggestion: mk('count-dd', `${n}dd`, 2 * n, ['dd', 'COUNT']) };
    },
  },
  {
    id: 'cw', uses: ['c', 'w'],
    apply(segs, i) {
      const a = edit(segs[i]), b = edit(segs[i + 1]);
      if (!a || !b) return null;
      const t = insertText(keys(b));
      if (t === null || !/^i/.test(keys(b)) || b.from.line !== a.from.line || b.from.col !== a.from.col) return null;
      if (keys(a) === 'de') return { consumed: 2, suggestion: mk('cw', `cw${t}<Esc>`, a.keys.length + b.keys.length, ['c', 'w']) };
      if (keys(a) === 'dw' && t.endsWith(' ')) return { consumed: 2, suggestion: mk('cw', `cw${t.slice(0, -1)}<Esc>`, a.keys.length + b.keys.length, ['c', 'w']) };
      return null;
    },
  },
  {
    id: 'o-not-A-CR', uses: ['o'],
    apply(segs, i) {
      const e = edit(segs[i]); if (!e) return null;
      const m = /^A<CR>(.*)<Esc>$/.exec(keys(e)); if (!m) return null;
      return { consumed: 1, suggestion: mk('o-not-A-CR', `o${m[1]}<Esc>`, e.keys.length, ['o']) };
    },
  },
  {
    id: 'dot-repeat', uses: ['.'],
    apply(segs, i) {
      const a = edit(segs[i]); if (!a || a.command === 'visual') return null;
      let j = i + 1;
      while (motion(segs[j])) j++;
      const b = edit(segs[j]); if (!b || keys(b) !== keys(a)) return null;
      if (b.keys.length - 1 < 2) return null; // saves ≥ 2
      // The suggestion replaces the whole window: the first change, the motions between, then `.`.
      const window = segs.slice(i, j + 1);
      const learner = window.reduce((n, s) => n + s.keys.length, 0);
      const keysBetween = window.slice(0, -1).map(keys).join('');
      return { consumed: j - i + 1, suggestion: mk('dot-repeat', `${keysBetween}.`, learner, ['.']) };
    },
  },
];
