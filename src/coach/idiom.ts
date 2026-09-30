// Edit-equivalence search: given an edit window's net change, which single command from the
// taught grammar makes the same change? `[count] operator (motion | text-object)`,
// `[count] x/X/~`, `r s S C D cc dd J >> <<`, an insert command plus its text, and the swaps
// `ddp`/`xp`. Candidates run on a scratch editor reset to the window's start; the caller
// replay-verifies the winner on a fresh one (sameOutcome/stateNeeds), so nothing here has to
// model Vim exactly. Ranked by style, not raw keys: a text object beats a find, a find beats a
// word motion, a word motion beats a count, and a long x-run is the habit being unlearned.
import type { Vim } from '../vim/editor';
import type { Key } from '../vim/keys';

/** `typed` is the text the idiom types in insert mode ('' for a pure normal-mode command). */
export type Idiom = { keys: Key[]; uses: string[]; pattern: string; style: number; commands: number; typed: string; longCount?: boolean };
export type IdiomOpts = {
  taught: Set<string>;
  /** Longest suggestion worth trying (the learner's window, in keys). */
  maxKeys: number;
};

/** `charwise`: a character motion (word, find, line position) whose delete must stay characterwise. */
type Cand = { cmd: Key[]; insert: boolean; uses: string[]; pattern: string; penalty: number; commands?: number; longCount?: boolean; charwise?: boolean };

const WORDS = ['w', 'b', 'e', 'W', 'B', 'E', 'ge', 'gE'];
const OBJECTS = ['iw', 'aw', 'iW', 'aW', 'i"', 'a"', "i'", "a'", 'i`', 'a`', 'i(', 'a(', 'ib', 'ab', 'i{', 'a{', 'iB', 'aB', 'i[', 'a[', 'i<', 'a<', 'it', 'at', 'is', 'as', 'ip', 'ap'];
const OPS: { op: string; insert: boolean }[] = [
  { op: 'd', insert: false }, { op: 'c', insert: true }, { op: 'gU', insert: false }, { op: 'gu', insert: false }, { op: 'g~', insert: false }, { op: '>', insert: false }, { op: '<', insert: false },
];
/** Style penalties on top of the key count (lower is better). `dj`/`dk` reach one line; a count on dd says how many (their own lesson still prefers them). */
const P = { object: -0.6, find: 0.5, line: 0.5, linewise: 3, word: 1, count: 1.5 };

const objectPattern = (o: string) => (/[wW]$/.test(o) ? 'text-object' : /["'`]$/.test(o) ? 'quote-object' : /[t]$/.test(o) ? 'tag-object' : /[sp]$/.test(o) ? 'block-object' : 'bracket-object');
const opPattern = (op: string, motionPattern: string) =>
  op === 'gU' || op === 'gu' || op === 'g~' ? 'case-op' : op === '>' || op === '<' ? 'indent' : motionPattern;

/** Offsets in the joined text. */
function offsetOf(lines: readonly string[], line: number, col: number): number {
  let o = 0;
  for (let i = 0; i < line; i++) o += lines[i].length + 1;
  return o + col;
}

export function searchIdioms(scratch: Vim, start: Vim, target: string, opts: IdiomOpts): Idiom[] {
  const t0 = start.buf.text();
  if (t0 === target) return [];
  const lines0 = start.buf.lines.slice();
  const cur = { ...start.cursor };
  const c = offsetOf(lines0, cur.line, cur.col);
  // The net change, placed as far left (L) and as far right (R) as it can go. Any single edit
  // producing it deletes a span [a, b) with a ≤ R.start and b ≥ L.end.
  let pre = 0;
  while (pre < t0.length && pre < target.length && t0[pre] === target[pre]) pre++;
  let suf2 = 0;
  while (suf2 < t0.length && suf2 < target.length && t0[t0.length - 1 - suf2] === target[target.length - 1 - suf2]) suf2++;
  const lEnd = t0.length - suf2;
  const grow = target.length - t0.length;
  const covers = (a: number, b: number) => a <= pre + 1 && b >= lEnd - 1;
  const allow = (uses: string[]) => uses.every(u => opts.taught.has(u));

  const reset = () => {
    if (scratch.mode !== 'normal' || scratch.pending.length) { scratch.feed('<Esc>'); scratch.feed('<Esc>'); }
    scratch.visual = null;
    scratch.buf.lines = lines0.slice();
    scratch.win.cursor = { ...cur };
    scratch.win.want = start.win.want;
    scratch.win.top = start.win.top;
  };
  const feed = (keys: Key[]): boolean => {
    const before = scratch.lastCommand;
    for (const k of keys) scratch.feed(k);
    return !(scratch.lastCommand && scratch.lastCommand !== before && scratch.lastCommand.error);
  };
  /** The span a motion or object covers from the cursor, or null when it fails. */
  const span = (keys: Key[], visual: boolean, linewise: boolean): [number, number] | null => {
    reset();
    if (visual) {
      if (!feed(['v', ...keys]) || scratch.mode !== 'visual' || !scratch.visual) return null;
      const a = scratch.visual.anchor, b = scratch.cursor;
      const oa = offsetOf(scratch.buf.lines, a.line, a.col), ob = offsetOf(scratch.buf.lines, b.line, b.col);
      scratch.feed('<Esc>');
      return [Math.min(oa, ob), Math.max(oa, ob) + 1];
    }
    if (!feed(keys) || scratch.mode !== 'normal') return null;
    const p = scratch.cursor;
    if (p.line === cur.line && p.col === cur.col) return null;
    if (linewise) {
      const l0 = Math.min(p.line, cur.line), l1 = Math.max(p.line, cur.line);
      return [offsetOf(lines0, l0, 0), offsetOf(lines0, l1, lines0[l1].length) + 1];
    }
    const o = offsetOf(lines0, p.line, p.col);
    return [Math.min(o, c), Math.max(o, c) + 1];
  };

  const cands: Cand[] = [];
  const add = (cmd: Key[], insert: boolean, uses: string[], pattern: string, penalty = 0, commands = 1, longCount = false, charwise = false) => {
    if (!allow(uses)) return;
    // The shortest this can be: the command, plus (for an insert) the net growth and <Esc>.
    const min = cmd.length + (insert ? Math.max(0, grow) + 1 : 0);
    if (min > opts.maxKeys) return;
    cands.push({ cmd, insert, uses, pattern, penalty, commands, longCount, ...(charwise && { charwise }) });
  };
  const counted = (n: number) => (n > 1 ? String(n).split('') : []);
  const countUse = (n: number) => (n > 1 ? ['COUNT'] : []);

  // operator + motion
  const line = lines0[cur.line];
  const motions: { keys: Key[]; uses: string[]; pattern: string; penalty: number; linewise: boolean; count: number }[] = [];
  for (const m of WORDS) for (let n = 1; n <= 3; n++) motions.push({ keys: [...counted(n), ...m.split('')], uses: [m, ...countUse(n)], pattern: 'op-word', penalty: P.word + (n > 1 ? P.count : 0), linewise: false, count: n });
  for (const m of ['0', '^', '$']) motions.push({ keys: [m], uses: [m], pattern: 'to-line-end', penalty: P.line, linewise: false, count: 1 });
  const chars = new Set([...line].filter(ch => ch !== ' '));
  // dt) "up to the )" reads better than df} "through the }" for the same span: t before f.
  for (const ch of chars) for (const f of ['t', 'f', 'T', 'F']) motions.push({ keys: [f, ch], uses: [f], pattern: 'op-to-char', penalty: P.find + (/[fF]/.test(f) ? 0.1 : 0), linewise: false, count: 1 });
  for (const m of ['j', 'k']) for (let n = 1; n <= 3; n++) motions.push({ keys: [...counted(n), m], uses: [m, ...countUse(n)], pattern: 'delete-line', penalty: P.linewise + (n > 1 ? P.count : 0), linewise: true, count: n });
  for (const m of ['}', '{']) motions.push({ keys: [m], uses: [m], pattern: 'block-object', penalty: P.line, linewise: false, count: 1 });
  // A word, find or line-position motion that Neovim turns linewise (:help d, :help
  // exclusive-linewise: d3w over three one-word lines is 3dd) makes the right edit for the wrong
  // reason; the line command is what to teach, so such a candidate is dropped on replay.
  const charMotion = (pattern: string) => pattern === 'op-word' || pattern === 'op-to-char' || pattern === 'to-line-end';
  for (const m of motions) {
    const ops = OPS.filter(o => allow([o.op, ...m.uses]) && m.keys.length + o.op.length <= opts.maxKeys);
    if (!ops.length) continue;
    const sp = span(m.keys, false, m.linewise);
    if (!sp || !covers(sp[0], sp[1])) continue;
    for (const o of ops) {
      const pat = o.op === 'c' && m.pattern === 'op-word' ? 'change-word' : m.count > 1 ? 'count-op' : m.keys[m.keys.length - 1] === '$' ? 'to-line-end' : m.pattern;
      add([...o.op.split(''), ...m.keys], o.insert, [o.op, ...m.uses], opPattern(o.op, pat), m.penalty, 1, false, charMotion(m.pattern));
    }
  }
  // operator + text object
  for (const obj of OBJECTS) {
    if (!opts.taught.has(obj)) continue;
    const ops = OPS.filter(o => allow([o.op]) && o.op.length + 2 <= opts.maxKeys);
    if (!ops.length) continue;
    const sp = span(obj.split(''), true, false);
    if (!sp || !covers(sp[0] - 1, sp[1] + 1)) continue;
    // Only quotes seek forward along the line in Neovim; a word, bracket or tag object must be
    // under the cursor (the engine may be more forgiving than the real thing).
    if (!/["'`]$/.test(obj) && !(sp[0] - (obj[0] === 'a' ? 1 : 0) <= c + 1 && c < sp[1] + 1)) continue;
    for (const o of ops) add([...o.op.split(''), ...obj.split('')], o.insert, [o.op, obj], opPattern(o.op, objectPattern(obj)), P.object);
  }
  // doubled operators and line commands
  const nLines = lines0.length;
  for (let n = 1; n <= Math.min(9, nLines - cur.line); n++) {
    const a = offsetOf(lines0, cur.line, 0), b = offsetOf(lines0, cur.line + n - 1, lines0[cur.line + n - 1].length) + 1;
    if (!covers(a, b)) continue;
    const cp = n > 1 ? P.count : 0;
    add([...counted(n), 'd', 'd'], false, ['dd', ...countUse(n)], n > 1 ? 'count-op' : 'delete-line', cp);
    if (n <= 3) {
      add([...counted(n), '>', '>'], false, ['>>', ...countUse(n)], 'indent', cp);
      add([...counted(n), '<', '<'], false, ['<<', ...countUse(n)], 'indent', cp);
    }
    if (n === 1) {
      add(['c', 'c'], true, ['cc'], 'change-line');
      add(['S'], true, ['S'], 'change-line');
    }
    if (n >= 2 && n <= 4) {
      add([...(n > 2 ? counted(n) : []), 'J'], false, ['J', ...countUse(n > 2 ? n : 1)], 'join', n > 2 ? P.count : 0);
      add([...(n > 2 ? counted(n) : []), 'g', 'J'], false, ['gJ', ...countUse(n > 2 ? n : 1)], 'join', n > 2 ? P.count : 0);
    }
  }
  // character commands at the cursor
  const lineEnd = offsetOf(lines0, cur.line, line.length);
  if (covers(c, lineEnd)) { add(['D'], false, ['D'], 'to-line-end'); add(['C'], true, ['C'], 'to-line-end'); }
  const delLen = Math.max(0, lEnd - pre);
  for (const n of new Set([1, Math.max(1, lEnd - c), delLen])) {
    if (n < 1 || n > 60 || c + n > lineEnd) continue;
    if (!covers(c, c + n)) continue;
    const long = n > 3 ? n : 0; // the x-run habit: a count this long means an operator was the idea
    add([...counted(n), 'x'], false, ['x', ...countUse(n)], n > 1 ? 'count-op' : 'delete-char', (n > 1 ? P.count : 0) + long, 1, !!long);
    add([...counted(n), '~'], false, ['~', ...countUse(n)], 'toggle-case', (n > 1 ? P.count : 0) + long, 1, !!long);
    add([...counted(n), 'c', 'l'], true, ['cl', ...countUse(n)], 'substitute', (n > 1 ? P.count : 0) + long, 1, !!long);
  }
  if (covers(c - delLen, c)) add([...counted(delLen), 'X'], false, ['X', ...countUse(delLen)], 'delete-char', (delLen > 1 ? P.count : 0) + (delLen > 3 ? delLen : 0), 1, delLen > 3);
  if (target.length === t0.length && covers(c, c + 1) && target[c] !== undefined && target[c] !== '\n') add(['r', target[c]], false, ['r'], 'replace-char');
  // inserts
  add(['i'], true, ['i'], 'line-end-insert', 1); // a plain insert is never the lesson; only here so A/I/o/O outrank it
  add(['a'], true, ['a'], 'line-end-insert', 1);
  add(['A'], true, ['A'], 'line-end-insert');
  add(['I'], true, ['I'], 'line-end-insert');
  add(['o'], true, ['o'], 'open-line');
  add(['O'], true, ['O'], 'open-line');
  // swaps: the delete fills the register the put reads
  add(['d', 'd', 'p'], false, ['dd', 'p'], 'swap', 0, 2);
  add(['x', 'p'], false, ['x', 'p'], 'swap', 0, 2);

  const out: Idiom[] = [];
  for (const k of cands) {
    reset();
    const reg = scratch.registers.get('"');
    if (!feed(k.cmd)) continue;
    if (k.charwise) {
      const now = scratch.registers.get('"');
      if (now !== reg && now.kind === 'line') continue;
    }
    let keys = k.cmd;
    let typed = '';
    if (k.insert) {
      if (scratch.mode !== 'insert') continue;
      const b = scratch.buf.text();
      const o = offsetOf(scratch.buf.lines, scratch.cursor.line, scratch.cursor.col);
      const d = target.length - b.length;
      if (d < 0 || b.slice(0, o) !== target.slice(0, o) || b.slice(o) !== target.slice(o + d)) continue;
      typed = target.slice(o, o + d);
      const text = [...typed].map(ch => (ch === '\n' ? '<CR>' : ch));
      keys = [...k.cmd, ...text, '<Esc>'];
      if (keys.length > opts.maxKeys) continue;
      if (!feed([...text, '<Esc>'])) continue;
    }
    if (scratch.mode !== 'normal' || scratch.pending.length || scratch.buf.text() !== target) continue;
    out.push({ keys, uses: k.uses, pattern: k.pattern, style: keys.length + k.penalty, commands: k.commands ?? 1, typed, ...(k.longCount && { longCount: true }) });
  }
  reset();
  // Stable: equal style keeps generation order (dw before de, t before f).
  return out.map((x, i) => ({ x, i })).sort((a, b) => a.x.style - b.x.style || a.x.keys.length - b.x.keys.length || a.i - b.i).map(({ x }) => x);
}
