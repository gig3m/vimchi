// Line- and word-level mutations: fixed with dd, dw, cw, yyp. Challenge 2.
import { pick } from '../rng';
import { type MutationKind, type Site, keyText, words } from './types';

const indentOf = (l: string) => /^\s*/.exec(l)![0];
const JUNK: Record<string, string[]> = {
  ts: ["console.log('here');", '// TODO: remove', 'debugger;'],
  go: ['fmt.Println("here")', '// TODO: remove'],
  lua: ["print('here')", '-- TODO: remove'],
};
const langOf = (lines: readonly string[]) => (lines.some(l => /\bfunc\b|:=/.test(l)) ? 'go' : lines.some(l => /\blocal\b|\bend\b/.test(l)) ? 'lua' : 'ts');

/** Non-blank, indented lines: places a junk line can follow. */
const bodySites = (lines: readonly string[]): Site[] =>
  lines.map((l, line) => ({ l, line })).filter(({ l }) => l.trim() && indentOf(l).length > 0).map(({ l, line }) => ({ line, col: 0, len: l.length }));

/** A junk line inserted AFTER the site line → `dd` on it. */
export const strayLine: MutationKind = {
  id: 'stray-line',
  sites: bodySites,
  apply(lines, site, rng) {
    const l = lines[site.line];
    const junk = indentOf(l) + pick(rng, JUNK[langOf(lines)]);
    if (lines[site.line + 1] === junk) return null;
    return {
      kind: 'stray-line', site, lines: [l, junk],
      fixAt: { dline: 1, col: 0 }, fixKeys: 'dd', parMs: 900,
      checklist: `remove the stray "${junk.trim()}" line`,
    };
  },
};

const NOISE = ['temp', 'old', 'new', 'extra', 'copy'];

/** An extra word before an identifier → `dw`. */
export const strayWord: MutationKind = {
  id: 'stray-word',
  sites(lines) {
    const out: Site[] = [];
    lines.forEach((l, line) => { for (const w of words(l)) if (w.col > 0 && l[w.col - 1] === ' ' && w.text.length >= 3) out.push({ line, col: w.col, len: w.text.length }); });
    return out;
  },
  apply(lines, site, rng) {
    const l = lines[site.line];
    const noise = pick(rng, NOISE);
    const mutated = l.slice(0, site.col) + noise + ' ' + l.slice(site.col);
    if (mutated.length > 60) return null;
    return {
      kind: 'stray-word', site, lines: [mutated],
      fixAt: { dline: 0, col: site.col }, fixKeys: 'dw', parMs: 900,
      checklist: `remove the stray word "${noise}"`,
    };
  },
};

/** An identifier replaced by a different word → `cw<word><Esc>`. */
export const wrongWord: MutationKind = {
  id: 'wrong-word',
  sites(lines) {
    const out: Site[] = [];
    lines.forEach((l, line) => { for (const w of words(l)) if (w.text.length >= 3 && w.text.length <= 8) out.push({ line, col: w.col, len: w.text.length }); });
    return out;
  },
  apply(lines, site, rng) {
    const l = lines[site.line];
    const orig = l.slice(site.col, site.col + site.len);
    const other = pick(rng, NOISE.filter(n => n !== orig));
    const mutated = l.slice(0, site.col) + other + l.slice(site.col + site.len);
    if (mutated.length > 60) return null;
    return {
      kind: 'wrong-word', site, lines: [mutated],
      fixAt: { dline: 0, col: site.col }, fixKeys: `cw${keyText(orig)}<Esc>`, parMs: 1500,
      checklist: `"${other}" → "${orig}"`,
    };
  },
};

/** Adjacent equal-length lines differing in 1–3 columns; `line` is the second of the pair. */
export function nearDuplicatePairs(lines: readonly string[]): { line: number; cols: number[] }[] {
  const out: { line: number; cols: number[] }[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    const a = lines[i], b = lines[i + 1];
    if (a.length !== b.length || a.trim().length < 8) continue;
    const cols: number[] = [];
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) cols.push(k);
    if (cols.length >= 1 && cols.length <= 3) out.push({ line: i + 1, cols });
  }
  return out;
}

/** The second line of a near-duplicate pair is missing → `yyp` then `0{col}lr<c>` per differing column. */
export const missingDuplicateLine: MutationKind = {
  id: 'missing-duplicate-line',
  sites: lines => nearDuplicatePairs(lines).map(p => ({ line: p.line, col: 0, len: lines[p.line].length })),
  apply(lines, site) {
    const b = lines[site.line];
    const pair = nearDuplicatePairs(lines).find(p => p.line === site.line);
    if (!pair) return null;
    const fixes = pair.cols.map(c => `0${c > 0 ? `${c}l` : ''}r${keyText(b[c])}`).join('');
    return {
      kind: 'missing-duplicate-line', site, lines: [],
      fixAt: { dline: -1, col: 0 }, fixKeys: `yyp${fixes}`, parMs: 1500 + 600 * pair.cols.length,
      checklist: `add "${b.trim()}" below "${lines[site.line - 1].trim()}"`,
    };
  },
};

/**
 * An original line is marked for removal: the GOAL omits it → `dd`. The one kind that edits the
 * goal instead of the start; generate.ts handles that. Sites: standalone statements.
 */
export const lineToRemove: MutationKind = {
  id: 'line-to-remove',
  sites: lines => bodySites(lines).filter(s => /;\s*$|\)\s*$/.test(lines[s.line]) && !/return|\{$|\}$/.test(lines[s.line])),
  apply(lines, site) {
    const l = lines[site.line];
    return {
      kind: 'line-to-remove', site, lines: [l],
      fixAt: { dline: 0, col: 0 }, fixKeys: 'dd', parMs: 900,
      checklist: `delete the "${l.trim()}" line`,
    };
  },
};
