// Register and macro mutations for Challenge 4: transposed characters (`xp`), swapped words
// (`dwwP`), a missing near-copy of a line (`yyp` + `cw`), and a run of lines that each need
// the same two-part edit (record `qa…q` once, then `2@a`; plain `.` when the edit is one change).
import { type Rng, pick } from '../rng';
import { indentOf, langOf } from './lines';
import { type Mutation, type MutationKind, type Site, keyText, words } from './types';

const MAX_LINE = 72;
/** Longest text one fix may type. */
const MAX_TYPED = 6;
const filled = (l: string | undefined): l is string => l !== undefined && l.trim() !== '';
const clip = (s: string, n = 22) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Two neighbouring letters of a word transposed → `xp` on the first. */
export const swappedChars: MutationKind = {
  id: 'swapped-chars',
  sites(lines) {
    const out: Site[] = [];
    lines.forEach((l, line) => {
      for (const w of words(l)) {
        if (w.text.length < 4) continue;
        for (let k = 0; k + 1 < w.text.length; k++) {
          const a = w.text[k], b = w.text[k + 1];
          if (a !== b && /[a-z]/i.test(a) && /[a-z]/i.test(b)) out.push({ line, col: w.col + k, len: w.text.length });
        }
      }
    });
    return out;
  },
  apply(lines, site) {
    const l = lines[site.line];
    const w = words(l).find(x => x.col <= site.col && site.col < x.col + x.text.length)!;
    const mutated = l.slice(0, site.col) + l[site.col + 1] + l[site.col] + l.slice(site.col + 2);
    return {
      kind: 'swapped-chars', site, lines: [mutated],
      fixAt: { dline: 0, col: site.col }, fixKeys: 'xp', parMs: 900, multi: true,
      checklist: `"${mutated.slice(w.col, w.col + w.text.length)}" → "${w.text}"`,
    };
  },
};

/**
 * Two words swapped: "B A" where the line had "A B" → `dwwP` from B. Sites need exactly one space
 * after each word and something after the second, so `w` lands where "B " belongs.
 */
export const swappedWords: MutationKind = {
  id: 'swapped-words',
  weight: 2,
  sites(lines) {
    const out: Site[] = [];
    lines.forEach((l, line) => {
      const ws = words(l);
      for (let i = 0; i + 1 < ws.length; i++) {
        const a = ws[i], b = ws[i + 1];
        if (a.text.length < 2 || b.text.length < 2 || a.text === b.text) continue;
        if (/\w/.test(l[a.col - 1] ?? '')) continue;
        if (b.col !== a.col + a.text.length + 1 || l[a.col + a.text.length] !== ' ') continue;
        const after = b.col + b.text.length;
        if (l[after] !== ' ' || !/\S/.test(l[after + 1] ?? '')) continue;
        out.push({ line, col: a.col, len: after - a.col });
      }
    });
    return out;
  },
  apply(lines, site) {
    const l = lines[site.line];
    const [a, b] = l.slice(site.col, site.col + site.len).split(' ');
    const mutated = l.slice(0, site.col) + `${b} ${a}` + l.slice(site.col + site.len);
    return {
      kind: 'swapped-words', site, lines: [mutated],
      fixAt: { dline: 0, col: site.col }, fixKeys: 'dwwP', parMs: 1100, multi: true,
      checklist: `"${b} ${a}" → "${a} ${b}"`,
    };
  },
};

const TOKEN = /\w+|[^\w]/g;

/**
 * Adjacent lines equal but for 1–2 word tokens (the second typing at most 6 characters):
 * `line` is the second line, `diffs` the token positions that differ.
 */
function copyPairs(lines: readonly string[]): { line: number; diffs: { col: number; from: string; to: string }[] }[] {
  const out: { line: number; diffs: { col: number; from: string; to: string }[] }[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    const a = lines[i], b = lines[i + 1];
    if (!filled(a) || a.trim().length < 5 || indentOf(a) !== indentOf(b)) continue;
    const ta = [...a.matchAll(TOKEN)], tb = [...b.matchAll(TOKEN)];
    if (ta.length !== tb.length) continue;
    const diffs: { col: number; from: string; to: string }[] = [];
    let ok = true;
    for (let k = 0; k < ta.length && ok; k++) {
      if (ta[k][0] === tb[k][0]) continue;
      if (!/^\w+$/.test(ta[k][0]) || !/^\w+$/.test(tb[k][0])) ok = false;
      else diffs.push({ col: ta[k].index!, from: ta[k][0], to: tb[k][0] });
    }
    if (!ok || diffs.length < 1 || diffs.length > 2) continue;
    if (diffs.reduce((n, d) => n + d.to.length, 0) > MAX_TYPED) continue;
    out.push({ line: i + 1, diffs });
  }
  return out;
}

/** `{count}f{char}` from col `from` to col `to` of `l` (to > from), or '' when already there. */
function findTo(l: string, from: number, to: number): string {
  if (to === from) return '';
  const ch = l[to];
  let n = 0;
  for (let c = from + 1; c <= to; c++) if (l[c] === ch) n++;
  return `${n > 1 ? n : ''}f${keyText(ch)}`;
}

/** The second of two near-copies is missing → `yyp`, then `cw` each word that differs. */
export const duplicateAndChange: MutationKind = {
  id: 'duplicate-and-change',
  weight: 2,
  sites: lines => copyPairs(lines).map(p => ({ line: p.line, col: 0, len: lines[p.line].length })),
  apply(lines, site) {
    const pair = copyPairs(lines).find(p => p.line === site.line);
    if (!pair) return null;
    const a = lines[site.line - 1], b = lines[site.line];
    let cur = a, at = indentOf(a).length, keys = 'yyp', shift = 0;
    for (const d of pair.diffs) {
      const col = d.col + shift;
      keys += findTo(cur, at, col) + `cw${keyText(d.to)}<Esc>`;
      cur = cur.slice(0, col) + d.to + cur.slice(col + d.from.length);
      shift += d.to.length - d.from.length;
      at = col + d.to.length - 1;
    }
    return {
      kind: 'duplicate-and-change', site, lines: [],
      fixAt: { dline: -1, col: 0 }, fixKeys: keys, parMs: 1500 + 1000 * pair.diffs.length, multi: true,
      checklist: `add "${clip(b.trim(), 28)}" below "${clip(a.trim(), 20)}"`,
    };
  },
};

const TAILS: Record<string, string[]> = { ts: [' // old', ' // tmp'], go: [' // old', ' // tmp'], lua: [' -- old', ' -- tmp'] };
const PREFIX = 'old ';

/** Runs of 3–5 neighbouring statements at one indent. Site: first line, len = line count. */
function runs(lines: readonly string[]): Site[] {
  const out: Site[] = [];
  lines.forEach((_l, line) => {
    for (let n = 3; n <= 5; n++) {
      const run = lines.slice(line, line + n);
      if (run.length < n) break;
      if (!run.every(r => filled(r) && /^\s*[A-Za-z_]/.test(r) && !/\/\/|--/.test(r) && r.length + 11 <= MAX_LINE)) break;
      out.push({ line, col: 0, len: n });
    }
  });
  return out;
}

/** Count of `@a` runs as keys: `@a` alone for one, `N@a` otherwise. */
const at = (n: number) => (n === 1 ? '@a' : `${n}@a`);

/**
 * The same edit on 3–5 lines in a row: a stray "old " at the start and, usually, a stray trailing
 * comment. Two changes per line → record macro a on the first line and run it on the rest
 * (`qadw$2F D+q2@a`); one change → `dw` and `+.`. The par is the cheaper of the two routes.
 */
export const lineRunTransform: MutationKind = {
  id: 'line-run-transform',
  weight: 3,
  sites: runs,
  apply(lines, site, rng: Rng) {
    const n = site.len;
    const run = lines.slice(site.line, site.line + n);
    const tail = rng() < 0.75 ? pick(rng, TAILS[langOf(lines)]) : '';
    const body = run.map(l => indentOf(l) + PREFIX + l.trimStart() + tail);
    const one = tail ? `dw$2F D` : 'dw';
    const macroBody = `${one}+`;
    const macro = `qa${macroBody}q${at(n - 1)}`;
    // Without a macro: the first line's edit, then per line `+` and the edit again (`.` repeats a one-change edit).
    const plain = tail ? [one, ...Array(n - 1).fill(`+${one}`)].join('') : `dw${'+.'.repeat(n - 1)}`;
    const len = (k: string) => k.replace(/<[^>]+>/g, '#').length;
    const useMacro = len(macro) < len(plain);
    const m: Mutation = {
      kind: 'line-run-transform', site, span: n, lines: body,
      fixAt: { dline: 0, col: indentOf(run[0]).length }, fixKeys: useMacro ? macro : plain,
      parMs: useMacro ? 2500 + 400 * n : 900 * n, multi: true,
      checklist: tail
        ? `drop "${PREFIX.trim()}" and "${tail.trim()}" on the ${n} lines from "${clip(run[0].trim())}"`
        : `drop "${PREFIX.trim()}" on the ${n} lines from "${clip(run[0].trim())}"`,
    };
    if (useMacro) m.macro = { body: macroBody, runs: n };
    return m;
  },
};

export const REGISTER_KINDS: MutationKind[] = [swappedChars, swappedWords, duplicateAndChange, lineRunTransform];
