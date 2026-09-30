// A tiny git model shared by fugitive, gitsigns and diff: HEAD, the index and
// a commit log, with the worktree being vim.fs. Lessons seed it with
// `vim.pluginData.git = { head: {...files}, index?: {...}, log?: [...] }`.
// Also: a line diff (LCS), hunk helpers and the shared ]c / [c motion.

import { splitText } from '../buffer';
import type { Vim } from '../editor';
import { fail } from '../types';

export type Commit = {
  hash: string;
  author: string;
  date: string;
  message: string;
  /** Files this commit wrote (path → content, null = deleted). Used for blame and `git show`. */
  files?: Record<string, string | null>;
};

export type GitState = {
  branch: string;
  head: Record<string, string>;
  index: Record<string, string>;
  /** Oldest first. */
  log: Commit[];
};

/** The git state, filling in defaults lazily (index = HEAD, empty log). */
export function gitState(vim: Vim): GitState {
  const g = ((vim.pluginData.git as Partial<GitState> | undefined) ?? (vim.pluginData.git = {})) as Partial<GitState>;
  if (!g.head) {
    const tree: Record<string, string> = {};
    for (const c of g.log ?? []) for (const [p, t] of Object.entries(c.files ?? {})) if (t == null) delete tree[p]; else tree[p] = t;
    g.head = tree;
  }
  g.index ??= { ...g.head };
  g.log ??= [];
  g.branch ??= 'main';
  return g as GitState;
}

export const toLines = (text: string | null | undefined): string[] => (text == null || text === '' ? [] : splitText(text));
export const fromLines = (lines: string[]): string => (lines.length ? lines.join('\n') + '\n' : '');

/** Lines of a buffer as a file would hold them (an empty buffer is an empty file). */
export const bufLines = (lines: string[]) => (lines.length === 1 && lines[0] === '' ? [] : lines);

// ---- diff ----------------------------------------------------------------------------------------

/** A change from a[aStart, aStart+aCount) to b[bStart, bStart+bCount). Starts are 0-based. */
export type Hunk = { aStart: number; aCount: number; bStart: number; bCount: number; a: string[]; b: string[] };

/** Matching line pairs of a longest common subsequence. */
export function lcsPairs(a: string[], b: string[]): [number, number][] {
  // Trim the common prefix and suffix first: diffs are usually small.
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const A = a.slice(pre, a.length - suf), B = b.slice(pre, b.length - suf);
  const n = A.length, m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const out: [number, number][] = [];
  for (let k = 0; k < pre; k++) out.push([k, k]);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push([pre + i, pre + j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  for (let k = 0; k < suf; k++) out.push([a.length - suf + k, b.length - suf + k]);
  return out;
}

/** Hunks without context (like `git diff -U0`). */
export function diffLines(a: string[], b: string[]): Hunk[] {
  const pairs = lcsPairs(a, b);
  pairs.push([a.length, b.length]);
  const out: Hunk[] = [];
  let i = 0, j = 0;
  for (const [pi, pj] of pairs) {
    if (pi > i || pj > j) out.push({ aStart: i, aCount: pi - i, bStart: j, bCount: pj - j, a: a.slice(i, pi), b: b.slice(j, pj) });
    i = pi + 1;
    j = pj + 1;
  }
  return out;
}

/** Apply some of the hunks of diffLines(a, b) to a. */
export function applyHunks(a: string[], hunks: Hunk[]): string[] {
  const out = a.slice();
  for (const h of [...hunks].sort((x, y) => y.aStart - x.aStart)) out.splice(h.aStart, h.aCount, ...h.b);
  return out;
}

/** Hunks grouped with context lines, as `git diff` prints them. */
export type Group = { hunks: Hunk[]; header: string; lines: string[] };

export function unified(a: string[], b: string[], ctx = 3): Group[] {
  const hunks = diffLines(a, b);
  const groups: Hunk[][] = [];
  for (const h of hunks) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    if (prev && h.aStart - (prev.aStart + prev.aCount) <= ctx * 2) last.push(h);
    else groups.push([h]);
  }
  return groups.map(g => {
    const first = g[0], last = g[g.length - 1];
    const aFrom = Math.max(0, first.aStart - ctx), aTo = Math.min(a.length, last.aStart + last.aCount + ctx);
    const bFrom = first.bStart - (first.aStart - aFrom);
    const lines: string[] = [];
    let ai = aFrom;
    for (const h of g) {
      while (ai < h.aStart) lines.push(' ' + a[ai++]);
      lines.push(...h.a.map(l => '-' + l), ...h.b.map(l => '+' + l));
      ai = h.aStart + h.aCount;
    }
    while (ai < aTo) lines.push(' ' + a[ai++]);
    const aLen = aTo - aFrom, bLen = aLen + g.reduce((n, h) => n + h.bCount - h.aCount, 0);
    const range = (from: number, len: number) => `${len ? from + 1 : from}${len === 1 ? '' : ',' + len}`;
    return { hunks: g, header: `@@ -${range(aFrom, aLen)} +${range(bFrom, bLen)} @@`, lines };
  });
}

// ---- status & staging ------------------------------------------------------------------------------

export type Change = { path: string; code: 'M' | 'A' | 'D' | '?' };

export function status(vim: Vim): { untracked: Change[]; unstaged: Change[]; staged: Change[] } {
  const g = gitState(vim);
  const disk = vim.fs.list();
  const untracked = disk.filter(p => !(p in g.index)).map(path => ({ path, code: '?' as const }));
  const unstaged: Change[] = [];
  for (const p of Object.keys(g.index).sort()) {
    const w = vim.fs.read(p);
    if (w == null) unstaged.push({ path: p, code: 'D' });
    else if (w !== g.index[p]) unstaged.push({ path: p, code: 'M' });
  }
  const staged: Change[] = [];
  for (const p of [...new Set([...Object.keys(g.head), ...Object.keys(g.index)])].sort()) {
    if (!(p in g.index)) staged.push({ path: p, code: 'D' });
    else if (!(p in g.head)) staged.push({ path: p, code: 'A' });
    else if (g.head[p] !== g.index[p]) staged.push({ path: p, code: 'M' });
  }
  return { untracked, unstaged, staged };
}

/** git add <path> */
export function stageFile(vim: Vim, path: string) {
  const g = gitState(vim);
  const w = vim.fs.read(path);
  if (w == null) delete g.index[path];
  else g.index[path] = w;
}

/** git reset <path> */
export function unstageFile(vim: Vim, path: string) {
  const g = gitState(vim);
  if (path in g.head) g.index[path] = g.head[path];
  else delete g.index[path];
}

let hashSeed = 0;
export function makeHash(text: string): string {
  let h = 2166136261 ^ hashSeed;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0).toString(16) + '0000000').slice(0, 7);
}

export function commit(vim: Vim, message: string, opts: { amend?: boolean; author?: string; date?: string } = {}) {
  const g = gitState(vim);
  const files: Record<string, string | null> = {};
  for (const p of new Set([...Object.keys(g.head), ...Object.keys(g.index)])) {
    if (g.head[p] !== g.index[p]) files[p] = g.index[p] ?? null;
  }
  const last = g.log[g.log.length - 1];
  if (opts.amend) {
    if (!last) fail('fatal: You have nothing to amend.');
    g.log.pop();
    Object.assign(files, { ...(last.files ?? {}), ...files });
  }
  const c: Commit = {
    hash: makeHash(message + g.log.length + JSON.stringify(files)),
    author: opts.author ?? 'You',
    date: opts.date ?? '2026-09-27',
    message,
    files,
  };
  g.log.push(c);
  g.head = { ...g.index };
  return c;
}

// ---- blame ---------------------------------------------------------------------------------------

export const NOT_COMMITTED: Commit = { hash: '0000000', author: 'Not Committed Yet', date: '2026-09-27', message: '' };

/** Commit per line of `current` (the buffer), walking the log. */
export function blame(vim: Vim, path: string, current: string[]): Commit[] {
  const g = gitState(vim);
  let lines: string[] = [];
  let who: Commit[] = [];
  const root: Commit = { hash: makeHash('root:' + path), author: 'You', date: '2026-01-01', message: 'Initial commit' };
  const versions: [Commit, string[]][] = g.log.filter(c => c.files && path in c.files).map(c => [c, toLines(c.files![path])]);
  if (!versions.length && path in g.head) versions.push([root, toLines(g.head[path])]);
  for (const [c, next] of versions) {
    const kept = new Map(lcsPairs(lines, next).map(([i, j]) => [j, who[i]]));
    who = next.map((_, j) => kept.get(j) ?? c);
    lines = next;
  }
  const kept = new Map(lcsPairs(lines, current).map(([i, j]) => [j, who[i]]));
  return current.map((_, j) => kept.get(j) ?? NOT_COMMITTED);
}

// ---- ]c / [c, shared by diff and gitsigns ----------------------------------------------------------

type Nav = (dir: 1 | -1, count: number) => { line: number; col: number } | null | undefined;

/** Register a ]c/[c provider. Providers return undefined when they don't apply (so the next one runs). */
export function addHunkNav(vim: Vim, name: 'diff' | 'gitsigns', nav: Nav) {
  const reg = (vim.pluginData.hunkNav ??= {}) as Record<string, Nav>;
  const first = !Object.keys(reg).length;
  reg[name] = nav;
  if (!first) return;
  const run = (dir: 1 | -1) => (ctx: { count: number }) => {
    for (const key of ['diff', 'gitsigns']) {
      const r = reg[key]?.(dir, ctx.count);
      if (r === undefined) continue;
      if (r === null) return null;
      return { pos: r, jump: true };
    }
    return null;
  };
  // ]c / [c are gitsigns' README keys (and diff mode's); ]h / [h are LazyVim's for the same jumps.
  for (const k of [']c', ']h']) vim.defineMotion(k, { run: run(1) });
  for (const k of ['[c', '[h']) vim.defineMotion(k, { run: run(-1) });
}
