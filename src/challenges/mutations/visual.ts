// Line-shape mutations for Challenge 3 (text objects & visual) and Challenge 4 (registers):
// lines out of order (`ddp`, `djp`), a paragraph a level off (`>ip` / `<ip`), and a run of
// commented-out lines (a block-visual delete, `<C-v>2l3jd`).
import { indentOf, langOf } from './lines';
import type { MutationKind, Site } from './types';

const MAX_LINE = 72;
const filled = (l: string | undefined): l is string => l !== undefined && l.trim() !== '';
/** A line worth moving: has a word in it (not a lone bracket or `end`). */
const statement = (l: string | undefined): l is string => filled(l) && /[A-Za-z0-9_]/.test(l) && !/^\s*(end|else)\b\s*$/.test(l);
const clip = (s: string, n = 22) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const q = (l: string) => `"${clip(l.trim())}"`;

/** Two neighbouring statements swapped → `ddp` on the first. */
export const swappedLines: MutationKind = {
  id: 'swapped-lines',
  weight: 2,
  sites: lines => lines.flatMap((l, line) => {
    const b = lines[line + 1];
    return statement(l) && statement(b) && l !== b && indentOf(l) === indentOf(b) ? [{ line, col: 0, len: 2 }] : [];
  }),
  apply(lines, site) {
    const a = lines[site.line], b = lines[site.line + 1];
    return {
      kind: 'swapped-lines', site, span: 2, lines: [b, a],
      fixAt: { dline: 0, col: indentOf(b).length }, fixKeys: 'ddp', parMs: 1000, multi: true,
      checklist: `swap ${q(b)} and ${q(a)}`,
    };
  },
};

/**
 * A statement moved below the 2–3 lines after it → delete those lines and put them back above it
 * (`djp` / `d2jp` from the first; `Vjd` + `p` does the same with a visual selection).
 */
export const movedBlock: MutationKind = {
  id: 'moved-block',
  weight: 2,
  sites(lines) {
    const out: Site[] = [];
    lines.forEach((a, line) => {
      for (const k of [2, 3]) {
        const block = lines.slice(line + 1, line + 1 + k);
        if (!statement(a) || block.length < k || !block.every(statement)) continue;
        if (block.some(b => indentOf(b) !== indentOf(a) || b === a)) continue;
        out.push({ line, col: 0, len: k });
      }
    });
    return out;
  },
  apply(lines, site) {
    const k = site.len;
    const a = lines[site.line], block = lines.slice(site.line + 1, site.line + 1 + k);
    return {
      kind: 'moved-block', site, span: k + 1, lines: [...block, a],
      fixAt: { dline: 0, col: indentOf(block[0]).length }, fixKeys: k === 2 ? 'djp' : 'd2jp', parMs: 1200, multi: true,
      checklist: `move ${q(a)} back above ${q(block[0])}`,
    };
  },
};

/** Maximal runs of non-blank lines (paragraphs), 3–6 lines long. */
function paragraphs(lines: readonly string[]): { first: number; n: number }[] {
  const out: { first: number; n: number }[] = [];
  for (let i = 0; i < lines.length;) {
    if (!filled(lines[i])) { i++; continue; }
    let j = i;
    while (filled(lines[j + 1])) j++;
    const n = j - i + 1;
    if (n >= 3 && n <= 6) out.push({ first: i, n });
    i = j + 1;
  }
  return out;
}

/**
 * A whole paragraph a level too shallow (`>ip`) or too deep (`<ip`). The item also owns the blank
 * line after it: with every line of the paragraph changed, the line diff could otherwise pair that
 * blank line with another one and report damage outside the item.
 */
export const blockIndent: MutationKind = {
  id: 'block-indent',
  weight: 2,
  sites: lines => paragraphs(lines).map(p => ({ line: p.first, col: 0, len: p.n })),
  apply(lines, site, rng) {
    const para = lines.slice(site.line, site.line + site.len);
    const canOut = para.every(l => indentOf(l).length >= 2);
    const shallow = canOut && rng() < 0.5;
    const body = para.map(l => (shallow ? l.slice(2) : '  ' + l));
    if (body.some(l => l.length > MAX_LINE)) return null;
    const after = lines[site.line + site.len] === '' ? [''] : [];
    return {
      kind: 'block-indent', site, span: site.len + after.length, lines: [...body, ...after],
      fixAt: { dline: 0, col: indentOf(body[0]).length }, fixKeys: shallow ? '>ip' : '<ip', parMs: 1000,
      checklist: `${shallow ? 'indent' : 'outdent'} the ${site.len} lines from ${q(para[0])}`,
    };
  },
};

const COMMENT: Record<string, string> = { ts: '// ', go: '// ', lua: '-- ' };

/**
 * 4–5 lines commented out at their shallowest indent (as `gc` does) → a block-visual delete of
 * the three comment columns, `<C-v>2l3jd` (fewer keys than `3x` and `j.` on every line).
 */
export const commentedBlock: MutationKind = {
  id: 'commented-block',
  weight: 2,
  sites(lines) {
    const out: Site[] = [];
    lines.forEach((_l, line) => {
      for (const n of [4, 5]) {
        const run = lines.slice(line, line + n);
        if (run.length < n || !run.every(filled)) continue;
        if (run.some(r => /^\s*(\/\/|--)/.test(r) || r.length + 3 > MAX_LINE)) continue;
        out.push({ line, col: 0, len: n });
      }
    });
    return out;
  },
  apply(lines, site) {
    const c = COMMENT[langOf(lines)];
    const run = lines.slice(site.line, site.line + site.len);
    const ind = Math.min(...run.map(l => indentOf(l).length));
    const body = run.map(l => l.slice(0, ind) + c + l.slice(ind));
    return {
      kind: 'commented-block', site, span: site.len, lines: body,
      // Across first (sets the column `j` keeps), then down.
      fixAt: { dline: 0, col: ind }, fixKeys: `<C-v>2l${site.len - 1}jd`, parMs: 1600, multi: true,
      checklist: `uncomment the ${site.len} lines from ${q(run[0])}`,
    };
  },
};

export const VISUAL_KINDS: MutationKind[] = [swappedLines, movedBlock, blockIndent, commentedBlock];
