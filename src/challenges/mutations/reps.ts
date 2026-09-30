// Skill-keyed mutations for per-lesson Reps: each one is fixed by the named key of one lesson
// (ci", daa, ci(, dap, daf, >>, <ii, >if, d3w, 3dd, D, ciw, daw) and, where `.` is taught,
// repeats in 2–3 identical edits. Anything the learner TYPES to fix one is at most 6 characters.
import { type Rng, pick, randInt } from '../rng';
import { JUNK, NOISE, indentOf, langOf, strayLine, wrongWord } from './lines';
import { type Mutation, type MutationKind, type Site, keyText, words } from './types';

/** Longest text a fix may type. */
export const MAX_TYPED = 6;
const MINI_AI = ['mini-ai'];
const MAX_LINE = 72;

/** Keywords of the corpus languages: never offered as a wrong argument or string. */
const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'in', 'of', 'return', 'break', 'func', 'package', 'import', 'export',
  'const', 'let', 'var', 'type', 'new', 'local', 'end', 'then', 'elseif', 'and', 'or', 'not', 'nil', 'null',
  'true', 'false', 'range', 'go', 'defer', 'struct', 'class', 'public', 'private', 'static', 'async', 'await',
]);

/** Identifiers of the file (2–6 chars, no keywords), in first-seen order: wrong text drawn from the file itself. */
function pool(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const l of lines) for (const w of words(l)) if (w.text.length >= 2 && w.text.length <= 6 && !KEYWORDS.has(w.text)) seen.add(w.text);
  return [...seen];
}
/** A pool word that is none of `not` (and holds no char of `bad`), or null. */
function other(lines: readonly string[], rng: Rng, not: readonly string[], bad = ''): string | null {
  const p = pool(lines).filter(w => !not.includes(w) && ![...bad].some(c => w.includes(c)));
  return p.length ? pick(rng, p) : null;
}
const clip = (s: string, n = 28) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const splice = (l: string, col: number, len: number, text: string) => l.slice(0, col) + text + l.slice(col + len);

// ---- strings and calls ----------------------------------------------------------------------------

/** String literals of one line: [quote, open col, contents], paired left to right, skipping lines with escapes. */
function strings(l: string): { q: string; col: number; text: string }[] {
  if (l.includes('\\') || l.includes('`') || /^\s*(\/\/|--)/.test(l)) return [];
  const out: { q: string; col: number; text: string }[] = [];
  for (const q of ['"', "'"]) {
    const at = [...l].flatMap((c, i) => (c === q ? [i] : []));
    if (at.length % 2) continue;
    for (let k = 0; k < at.length; k += 2) {
      const text = l.slice(at[k] + 1, at[k + 1]);
      // A pair of one kind inside a string of the other ("it's") would confuse the pairing.
      if (text.includes('"') || text.includes("'")) return [];
      out.push({ q, col: at[k], text });
    }
  }
  return out;
}

/** String contents replaced by another word of the file → `ci"` / `ci'` + the original (≤ 6 chars). */
export const wrongStringContents: MutationKind = {
  id: 'wrong-string-contents',
  sites(lines) {
    const out: Site[] = [];
    lines.forEach((l, line) => { for (const s of strings(l)) if (s.text.length <= MAX_TYPED) out.push({ line, col: s.col, len: s.text.length }); });
    return out;
  },
  apply(lines, site, rng) {
    const l = lines[site.line];
    const q = l[site.col];
    const orig = l.slice(site.col + 1, site.col + 1 + site.len);
    const wrong = other(lines, rng, [orig]);
    if (!wrong) return null;
    const mutated = splice(l, site.col + 1, site.len, wrong);
    if (mutated.length > MAX_LINE) return null;
    return {
      kind: 'wrong-string-contents', site, lines: [mutated],
      fixAt: { dline: 0, col: site.col + 1 }, fixKeys: orig ? `ci${q}${keyText(orig)}<Esc>` : `di${q}`, parMs: 1000 + 150 * orig.length,
      checklist: `${q}${wrong}${q} → ${q}${orig}${q}`,
    };
  },
  repeat: (lines, a, b) => lines[a.line].slice(a.col, a.col + a.len + 2) === lines[b.line].slice(b.col, b.col + b.len + 2),
};

/** Calls on one line whose argument list holds no brackets or quotes: [open-paren col, contents]. */
function calls(l: string): { col: number; text: string }[] {
  return [...l.matchAll(/[\w$]\(([^()[\]{}"'`]*)\)/g)].map(m => ({ col: m.index! + 1, text: m[1] }));
}
/** A plain argument list: `a, b, c` (no stray spaces), as its arguments. */
function argList(text: string): string[] | null {
  if (!text) return [];
  const args = text.split(', ');
  return args.every(a => a.length > 0 && a.trim() === a && !a.includes(',')) ? args : null;
}

/** A call's arguments replaced by another word of the file → `ci(` + the original (≤ 6 chars). */
export const wrongArgs: MutationKind = {
  id: 'wrong-args',
  sites(lines) {
    const out: Site[] = [];
    lines.forEach((l, line) => { for (const c of calls(l)) if (c.text.length <= MAX_TYPED) out.push({ line, col: c.col, len: c.text.length }); });
    return out;
  },
  apply(lines, site, rng) {
    const l = lines[site.line];
    const orig = l.slice(site.col + 1, site.col + 1 + site.len);
    const wrong = other(lines, rng, [orig, ...(argList(orig) ?? [])]);
    if (!wrong) return null;
    const mutated = splice(l, site.col + 1, site.len, wrong);
    if (mutated.length > MAX_LINE) return null;
    return {
      kind: 'wrong-args', site, lines: [mutated],
      fixAt: { dline: 0, col: site.col + 1 }, fixKeys: orig ? `ci(${keyText(orig)}<Esc>` : 'di(', parMs: 1000 + 150 * orig.length,
      checklist: `(${wrong}) → (${orig})`,
    };
  },
  repeat: (lines, a, b) => lines[a.line].slice(a.col, a.col + a.len + 2) === lines[b.line].slice(b.col, b.col + b.len + 2),
};

/** An extra argument in a call → `daa` on it (mini.ai's argument object). */
export const strayArg: MutationKind = {
  id: 'stray-arg',
  plugins: MINI_AI,
  sites(lines) {
    const out: Site[] = [];
    lines.forEach((l, line) => { for (const c of calls(l)) if (argList(c.text)) out.push({ line, col: c.col, len: c.text.length }); });
    return out;
  },
  apply(lines, site, rng) {
    const l = lines[site.line];
    const args = argList(l.slice(site.col + 1, site.col + 1 + site.len))!;
    const k = randInt(rng, 0, args.length);
    const extra = other(lines, rng, args);
    if (!extra) return null;
    const next = [...args.slice(0, k), extra, ...args.slice(k)];
    const mutated = splice(l, site.col + 1, site.len, next.join(', '));
    if (mutated.length > MAX_LINE) return null;
    const at = site.col + 1 + args.slice(0, k).reduce((a, x) => a + x.length + 2, 0);
    return {
      kind: 'stray-arg', site, lines: [mutated],
      fixAt: { dline: 0, col: at }, fixKeys: 'daa', parMs: 900,
      checklist: `remove the extra argument "${extra}"`,
    };
  },
  repeat: () => true,
};

/** One argument replaced by another word of the file → `cia` + the original (≤ 6 chars). */
export const wrongArg: MutationKind = {
  id: 'wrong-arg',
  plugins: MINI_AI,
  sites(lines) {
    const out: Site[] = [];
    lines.forEach((l, line) => {
      for (const c of calls(l)) {
        const args = argList(c.text);
        if (!args?.length) continue;
        let col = c.col + 1;
        for (const a of args) { if (a.length <= MAX_TYPED) out.push({ line, col, len: a.length }); col += a.length + 2; }
      }
    });
    return out;
  },
  apply(lines, site, rng) {
    const l = lines[site.line];
    const orig = l.slice(site.col, site.col + site.len);
    const call = calls(l).find(c => c.col < site.col && site.col <= c.col + c.text.length)!;
    const wrong = other(lines, rng, argList(call.text)!);
    if (!wrong) return null;
    const mutated = splice(l, site.col, site.len, wrong);
    if (mutated.length > MAX_LINE) return null;
    return {
      kind: 'wrong-arg', site, lines: [mutated],
      fixAt: { dline: 0, col: site.col }, fixKeys: `cia${keyText(orig)}<Esc>`, parMs: 1000 + 150 * orig.length,
      checklist: `argument "${wrong}" → "${orig}"`,
    };
  },
  repeat: (lines, a, b) => lines[a.line].slice(a.col, a.col + a.len) === lines[b.line].slice(b.col, b.col + b.len),
};

// ---- blocks ------------------------------------------------------------------------------------------

const BLOCKS: Record<string, string[][]> = {
  ts: [['if (DEBUG) {', "  console.log('here');", '}'], ["console.log('start');", "console.log('end');"], ['// TODO: remove', 'debugger;']],
  go: [['if debug {', '  fmt.Println("here")', '}'], ['// TODO: remove', 'fmt.Println("here")']],
  lua: [['if DEBUG then', "  print('here')", 'end'], ['-- TODO: remove', "print('here')"]],
};
const blank = (l: string | undefined) => l !== undefined && l.trim() === '';
const filled = (l: string | undefined) => l !== undefined && l.trim() !== '';

/**
 * A leftover paragraph after a blank line → `dap` from inside it (takes the blank line after it too).
 * The item owns the line above and the blank line, so the new blank line never pairs with the old
 * one and makes the item look done (or the block look like damage outside it).
 */
export const extraBlock: MutationKind = {
  id: 'extra-block',
  sites: lines => lines.flatMap((l, line) => (filled(l) && blank(lines[line + 1]) && filled(lines[line + 2]) ? [{ line, col: 0, len: l.length }] : [])),
  apply(lines, site, rng) {
    const ind = indentOf(lines[site.line + 2]);
    const block = pick(rng, BLOCKS[langOf(lines)]).map(b => ind + b);
    return {
      kind: 'extra-block', site, span: 2, lines: [lines[site.line], '', ...block, ''],
      fixAt: { dline: 2, col: ind.length }, fixKeys: 'dap', parMs: 900,
      checklist: `delete the leftover "${block[0].trim()}" block`,
    };
  },
  repeat: () => true,
};

const FNS: Record<string, string[]> = { ts: ['debugDump', 'oldHelper', 'tmpCheck'], lua: ['debug_dump', 'old_helper', 'tmp_check'] };

/** A leftover top-level function right above a declaration → `daf` (mini.ai's function object). */
export const extraFunction: MutationKind = {
  id: 'extra-function',
  plugins: MINI_AI,
  sites(lines) {
    if (!FNS[langOf(lines)]) return [];
    // site = the line before a blank line that precedes a top-level line; the function goes right above it.
    return lines.flatMap((l, line) => (filled(l) && blank(lines[line + 1]) && filled(lines[line + 2]) && !indentOf(lines[line + 2]) ? [{ line, col: 0, len: l.length }] : []));
  },
  apply(lines, site, rng) {
    const lang = langOf(lines);
    const name = pick(rng, FNS[lang]);
    const fn = lang === 'lua' ? [`local function ${name}()`, "  print('here')", 'end'] : [`function ${name}() {`, "  console.log('here');", '}'];
    return {
      kind: 'extra-function', site, span: 2, lines: [lines[site.line], '', ...fn],
      fixAt: { dline: 2, col: 0 }, fixKeys: 'daf', parMs: 900,
      checklist: `delete the leftover ${name}() function`,
    };
  },
  repeat: () => true,
};

const SCOPES: Record<string, string[]> = {
  ts: ['if (DEBUG) {', "  console.log('here');", '}'],
  go: ['if debug {', '  fmt.Println("here")', '}'],
  lua: ['if DEBUG then', "  print('here')", 'end'],
};

/** A leftover `if` block between two sibling lines → `dai` from its body (header and closing line go too). */
export const strayScope: MutationKind = {
  id: 'stray-scope',
  plugins: MINI_AI,
  sites: lines => lines.flatMap((l, line) => (filled(l) && filled(lines[line + 1]) && indentOf(l) === indentOf(lines[line + 1]) && !/^\s*([}\])]|end\b)/.test(l) ? [{ line, col: 0, len: l.length }] : [])),
  apply(lines, site) {
    const ind = indentOf(lines[site.line]);
    const block = SCOPES[langOf(lines)].map(b => ind + b);
    return {
      kind: 'stray-scope', site, lines: [lines[site.line], ...block],
      fixAt: { dline: 2, col: indentOf(block[1]).length }, fixKeys: 'dai', parMs: 900,
      checklist: `delete the leftover "${block[0].trim()}" block`,
    };
  },
  repeat: () => true,
};

// ---- indentation -------------------------------------------------------------------------------------

/** One line a level off → `>>` or `<<`. */
export const indentOff: MutationKind = {
  id: 'indent-off',
  sites: lines => lines.flatMap((l, line) => (filled(l) ? [{ line, col: 0, len: l.length }] : [])),
  apply(lines, site, rng) {
    const l = lines[site.line];
    const out = indentOf(l).length >= 2 && rng() < 0.5;
    const mutated = out ? l.slice(2) : '  ' + l;
    if (mutated.length > MAX_LINE) return null;
    return {
      kind: 'indent-off', site, lines: [mutated],
      fixAt: { dline: 0, col: indentOf(mutated).length }, fixKeys: out ? '>>' : '<<', parMs: 800,
      checklist: `${out ? 'indent' : 'outdent'} "${clip(l.trim(), 24)}"`,
    };
  },
  repeat: () => true,
};

/**
 * Blocks: a header line, a body of deeper lines (blank lines allowed inside), and a closing line
 * (`}`, `end`, `)` or `]`) at the header's indent.
 */
function scopes(lines: readonly string[], min = 2, max = 8): { head: number; first: number; last: number }[] {
  const out: { head: number; first: number; last: number }[] = [];
  lines.forEach((h, head) => {
    if (!filled(h)) return;
    const hi = indentOf(h).length;
    let last = head;
    while (last + 1 < lines.length && (blank(lines[last + 1]) || indentOf(lines[last + 1]).length > hi)) last++;
    while (last > head && blank(lines[last])) last--;
    const close = lines[last + 1];
    if (close === undefined || indentOf(close).length !== hi || !/^\s*([}\])]|end\b)/.test(close)) return;
    const n = last - head;
    if (n >= min && n <= max) out.push({ head, first: head + 1, last });
  });
  return out;
}
const minIndentLine = (body: string[]) => {
  let best = 0;
  body.forEach((l, i) => { if (filled(l) && (!filled(body[best]) || indentOf(l).length < indentOf(body[best]).length)) best = i; });
  return best;
};

/** A block's whole body indented one level too deep → `<ii` from its shallowest line (mini.indentscope). */
export const scopeOverIndented: MutationKind = {
  id: 'scope-over-indented',
  plugins: MINI_AI,
  sites: lines => scopes(lines).map(s => ({ line: s.first, col: 0, len: s.last - s.first + 1 })),
  apply(lines, site) {
    const body = lines.slice(site.line, site.line + site.len).map(l => (filled(l) ? '  ' + l : l));
    if (body.some(l => l.length > MAX_LINE)) return null;
    const k = minIndentLine(body);
    return {
      kind: 'scope-over-indented', site, span: site.len, lines: body,
      fixAt: { dline: k, col: indentOf(body[k]).length }, fixKeys: '<ii', parMs: 1000,
      checklist: `outdent the body of "${clip(lines[site.line - 1].trim(), 24)}"`,
    };
  },
};

// Functions mini.ai's `if` finds: `function` (TS and Lua), arrows opening a block, and TS methods.
const FN_HEAD = /\bfunction\b.*(\{|\))\s*$|=>\s*\{\s*$|^\s*((public|private|protected|static|async|get|set)\s+)*[\w$]+\s*(<[^>]*>)?\s*\([^)]*\)\s*(:\s*[^{=]+)?\{\s*$/;
const NOT_FN = /^\s*(if|for|while|switch|catch|else|return|do|try|func)\b/;
const OPENS_FN = /\bfunction\b|=>/;

/** A function's body at the header's level → `>if` (mini.ai's function object). */
export const fnBodyDedented: MutationKind = {
  id: 'fn-body-dedented',
  plugins: MINI_AI,
  sites(lines) {
    if (langOf(lines) === 'go') return [];
    return scopes(lines, 1, 10)
      .filter(s => FN_HEAD.test(lines[s.head]) && !NOT_FN.test(lines[s.head]) && !OPENS_FN.test(lines[s.first]) && filled(lines[s.first]))
      .map(s => ({ line: s.first, col: 0, len: s.last - s.first + 1 }));
  },
  apply(lines, site) {
    const body = lines.slice(site.line, site.line + site.len).map(l => (filled(l) ? l.slice(2) : l));
    return {
      kind: 'fn-body-dedented', site, span: site.len, lines: body,
      fixAt: { dline: 0, col: indentOf(body[0]).length }, fixKeys: '>if', parMs: 1000,
      checklist: `indent the body of "${clip(lines[site.line - 1].trim(), 24)}"`,
    };
  },
};

// ---- words and lines -------------------------------------------------------------------------------

/** Word sites with a space before them: where a stray word can be slipped in. */
const spacedWords = (lines: readonly string[]): Site[] => {
  const out: Site[] = [];
  lines.forEach((l, line) => { for (const w of words(l)) if (w.col > 0 && l[w.col - 1] === ' ' && w.text.length >= 3) out.push({ line, col: w.col, len: w.text.length }); });
  return out;
};

/** 2–3 stray words before an identifier → `d2w` / `d3w`. */
export const strayWords: MutationKind = {
  id: 'stray-words',
  sites: spacedWords,
  apply(lines, site, rng) {
    const l = lines[site.line];
    const n = randInt(rng, 2, 3);
    const from = randInt(rng, 0, NOISE.length - n);
    const noise = NOISE.slice(from, from + n);
    const mutated = l.slice(0, site.col) + noise.join(' ') + ' ' + l.slice(site.col);
    if (mutated.length > MAX_LINE) return null;
    return {
      kind: 'stray-words', site, lines: [mutated],
      fixAt: { dline: 0, col: site.col }, fixKeys: `d${n}w`, parMs: 1000,
      checklist: `remove the stray words "${noise.join(' ')}"`,
    };
  },
  repeat: () => true,
};

/** 2–3 junk lines after a body line → `2dd` / `3dd` on the first. */
export const strayLines: MutationKind = {
  id: 'stray-lines',
  sites: lines => lines.flatMap((l, line) => (filled(l) && indentOf(l).length > 0 ? [{ line, col: 0, len: l.length }] : [])),
  apply(lines, site, rng) {
    const l = lines[site.line];
    const n = randInt(rng, 2, 3);
    const junk = Array.from({ length: n }, () => indentOf(l) + pick(rng, JUNK[langOf(lines)]));
    return {
      kind: 'stray-lines', site, lines: [l, ...junk],
      fixAt: { dline: 1, col: 0 }, fixKeys: `${n}dd`, parMs: 1000,
      checklist: `remove the ${n} stray lines`,
    };
  },
  repeat: () => true,
};

const TAILS: Record<string, string[]> = { ts: [' // old', ' // TODO', ' // FIXME'], go: [' // old', ' // TODO', ' // FIXME'], lua: [' -- old', ' -- TODO', ' -- FIXME'] };

/** A stray comment on the end of a line → `D` from its space. */
export const strayTail: MutationKind = {
  id: 'stray-tail',
  sites: lines => lines.flatMap((l, line) => (filled(l) && !/\/\/|--/.test(l) && l.length <= 56 ? [{ line, col: 0, len: l.length }] : [])),
  apply(lines, site, rng) {
    const l = lines[site.line];
    const tail = pick(rng, TAILS[langOf(lines)]);
    return {
      kind: 'stray-tail', site, lines: [l + tail],
      fixAt: { dline: 0, col: l.length }, fixKeys: 'D', parMs: 800,
      checklist: `remove the trailing "${tail.trim()}"`,
    };
  },
  repeat: () => true,
};

/** Word sites short enough to retype (3–6 chars). */
const shortWords = (lines: readonly string[]): Site[] => {
  const out: Site[] = [];
  // Whole words only: the x in 0xffff is not a word to Vim.
  lines.forEach((l, line) => { for (const w of words(l)) if (w.text.length >= 3 && w.text.length <= MAX_TYPED && !/\w/.test(l[w.col - 1] ?? '')) out.push({ line, col: w.col, len: w.text.length }); });
  return out;
};

/** A word replaced, fixed with `ciw` from inside it. */
export const wrongInnerWord: MutationKind = {
  id: 'wrong-inner-word',
  sites: shortWords,
  apply(lines, site, rng) {
    const m = wrongWord.apply(lines, site, rng);
    if (!m) return null;
    const orig = lines[site.line].slice(site.col, site.col + site.len);
    const wrongLen = m.lines[0].length - lines[site.line].length + site.len;
    return { ...m, kind: 'wrong-inner-word', fixAt: { dline: 0, col: site.col + randInt(rng, 1, wrongLen - 1) }, fixKeys: `ciw${keyText(orig)}<Esc>` };
  },
  repeat: (lines, a, b) => lines[a.line].slice(a.col, a.col + a.len) === lines[b.line].slice(b.col, b.col + b.len),
};

/** A stray word, removed with `daw` from inside it. */
export const strayWordAw: MutationKind = {
  id: 'stray-word-aw',
  sites: spacedWords,
  apply(lines, site, rng) {
    const l = lines[site.line];
    const noise = pick(rng, NOISE);
    const mutated = l.slice(0, site.col) + noise + ' ' + l.slice(site.col);
    if (mutated.length > MAX_LINE) return null;
    return {
      kind: 'stray-word-aw', site, lines: [mutated],
      fixAt: { dline: 0, col: site.col + randInt(rng, 1, noise.length - 1) }, fixKeys: 'daw', parMs: 900,
      checklist: `remove the stray word "${noise}"`,
    };
  },
  repeat: () => true,
};

// ---- runs: the same edit two or three times, for `.` -------------------------------------------------

/** Junk lines, always 2–3 of the same one close together: `dd` then `.`. Items are `stray-line`. */
export const strayLineRun: MutationKind = { ...strayLine, id: 'stray-line-run', repeatP: 1 };

/** The same wrong word 2–3 times close together: `cw` then `.` (or `*` and `cgn`). Items are `wrong-word`. */
export const wrongWordRun: MutationKind = {
  ...wrongWord,
  id: 'wrong-word-run',
  sites: shortWords,
  repeatP: 1,
};

export const REPS_KINDS: MutationKind[] = [
  wrongStringContents, wrongArgs, strayArg, wrongArg, extraBlock, extraFunction, strayScope, indentOff,
  scopeOverIndented, fnBodyDedented, strayWords, strayLines, strayTail, wrongInnerWord, strayWordAw,
  strayLineRun, wrongWordRun,
];

export type { Mutation };
