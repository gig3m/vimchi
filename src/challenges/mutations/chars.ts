// Character-level mutations: fixed with x, r, i/a and a little motion. Challenge 1.
import { type Rng, pick, randInt } from '../rng';
import { type MutationKind, type Site, keyText, words } from './types';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** A different character of the same class, or null if none was found. */
function nearby(c: string, rng: Rng): string | null {
  const pool = /[a-z]/.test(c) ? LETTERS : /[A-Z]/.test(c) ? LETTERS.toUpperCase() : /[0-9]/.test(c) ? '0123456789' : LETTERS;
  let out = c;
  for (let i = 0; i < 8 && out === c; i++) out = pool[randInt(rng, 0, pool.length - 1)];
  return out === c ? null : out;
}

/** Sites are identifier characters not at a word boundary (so the word stays a word). */
function innerWordSites(lines: readonly string[]): Site[] {
  const out: Site[] = [];
  lines.forEach((l, line) => {
    for (const w of words(l)) if (w.text.length >= 4) for (let k = 1; k < w.text.length - 1; k++) out.push({ line, col: w.col + k, len: 1 });
  });
  return out;
}

const wordAt = (l: string, col: number) => words(l).find(w => col > w.col && col < w.col + w.text.length)!;

/** Remove one character inside a word → `i<c><Esc>` at the gap. */
export const droppedChar: MutationKind = {
  id: 'dropped-char',
  sites: innerWordSites,
  apply(lines, site) {
    const l = lines[site.line];
    const c = l[site.col];
    const mutated = l.slice(0, site.col) + l.slice(site.col + 1);
    const w = wordAt(l, site.col);
    return {
      kind: 'dropped-char', site, lines: [mutated],
      fixAt: { dline: 0, col: site.col }, fixKeys: `i${keyText(c)}<Esc>`, parMs: 1200,
      checklist: `"${mutated.slice(w.col, w.col + w.text.length - 1)}" → "${w.text}"`,
    };
  },
};

/** Insert one wrong character inside a word → `x`. */
export const extraChar: MutationKind = {
  id: 'extra-char',
  sites: innerWordSites,
  apply(lines, site, rng) {
    const l = lines[site.line];
    const c = pick(rng, LETTERS.split(''));
    const mutated = l.slice(0, site.col) + c + l.slice(site.col);
    const w = wordAt(l, site.col);
    return {
      kind: 'extra-char', site, lines: [mutated],
      fixAt: { dline: 0, col: site.col }, fixKeys: 'x', parMs: 900,
      checklist: `"${mutated.slice(w.col, w.col + w.text.length + 1)}" → "${w.text}"`,
    };
  },
};

/** Replace one character inside a word → `r<c>`. */
export const wrongChar: MutationKind = {
  id: 'wrong-char',
  sites: innerWordSites,
  apply(lines, site, rng) {
    const l = lines[site.line];
    const c = l[site.col];
    const n = nearby(c, rng);
    if (n === null) return null;
    const mutated = l.slice(0, site.col) + n + l.slice(site.col + 1);
    const w = wordAt(l, site.col);
    return {
      kind: 'wrong-char', site, lines: [mutated],
      fixAt: { dline: 0, col: site.col }, fixKeys: `r${keyText(c)}`, parMs: 1000,
      checklist: `"${mutated.slice(w.col, w.col + w.text.length)}" → "${w.text}"`,
    };
  },
};

/** Change one digit of a numeric literal → `r<d>`. */
export const wrongLiteral: MutationKind = {
  id: 'wrong-literal',
  sites(lines) {
    const out: Site[] = [];
    lines.forEach((l, line) => { for (const m of l.matchAll(/\b\d+\b/g)) out.push({ line, col: m.index!, len: m[0].length }); });
    return out;
  },
  apply(lines, site, rng) {
    const l = lines[site.line];
    const k = randInt(rng, 0, site.len - 1);
    const c = l[site.col + k];
    const n = nearby(c, rng);
    if (n === null || (k === 0 && n === '0' && site.len > 1)) return null;
    const mutated = l.slice(0, site.col + k) + n + l.slice(site.col + k + 1);
    return {
      kind: 'wrong-literal', site, lines: [mutated],
      fixAt: { dline: 0, col: site.col + k }, fixKeys: `r${c}`, parMs: 1000,
      checklist: `${mutated.slice(site.col, site.col + site.len)} → ${l.slice(site.col, site.col + site.len)}`,
    };
  },
};

/** One use of a 3–6 char identifier gets one char replaced → `r<c>`. Single site; rename is Challenge 4. */
export const wrongShortIdent: MutationKind = {
  id: 'wrong-short-ident',
  sites(lines) {
    const out: Site[] = [];
    lines.forEach((l, line) => { for (const w of words(l)) if (w.text.length >= 3 && w.text.length <= 6) out.push({ line, col: w.col, len: w.text.length }); });
    return out;
  },
  apply(lines, site, rng) {
    const l = lines[site.line];
    const k = randInt(rng, 0, site.len - 1);
    const c = l[site.col + k];
    const n = nearby(c, rng);
    if (n === null) return null;
    const mutated = l.slice(0, site.col + k) + n + l.slice(site.col + k + 1);
    return {
      kind: 'wrong-short-ident', site, lines: [mutated],
      fixAt: { dline: 0, col: site.col + k }, fixKeys: `r${keyText(c)}`, parMs: 1100,
      checklist: `"${mutated.slice(site.col, site.col + site.len)}" → "${l.slice(site.col, site.col + site.len)}"`,
    };
  },
};
