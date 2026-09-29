# Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Challenges" band with two procedurally generated, seeded, combined-skill editing challenges (Fix the File; Operators), each a larger file with many edits at once plus a live checklist, scored like a lesson.

**Architecture:** A pure generator (`src/challenges/`) turns a challenge definition + 32-bit seed into `{ start, goal, items, parKeys, parMs }` by applying non-overlapping *mutations* (small pure modules, each with a checklist line and a static reference fix) to a hand-written corpus file. The existing `Session` runtime gains a `generated` challenge kind that runs the result as one text-goal round, exposes per-item ticks computed with the existing LCS `align()`, and scores with `finalize()`. UI adds a sidebar band, a `Checklist` panel and a seed link on the results screen.

**Tech Stack:** TypeScript, React 19, Vite 8, vitest 5 (existing). No new dependencies. Tests run with `npm test`; typecheck with `npx tsc -b`.

**Spec:** `docs/superpowers/specs/2026-09-29-challenges-design.md`

## Global Constraints

- Lesson ids match `^[a-z0-9-]{1,64}$` (server `lessonRE`); ids are `challenge-fix-the-file` and `challenge-operators`.
- Corpus lines are ≤ 60 columns (`MAX_COLS` in `lessons.test.ts`), files are 25–40 lines.
- Same challenge + same seed → deep-equal `Generated`. PRNG is mulberry32; never call `Math.random` inside `src/challenges/`.
- Mutations chosen for one run never touch the same line and keep one untouched line between them (so checklist windows are independent).
- Every mutation's `fixKeys`, fed from `fixAt` in the mutated file, restores the original exactly (verified with the real engine in tests).
- Challenge lessons set `boss: true`; nothing in the completion count changes. Runs save under the lesson id; the Go server is untouched.
- The inline goal overlay stays on for challenges (hybrid play).
- Score formula unchanged: `finalize()` in `src/lessons/runtime.ts`.

## Review Focus

1. **A learner deletes a whole block by accident and undoes it.** `correct` must still drop (collateral is tracked as a running max), and ticks must not flicker to "done" for items whose lines were temporarily gone. Test pinned in Task 6 (`collateral is remembered after undo`).
2. **Two candidate sites for different kinds land on adjacent lines.** The generator must reject the second (one-line gap rule), or checklist windows overlap and a tick depends on another item. Test pinned in Task 5 (`items keep a one-line gap`).
3. **A seed in the URL is garbage** (`?seed=abc`, negative, > 2^32). The app must fall back to a fresh random seed, never NaN into the generator. Test pinned in Task 8 (`seedFromHash`).
4. **A corpus file has too few candidate sites for the requested edit count.** Generation must return fewer items rather than loop forever or throw at play time; the test asserts the range is met for *every* file so the corpus is fixed before ship. Pinned in Task 5 (`every corpus file supports the edit range`).
5. **A mutation produces text identical to the original** (e.g. wrong-char picks the same char). Rule 4: retry then drop; never emit a no-op item. Pinned in Task 3 (`never a no-op`).

---

## File structure

- `src/challenges/rng.ts` — `mulberry32`, `randInt`, `pick`, `shuffle`. Pure.
- `src/challenges/corpus/index.ts` — `CORPUS: CorpusFile[]` (10 files, TS/Go/Lua).
- `src/challenges/mutations/types.ts` — `Site`, `Mutation`, `MutationKind`, helpers.
- `src/challenges/mutations/chars.ts` — Challenge 1 kinds: `dropped-char`, `extra-char`, `wrong-char`, `wrong-literal`, `wrong-short-ident`.
- `src/challenges/mutations/lines.ts` — Challenge 2 kinds: `stray-line`, `stray-word`, `wrong-word`, `missing-duplicate-line`, `line-to-remove`.
- `src/challenges/mutations/index.ts` — `KINDS: Record<string, MutationKind>`.
- `src/challenges/generate.ts` — `generate(c, seed)`, `ChecklistItem`, `itemDone`, `collateral`.
- `src/challenges/__tests__/{rng,corpus,mutations,generate}.test.ts`.
- `src/lessons/types.ts` — `GeneratedChallenge`, `CorpusFile`, band `'challenges'`.
- `src/lessons/runtime.ts` — `generated` kind in `Session`; `SessionView.items`, `SessionView.seed`.
- `src/lessons/sections/challenges.tsx` — the two lessons.
- `src/lessons/index.ts` — register the section.
- `src/lessons/__tests__/lessons.test.ts` — relax key-card rule for `generated`; add playthrough.
- `src/components/Checklist.tsx` — the panel.
- `src/components/{Sidebar,Practice,LessonPage,Results}.tsx`, `src/App.tsx`, `src/styles.css` — wiring.
- `CURRICULUM.md`, `docs/LESSONS.md` — docs.

---

### Task 1: Types and seeded RNG

**Files:**
- Modify: `src/lessons/types.ts` (after `RoundsChallenge`, and the `Challenge` union + `Section.band`)
- Create: `src/challenges/rng.ts`
- Test: `src/challenges/__tests__/rng.test.ts`

**Interfaces:**
- Produces: `GeneratedChallenge`, `CorpusFile` types; `Rng = () => number`; `mulberry32(seed: number): Rng`; `randInt(rng, lo, hi)` inclusive; `pick<T>(rng, arr): T`; `shuffle<T>(rng, arr): T[]` (new array).

- [ ] **Step 1: Write the failing RNG test**

```ts
// src/challenges/__tests__/rng.test.ts
import { describe, expect, it } from 'vitest';
import { mulberry32, pick, randInt, shuffle } from '../rng';

describe('mulberry32', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it('stays in [0,1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('randInt is inclusive on both ends', () => {
    const r = mulberry32(3); const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randInt(r, 2, 4));
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });
  it('shuffle is a permutation and does not mutate', () => {
    const src = [1, 2, 3, 4, 5]; const out = shuffle(mulberry32(9), src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual(src);
  });
  it('pick returns an element', () => {
    expect(['a', 'b']).toContain(pick(mulberry32(1), ['a', 'b']));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/challenges/__tests__/rng.test.ts`
Expected: FAIL, cannot resolve `../rng`.

- [ ] **Step 3: Implement rng.ts**

```ts
// src/challenges/rng.ts
// Seeded PRNG so a challenge run is reproducible from its 32-bit seed.
export type Rng = () => number;

/** mulberry32: small, fast, good enough for content generation. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [lo, hi], inclusive. */
export const randInt = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

/** Fisher–Yates into a new array. */
export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

- [ ] **Step 4: Add the types**

In `src/lessons/types.ts`, change `Section.band` to `band: 'core' | 'deep' | 'plugins' | 'challenges'`, add `GeneratedChallenge` to the `Challenge` union, and add after `RoundsChallenge`:

```ts
/** One clean base file for generated challenges. */
export type CorpusFile = { name: string; lines: string[] };

/**
 * A procedurally generated, seeded edit session: one corpus file with several
 * mutations applied; the goal is the original. See src/challenges/.
 */
export type GeneratedChallenge = {
  kind: 'generated';
  /** Skill tags shown in the intro; documentation only. */
  skills: string[];
  /** Mutation kind ids this challenge may draw from (keys of KINDS). */
  mutations: string[];
  corpus: CorpusFile[];
  /** Inclusive range of mutations per run. */
  edits: [number, number];
};
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/challenges/__tests__/rng.test.ts && npx tsc -b`
Expected: 6 tests pass; tsc reports errors only where `Challenge` is switched on exhaustively — check `npx tsc -b` output. If `runtime.ts` `total` getter or `start()` complain about the new kind, leave them for Task 6 unless the build is broken, in which case add `if (c.kind === 'generated') return 0;` as a placeholder in `get total()` only.

- [ ] **Step 6: Commit**

```bash
git add src/challenges/rng.ts src/challenges/__tests__/rng.test.ts src/lessons/types.ts
git commit -m "challenges: seeded rng and GeneratedChallenge types"
```

---

### Task 2: Corpus

**Files:**
- Create: `src/challenges/corpus/index.ts`
- Test: `src/challenges/__tests__/corpus.test.ts`

**Interfaces:**
- Produces: `CORPUS: CorpusFile[]` (10 files) and `CORPUS_BY_NAME: Record<string, CorpusFile>`.

Corpus rules (tested): 25–40 lines, every line ≤ 60 cols, no tabs, no trailing spaces, at least 6 identifiers of 3–6 chars that occur ≥ 2 times, at least 4 numeric literals, at least 2 string literals, and at least one *near-duplicate pair*: two adjacent lines of equal length differing in 1–3 character positions (for `missing-duplicate-line`).

- [ ] **Step 1: Write the failing corpus test**

```ts
// src/challenges/__tests__/corpus.test.ts
import { describe, expect, it } from 'vitest';
import { CORPUS } from '../corpus';

const idents = (lines: string[]) => {
  const n = new Map<string, number>();
  for (const l of lines) for (const m of l.matchAll(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g)) n.set(m[0], (n.get(m[0]) ?? 0) + 1);
  return n;
};
export const nearDuplicatePairs = (lines: string[]) => {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    const a = lines[i], b = lines[i + 1];
    if (a.length !== b.length || a.trim().length < 8) continue;
    let diff = 0;
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) diff++;
    if (diff >= 1 && diff <= 3) out.push([i, i + 1]);
  }
  return out;
};

describe('corpus', () => {
  it('has 10 uniquely named files', () => {
    expect(CORPUS.length).toBe(10);
    expect(new Set(CORPUS.map(f => f.name)).size).toBe(10);
  });
  describe.each(CORPUS.map(f => [f.name, f] as const))('%s', (_n, f) => {
    it('is 25–40 lines of ≤60 columns, no tabs or trailing spaces', () => {
      expect(f.lines.length).toBeGreaterThanOrEqual(25);
      expect(f.lines.length).toBeLessThanOrEqual(40);
      expect(f.lines.filter(l => l.length > 60)).toEqual([]);
      expect(f.lines.filter(l => /\t| $/.test(l))).toEqual([]);
    });
    it('is mutation-rich', () => {
      const n = idents(f.lines);
      const repeated = [...n].filter(([w, c]) => w.length >= 3 && w.length <= 6 && c >= 2);
      expect(repeated.length).toBeGreaterThanOrEqual(6);
      expect(f.lines.join('\n').match(/\b\d+\b/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
      expect(f.lines.join('\n').match(/'[^']{2,}'|"[^"]{2,}"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
      expect(nearDuplicatePairs(f.lines).length).toBeGreaterThanOrEqual(1);
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/challenges/__tests__/corpus.test.ts`
Expected: FAIL, cannot resolve `../corpus`.

- [ ] **Step 3: Write the corpus**

Create `src/challenges/corpus/index.ts` exporting `CORPUS` with ten files. Write each as real, readable code that satisfies the rules; two are given in full here, the other eight follow the same recipe (a small module with a config object, a helper, a loop, a couple of near-duplicate lines such as `x = clamp(x, 0, w);` / `y = clamp(y, 0, h);`). Names: `cart.ts`, `clamp.ts`, `router.go`, `retry.go`, `queue.lua`, `keymap.lua`, `stats.ts`, `parse.ts`, `pool.go`, `timer.lua`.

```ts
// src/challenges/corpus/index.ts
// Clean base files for generated challenges. Hand-written; must pass corpus.test.ts
// (25–40 lines, ≤60 cols, repeated short identifiers, literals, a near-duplicate pair).
import type { CorpusFile } from '../../lessons/types';

const cart: CorpusFile = {
  name: 'cart.ts',
  lines: [
    'export type Item = { sku: string; qty: number; price: number };',
    '',
    'const TAX = 0.0825;',
    'const FREE_SHIP = 50;',
    'const SHIP = 5.99;',
    '',
    'export function subtotal(items: Item[]): number {',
    '  let sum = 0;',
    '  for (const item of items) {',
    '    sum += item.qty * item.price;',
    '  }',
    '  return round(sum);',
    '}',
    '',
    'export function shipping(sum: number): number {',
    '  if (sum >= FREE_SHIP) return 0;',
    '  return SHIP;',
    '}',
    '',
    'export function total(items: Item[]): number {',
    '  const sum = subtotal(items);',
    '  const tax = round(sum * TAX);',
    '  const ship = shipping(sum);',
    '  return round(sum + tax + ship);',
    '}',
    '',
    'export function count(items: Item[]): number {',
    '  let qty = 0;',
    '  for (const item of items) qty += item.qty;',
    '  return qty;',
    '}',
    '',
    'function round(n: number): number {',
    '  return Math.round(n * 100) / 100;',
    '}',
    '',
    "export const EMPTY: Item = { sku: 'none', qty: 0, price: 0 };",
    "export const DEMO: Item = { sku: 'demo', qty: 1, price: 9 };",
  ],
};

const clamp: CorpusFile = {
  name: 'clamp.ts',
  lines: [
    'export type Box = { x: number; y: number; w: number; h: number };',
    '',
    'const MIN = 0;',
    'const STEP = 8;',
    '',
    'export function clamp(v: number, lo: number, hi: number) {',
    '  if (v < lo) return lo;',
    '  if (v > hi) return hi;',
    '  return v;',
    '}',
    '',
    'export function fit(box: Box, w: number, h: number): Box {',
    '  let x = box.x;',
    '  let y = box.y;',
    '  x = clamp(x, MIN, w - box.w);',
    '  y = clamp(y, MIN, h - box.h);',
    '  return { x, y, w: box.w, h: box.h };',
    '}',
    '',
    'export function snap(v: number): number {',
    '  return Math.round(v / STEP) * STEP;',
    '}',
    '',
    'export function grow(box: Box, by: number): Box {',
    '  const w = box.w + by * 2;',
    '  const h = box.h + by * 2;',
    '  return { x: box.x - by, y: box.y - by, w, h };',
    '}',
    '',
    "export const NAME = 'clamp';",
    "export const UNIT = 'px';",
    'export const ZERO: Box = { x: 0, y: 0, w: 0, h: 0 };',
  ],
};

// … eight more files in the same style (router.go, retry.go, queue.lua, keymap.lua,
// stats.ts, parse.ts, pool.go, timer.lua). Each: a config block with ≥4 numeric
// literals, ≥2 string literals, ≥6 short identifiers used twice, and one adjacent
// near-duplicate pair of equal-length lines.

export const CORPUS: CorpusFile[] = [cart, clamp, /* router, retry, queue, keymap, stats, parse, pool, timer */];
export const CORPUS_BY_NAME: Record<string, CorpusFile> = Object.fromEntries(CORPUS.map(f => [f.name, f]));
```

The implementer writes the eight remaining files in full (no placeholders may remain in the committed file) and runs the test until every file passes.

- [ ] **Step 4: Run the corpus test**

Run: `npx vitest run src/challenges/__tests__/corpus.test.ts`
Expected: PASS for all ten files. Fix any file that fails a rule rather than loosening the rule.

- [ ] **Step 5: Commit**

```bash
git add src/challenges/corpus src/challenges/__tests__/corpus.test.ts
git commit -m "challenges: ten-file corpus"
```

---

### Task 3: Mutation framework and Challenge 1 kinds

**Files:**
- Create: `src/challenges/mutations/types.ts`, `src/challenges/mutations/chars.ts`, `src/challenges/mutations/index.ts`
- Test: `src/challenges/__tests__/mutations.test.ts`

**Interfaces:**
- Produces:

```ts
export type Site = { line: number; col: number; len: number };            // in the ORIGINAL
export type Mutation = {
  kind: string;
  site: Site;
  /** Lines replacing original line site.line: 0 (removed), 1 (changed) or 2 (line inserted after). */
  lines: string[];
  /** Cursor in the MUTATED file, relative to site.line, from which fixKeys restores the original. */
  fixAt: { dline: number; col: number };
  /** Vim keys (parseKeys notation) that restore the original from fixAt. Motion-free. */
  fixKeys: string;
  /** Time allowance for the edit itself, ms (motion time is added by the generator). */
  parMs: number;
  checklist: string;
};
export type MutationKind = {
  id: string;
  sites(lines: readonly string[]): Site[];
  /** null when no valid mutation exists at this site (rule 4). */
  apply(lines: readonly string[], site: Site, rng: Rng): Mutation | null;
};
export const KINDS: Record<string, MutationKind>;   // from mutations/index.ts
export function applyMutation(lines: readonly string[], m: Mutation): string[]; // types.ts
```

- [ ] **Step 1: Write the failing mutation tests (property tests over the corpus)**

```ts
// src/challenges/__tests__/mutations.test.ts
import { describe, expect, it } from 'vitest';
import { createVim } from '../../lessons/runtime';
import { CORPUS } from '../corpus';
import { KINDS } from '../mutations';
import { applyMutation } from '../mutations/types';
import { mulberry32 } from '../rng';

const SEEDS = [1, 2, 3, 4, 5];

describe.each(Object.values(KINDS).map(k => [k.id, k] as const))('mutation %s', (_id, kind) => {
  for (const f of CORPUS) {
    const sites = kind.sites(f.lines);
    it(`${f.name}: has candidate sites`, () => {
      expect(sites.length).toBeGreaterThan(0);
    });
    for (const site of sites) for (const seed of SEEDS) {
      it(`${f.name} @${site.line}:${site.col} seed ${seed}`, () => {
        const m = kind.apply(f.lines, site, mulberry32(seed));
        if (m === null) return; // rule 4: allowed to decline
        const after = applyMutation(f.lines, m);
        // rule 4: never a no-op
        expect(after.join('\n')).not.toBe(f.lines.join('\n'));
        // rule 1: only the site's line(s) differ
        for (let i = 0; i < site.line; i++) expect(after[i]).toBe(f.lines[i]);
        const tailAfter = after.slice(site.line + m.lines.length), tailOrig = f.lines.slice(site.line + 1);
        expect(tailAfter).toEqual(tailOrig);
        expect(m.checklist.length).toBeGreaterThan(3);
        expect(m.parMs).toBeGreaterThan(0);
        // rule 2: the reference fix restores the original from fixAt
        const vim = createVim({ text: after, name: f.name, cursor: { line: site.line + m.fixAt.dline, col: m.fixAt.col } });
        vim.win.cursor = { line: site.line + m.fixAt.dline, col: m.fixAt.col };
        vim.feedKeys(m.fixKeys);
        expect(vim.mode).toBe('normal');
        expect(vim.buf.text(), `fixKeys "${m.fixKeys}" did not restore`).toBe(f.lines.join('\n'));
      });
    }
  }
});

describe('challenge 1 kinds are registered', () => {
  it.each(['dropped-char', 'extra-char', 'wrong-char', 'wrong-literal', 'wrong-short-ident'])('%s', id => {
    expect(KINDS[id]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/challenges/__tests__/mutations.test.ts`
Expected: FAIL, cannot resolve `../mutations`.

- [ ] **Step 3: Write types.ts**

```ts
// src/challenges/mutations/types.ts
import type { Rng } from '../rng';

export type Site = { line: number; col: number; len: number };

export type Mutation = {
  kind: string;
  site: Site;
  lines: string[];
  fixAt: { dline: number; col: number };
  fixKeys: string;
  parMs: number;
  checklist: string;
};

export type MutationKind = {
  id: string;
  sites(lines: readonly string[]): Site[];
  apply(lines: readonly string[], site: Site, rng: Rng): Mutation | null;
};

/** The mutated file: original with line site.line replaced by m.lines. */
export function applyMutation(lines: readonly string[], m: Mutation): string[] {
  return [...lines.slice(0, m.site.line), ...m.lines, ...lines.slice(m.site.line + 1)];
}

/** Word-ish tokens with their columns. */
export function words(line: string): { col: number; text: string }[] {
  return [...line.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].map(m => ({ col: m.index!, text: m[0] }));
}

/** Escape a string for use inside Vim key notation (only '<' needs it). */
export const keyText = (s: string) => s.replace(/</g, '<lt>');
```

- [ ] **Step 4: Write chars.ts (Challenge 1 kinds)**

```ts
// src/challenges/mutations/chars.ts
// Character-level mutations: fixed with x, r, i/a and a little motion. Challenge 1.
import { pick, randInt } from '../rng';
import { type MutationKind, type Site, keyText, words } from './types';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const nearby = (c: string, rng: import('../rng').Rng) => {
  const pool = /[a-z]/.test(c) ? LETTERS : /[A-Z]/.test(c) ? LETTERS.toUpperCase() : /[0-9]/.test(c) ? '0123456789' : LETTERS;
  let out = c;
  for (let i = 0; i < 8 && out === c; i++) out = pool[randInt(rng, 0, pool.length - 1)];
  return out === c ? null : out;
};

/** Sites are identifier characters not at a word boundary (so the word stays a word). */
const innerWordSites = (lines: readonly string[]): Site[] => {
  const out: Site[] = [];
  lines.forEach((l, line) => {
    for (const w of words(l)) if (w.text.length >= 4) for (let k = 1; k < w.text.length - 1; k++) out.push({ line, col: w.col + k, len: 1 });
  });
  return out;
};

/** Remove one character inside a word → learner types `i<c><Esc>` at the gap. */
export const droppedChar: MutationKind = {
  id: 'dropped-char',
  sites: innerWordSites,
  apply(lines, site) {
    const l = lines[site.line];
    const c = l[site.col];
    const mutated = l.slice(0, site.col) + l.slice(site.col + 1);
    const w = words(l).find(w => site.col > w.col && site.col < w.col + w.text.length)!;
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
    const w = words(l).find(w => site.col > w.col && site.col < w.col + w.text.length)!;
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
    const w = words(l).find(w => site.col > w.col && site.col < w.col + w.text.length)!;
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

/** One use of a 3–6 char identifier gets one char replaced → `r<c>` (single site; rename is Challenge 4). */
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
```

- [ ] **Step 5: Write mutations/index.ts**

```ts
// src/challenges/mutations/index.ts
import { droppedChar, extraChar, wrongChar, wrongLiteral, wrongShortIdent } from './chars';
import type { MutationKind } from './types';

const all: MutationKind[] = [droppedChar, extraChar, wrongChar, wrongLiteral, wrongShortIdent];
export const KINDS: Record<string, MutationKind> = Object.fromEntries(all.map(k => [k.id, k]));
```

- [ ] **Step 6: Run the mutation tests**

Run: `npx vitest run src/challenges/__tests__/mutations.test.ts`
Expected: PASS. If a `fixKeys` replay fails, the bug is in the mutation (wrong `fixAt` or an unescaped `<`), not in the engine: print `vim.buf.text()` from the assertion message and correct the kind. Note `createVim` ignores `cursor` in its `Setup`; the test sets `vim.win.cursor` directly after creating it (mirror that if a helper is added later).

- [ ] **Step 7: Commit**

```bash
git add src/challenges/mutations src/challenges/__tests__/mutations.test.ts
git commit -m "challenges: mutation framework and Challenge 1 kinds"
```

---

### Task 4: Challenge 2 kinds (lines and words)

**Files:**
- Create: `src/challenges/mutations/lines.ts`
- Modify: `src/challenges/mutations/index.ts`
- Test: `src/challenges/__tests__/mutations.test.ts` (add the registration case)

**Interfaces:**
- Consumes: `MutationKind`, `Site`, `words`, `keyText` from `./types`; `pick`, `randInt` from `../rng`; `nearDuplicatePairs` logic (re-implemented here, not imported from the test).
- Produces: kinds `stray-line`, `stray-word`, `wrong-word`, `missing-duplicate-line`, `line-to-remove` in `KINDS`.

- [ ] **Step 1: Extend the registration test**

In `mutations.test.ts` add:

```ts
describe('challenge 2 kinds are registered', () => {
  it.each(['stray-line', 'stray-word', 'wrong-word', 'missing-duplicate-line', 'line-to-remove'])('%s', id => {
    expect(KINDS[id]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/challenges/__tests__/mutations.test.ts -t "challenge 2"`
Expected: FAIL, 5 undefined kinds.

- [ ] **Step 3: Write lines.ts**

```ts
// src/challenges/mutations/lines.ts
// Line- and word-level mutations: fixed with dd, dw, cw, yyp. Challenge 2.
import { type Rng, pick } from '../rng';
import { type MutationKind, type Site, keyText, words } from './types';

const indentOf = (l: string) => /^\s*/.exec(l)![0];
const JUNK: Record<string, string[]> = {
  ts: ["console.log('here');", '// TODO: remove', 'debugger;'],
  go: ['fmt.Println("here")', '// TODO: remove'],
  lua: ["print('here')", '-- TODO: remove'],
};
const langOf = (lines: readonly string[]) => (lines.some(l => /\bfunc\b|:=/.test(l)) ? 'go' : lines.some(l => /\blocal\b|\bend\b/.test(l)) ? 'lua' : 'ts');

/** Non-blank lines inside a block (indented) are places junk can follow. */
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

/** Adjacent equal-length lines differing in 1–3 columns. */
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

/** An original line is marked for removal: the goal omits it → `dd`. Sites: standalone statements the file still compiles without. */
export const lineToRemove: MutationKind = {
  id: 'line-to-remove',
  sites: lines => bodySites(lines).filter(s => /;\s*$|\)\s*$/.test(lines[s.line]) && !/return|\{$|\}$/.test(lines[s.line])),
  apply(lines, site) {
    const l = lines[site.line];
    return {
      kind: 'line-to-remove', site, lines: [l],
      fixAt: { dline: 0, col: 0 }, fixKeys: 'dd', parMs: 900,
      checklist: `delete the "${l.trim()}" line`,
      // NOTE: this kind is the one exception to "goal = original": the generator removes
      // this line from the GOAL instead of changing the start. See generate.ts.
    };
  },
};
```

`line-to-remove` inverts the usual direction: the start keeps the line and the goal drops it. The generic mutation test (rule 2) cannot apply to it as written, so in `mutations.test.ts` wrap the per-site block with `if (kind.id === 'line-to-remove') return;` at the top of the `it` and add a dedicated test:

```ts
describe('line-to-remove', () => {
  it('dd on the line yields the original minus that line', () => {
    for (const f of CORPUS) for (const site of KINDS['line-to-remove'].sites(f.lines).slice(0, 5)) {
      const m = KINDS['line-to-remove'].apply(f.lines, site, mulberry32(1))!;
      const vim = createVim({ text: f.lines, name: f.name });
      vim.win.cursor = { line: site.line, col: 0 };
      vim.feedKeys(m.fixKeys);
      expect(vim.buf.lines).toEqual([...f.lines.slice(0, site.line), ...f.lines.slice(site.line + 1)]);
    }
  });
});
```

- [ ] **Step 4: Register the kinds**

```ts
// src/challenges/mutations/index.ts
import { droppedChar, extraChar, wrongChar, wrongLiteral, wrongShortIdent } from './chars';
import { lineToRemove, missingDuplicateLine, strayLine, strayWord, wrongWord } from './lines';
import type { MutationKind } from './types';

const all: MutationKind[] = [
  droppedChar, extraChar, wrongChar, wrongLiteral, wrongShortIdent,
  strayLine, strayWord, wrongWord, missingDuplicateLine, lineToRemove,
];
export const KINDS: Record<string, MutationKind> = Object.fromEntries(all.map(k => [k.id, k]));
```

- [ ] **Step 5: Run the mutation tests**

Run: `npx vitest run src/challenges/__tests__/mutations.test.ts`
Expected: PASS. `missing-duplicate-line` replays `yyp0{n}lr<c>`; if `{n}l` is clipped at end of line in the engine, the site's `cols` are inside the line so it cannot clip. `dw` on `stray-word` must leave exactly the original: the noise word is followed by one space, which `dw` consumes.

- [ ] **Step 6: Commit**

```bash
git add src/challenges/mutations src/challenges/__tests__/mutations.test.ts
git commit -m "challenges: Challenge 2 line and word mutation kinds"
```

---

### Task 5: Generator

**Files:**
- Create: `src/challenges/generate.ts`, `src/challenges/index.ts`
- Test: `src/challenges/__tests__/generate.test.ts`

**Interfaces:**
- Consumes: `KINDS`, `applyMutation`, `Mutation`; `mulberry32`, `randInt`, `shuffle`; `shortestPath` from `src/lessons/runtime.ts`; `align` from `src/lessons/goalDiff.ts`.
- Produces:

```ts
export type ChecklistItem = {
  kind: string;
  text: string;
  /** Contiguous goal (original) line range this item owns, inclusive. */
  goal: [number, number];
  /** Where the reference fix starts, in the START text. */
  fixAt: Pos;
  /** Reference keys for the fix (motion excluded). */
  fixKeys: string;
};
export type Generated = { seed: number; file: string; start: string[]; goal: string[]; items: ChecklistItem[]; parKeys: number; parMs: number };
export function generate(c: GeneratedChallenge, seed: number): Generated;
/** True when the item's goal window (its lines plus one neighbour each side) is exactly aligned in `cur`. */
export function itemDone(item: ChecklistItem, cur: readonly string[], goal: readonly string[]): boolean;
/** Count of diff hunks (unpaired cur or goal lines) outside every item's window. */
export function collateral(items: ChecklistItem[], cur: readonly string[], goal: readonly string[]): number;
export const MOTION_MS = 250; export const MAX_MOTION_KEYS = 8;
```

Algorithm (`generate`):
1. `rng = mulberry32(seed)`; `file = pick(rng, c.corpus)`; `orig = file.lines`.
2. `n = randInt(rng, c.edits[0], c.edits[1])`.
3. Candidates: for each kind id in `c.mutations`, every site → `{kind, site}`; `shuffle(rng, …)`.
4. Walk candidates; keep one if (a) no kept item is within one line of it (`|site.line − kept.site.line| ≥ 2`, and for kinds that produce two lines or remove one, treat the touched range as `[line, line+1]`), (b) the kind's count is `< Math.ceil(n / 2)`, (c) `apply()` returns non-null. Stop at `n`.
5. Sort kept by `site.line` **descending**; build `goal = orig.slice()` and `start = orig.slice()`. For `line-to-remove`: splice the line out of `goal`, start unchanged. For every other kind: `start = applyMutation(start, m)`. Because we go bottom-up, earlier (lower) splices never shift a later (higher) site.
6. Compute each item's `fixAt` in the **start** text and `goal` range in the **goal** text by walking the kept list top-down and accumulating offsets: `startOff` (+1 for `stray-line`, −1 for `missing-duplicate-line`) and `goalOff` (−1 for `line-to-remove`). `fixAt = { line: site.line + startOff + m.fixAt.dline, col: m.fixAt.col }`; goal range: `[site.line + goalOff, site.line + goalOff]` normally; `stray-line` → the site line (the junk sits after it); `missing-duplicate-line` → `[site.line + goalOff, site.line + goalOff]` (the line that must appear); `line-to-remove` → `[site.line − 1 + goalOff, site.line − 1 + goalOff]` clamped ≥ 0 (its neighbour; the window check proves the removal).
7. Items sorted by `fixAt.line`. Par: `prev = {line:0,col:0}`; for each item, `motion = Math.min(shortestPath(start, prev, item.fixAt, 'hjklwbeWBE0$', MAX_MOTION_KEYS + 1), MAX_MOTION_KEYS)`; `parKeys += motion + parseKeys(fixKeys).length`; `parMs += motion * MOTION_MS + m.parMs`; `prev = item.fixAt`.

`itemDone`: `pairs = align(cur, goal)`, `map = new Map(pairs.map(([c,g]) => [g,c]))`; `lo = max(0, goal[0]−1)`, `hi = min(goal.length−1, goal[1]+1)`; every `g` in `[lo,hi]` must be in `map`, and `map.get(hi) − map.get(lo) === hi − lo`.

`collateral`: `pairs` as above; unpaired cur indices and unpaired goal indices; a goal index is "inside" an item if within its `[lo,hi]` window; a cur index is inside if it lies between `map.get(lo)` and `map.get(hi)` of any item whose ends are mapped, or between the mapped neighbours of an item's window when the item is not done. Count contiguous runs of outside unpaired indices (cur and goal separately) as hunks. Keep it simple and exact to this description; the tests below define the behaviour.

- [ ] **Step 1: Write the failing generator tests**

```ts
// src/challenges/__tests__/generate.test.ts
import { describe, expect, it } from 'vitest';
import { createVim } from '../../lessons/runtime';
import { parseKeys } from '../../vim/keys';
import { CORPUS } from '../corpus';
import { collateral, generate, itemDone } from '../generate';
import { CHALLENGES } from '../index';

const seeds = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);

describe.each(CHALLENGES.map(c => [c.id, c] as const))('%s', (_id, ch) => {
  const c = ch.challenge;
  it('is deterministic', () => {
    expect(generate(c, 123)).toEqual(generate(c, 123));
    expect(generate(c, 123).start).not.toEqual(generate(c, 124).start);
  });
  it.each(seeds)('seed %d: well formed', seed => {
    const g = generate(c, seed);
    expect(g.items.length).toBeGreaterThanOrEqual(c.edits[0]);
    expect(g.items.length).toBeLessThanOrEqual(c.edits[1]);
    expect(g.start).not.toEqual(g.goal);
    expect(g.parKeys).toBeGreaterThan(0);
    expect(Number.isFinite(g.parMs) && g.parMs > 0).toBe(true);
    // items keep a one-line gap
    const ranges = g.items.map(i => i.goal).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ranges.length; i++) expect(ranges[i][0] - ranges[i - 1][1]).toBeGreaterThanOrEqual(2);
    // kind balance
    const byKind = new Map<string, number>();
    for (const i of g.items) byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1);
    for (const n of byKind.values()) expect(n).toBeLessThanOrEqual(Math.ceil(g.items.length / 2));
    // nothing is done at the start; collateral is zero at the start
    for (const i of g.items) expect(itemDone(i, g.start, g.goal)).toBe(false);
    expect(collateral(g.items, g.start, g.goal)).toBe(0);
  });
  it.each(seeds.slice(0, 40))('seed %d: replaying every fix in order reaches the goal with par keys', seed => {
    const g = generate(c, seed);
    const vim = createVim({ text: g.start, name: g.file });
    let keys = 0;
    for (const item of g.items) {
      vim.win.cursor = { ...item.fixAt };
      vim.feedKeys(item.fixKeys);
      keys += parseKeys(item.fixKeys).length;
      expect(itemDone(item, vim.buf.lines, g.goal), `${item.kind}: ${item.text}`).toBe(true);
    }
    expect(vim.buf.lines).toEqual(g.goal);
    expect(keys).toBeLessThanOrEqual(g.parKeys);
    expect(collateral(g.items, vim.buf.lines, g.goal)).toBe(0);
  });
  it('every corpus file supports the edit range', () => {
    for (const f of CORPUS) {
      const single = { ...c, corpus: [f] };
      const ok = seeds.slice(0, 30).every(s => generate(single, s).items.length >= c.edits[0]);
      expect(ok, f.name).toBe(true);
    }
  });
});

describe('itemDone / collateral', () => {
  const goal = ['a', 'b', 'c', 'd', 'e'];
  const item = { kind: 'wrong-char', text: 't', goal: [2, 2] as [number, number], fixAt: { line: 2, col: 0 }, fixKeys: 'rc' };
  it('is done only when the window is exactly aligned', () => {
    expect(itemDone(item, ['a', 'b', 'x', 'd', 'e'], goal)).toBe(false);
    expect(itemDone(item, goal, goal)).toBe(true);
    expect(itemDone(item, ['a', 'b', 'c', 'junk', 'd', 'e'], goal)).toBe(false); // junk inside the window
    expect(itemDone(item, ['a', 'b', 'c', 'd', 'e', 'junk'], goal)).toBe(true);  // junk outside
  });
  it('counts damage outside item windows', () => {
    expect(collateral([item], ['a', 'b', 'x', 'd', 'e'], goal)).toBe(0);
    expect(collateral([item], ['zz', 'b', 'x', 'd', 'e'], goal)).toBe(1);
    expect(collateral([item], ['b', 'x', 'd'], goal)).toBe(2);        // 'a' and 'e' each lost: two separate runs
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/challenges/__tests__/generate.test.ts`
Expected: FAIL, cannot resolve `../generate` / `../index`.

- [ ] **Step 3: Write generate.ts**

```ts
// src/challenges/generate.ts
// Turns a GeneratedChallenge + seed into a concrete session. Pure and deterministic.
import { align } from '../lessons/goalDiff';
import { shortestPath } from '../lessons/runtime';
import type { GeneratedChallenge } from '../lessons/types';
import { parseKeys } from '../vim/keys';
import type { Pos } from '../vim/types';
import { KINDS } from './mutations';
import { type Mutation, applyMutation } from './mutations/types';
import { mulberry32, pick, randInt, shuffle } from './rng';

export type ChecklistItem = {
  kind: string;
  text: string;
  goal: [number, number];
  fixAt: Pos;
  fixKeys: string;
};

export type Generated = {
  seed: number;
  file: string;
  start: string[];
  goal: string[];
  items: ChecklistItem[];
  parKeys: number;
  parMs: number;
};

export const MOTION_MS = 250;
export const MAX_MOTION_KEYS = 8;
const PATH_KEYS = 'hjklwbeWBE0$';

/** Lines a mutation touches in the original (for the one-line-gap rule). */
const touched = (m: Mutation): [number, number] => (m.kind === 'stray-line' ? [m.site.line, m.site.line + 1] : m.kind === 'missing-duplicate-line' ? [m.site.line - 1, m.site.line] : [m.site.line, m.site.line]);

export function generate(c: GeneratedChallenge, seed: number): Generated {
  const rng = mulberry32(seed);
  const file = pick(rng, c.corpus);
  const orig = file.lines;
  const n = randInt(rng, c.edits[0], c.edits[1]);
  const cap = Math.ceil(n / 2);

  const cands = shuffle(rng, c.mutations.flatMap(id => KINDS[id].sites(orig).map(site => ({ id, site }))));
  const kept: Mutation[] = [];
  const perKind = new Map<string, number>();
  for (const { id, site } of cands) {
    if (kept.length >= n) break;
    if ((perKind.get(id) ?? 0) >= cap) continue;
    const m = KINDS[id].apply(orig, site, rng);
    if (!m) continue;
    const [a, b] = touched(m);
    if (kept.some(k => { const [x, y] = touched(k); return a <= y + 1 && x <= b + 1; })) continue;
    kept.push(m);
    perKind.set(id, (perKind.get(id) ?? 0) + 1);
  }

  // Apply bottom-up so splices never shift a site above them.
  kept.sort((p, q) => q.site.line - p.site.line);
  let start = orig.slice(), goal = orig.slice();
  for (const m of kept) {
    if (m.kind === 'line-to-remove') goal = [...goal.slice(0, m.site.line), ...goal.slice(m.site.line + 1)];
    else start = applyMutation(start, m);
  }

  // Positions in start/goal, walking top-down with running offsets.
  kept.sort((p, q) => p.site.line - q.site.line);
  let startOff = 0, goalOff = 0;
  const items: ChecklistItem[] = [];
  for (const m of kept) {
    const fixAt: Pos = { line: m.site.line + startOff + m.fixAt.dline, col: m.fixAt.col };
    let g: [number, number];
    if (m.kind === 'line-to-remove') { const l = Math.max(0, m.site.line - 1 + goalOff); g = [l, l]; goalOff--; }
    else if (m.kind === 'stray-line') { g = [m.site.line + goalOff, m.site.line + goalOff]; startOff++; }
    else if (m.kind === 'missing-duplicate-line') { g = [m.site.line + goalOff, m.site.line + goalOff]; startOff--; }
    else g = [m.site.line + goalOff, m.site.line + goalOff];
    items.push({ kind: m.kind, text: m.checklist, goal: g, fixAt, fixKeys: m.fixKeys });
  }
  items.sort((p, q) => p.fixAt.line - q.fixAt.line || p.fixAt.col - q.fixAt.col);

  let parKeys = 0, parMs = 0, prev: Pos = { line: 0, col: 0 };
  for (const it of items) {
    const m = kept.find(k => k.checklist === it.text && k.fixKeys === it.fixKeys)!;
    const motion = Math.min(shortestPath(start, prev, it.fixAt, PATH_KEYS, MAX_MOTION_KEYS + 1), MAX_MOTION_KEYS);
    parKeys += motion + parseKeys(it.fixKeys).length;
    parMs += motion * MOTION_MS + m.parMs;
    prev = it.fixAt;
  }
  return { seed, file: file.name, start, goal, items, parKeys, parMs };
}

const window = (item: ChecklistItem, goalLen: number): [number, number] => [Math.max(0, item.goal[0] - 1), Math.min(goalLen - 1, item.goal[1] + 1)];

export function itemDone(item: ChecklistItem, cur: readonly string[], goal: readonly string[]): boolean {
  const map = new Map(align(cur, goal).map(([c, g]) => [g, c] as const));
  const [lo, hi] = window(item, goal.length);
  for (let g = lo; g <= hi; g++) if (!map.has(g)) return false;
  return map.get(hi)! - map.get(lo)! === hi - lo;
}

export function collateral(items: ChecklistItem[], cur: readonly string[], goal: readonly string[]): number {
  const pairs = align(cur, goal);
  const g2c = new Map(pairs.map(([c, g]) => [g, c] as const));
  const pairedCur = new Set(pairs.map(([c]) => c));
  const insideGoal = (g: number) => items.some(it => { const [lo, hi] = window(it, goal.length); return g >= lo && g <= hi; });
  const insideCur = (c: number) => items.some(it => {
    const [lo, hi] = window(it, goal.length);
    // Nearest mapped goal lines at or beyond the window ends bound the cur region.
    let a = lo; while (a >= 0 && !g2c.has(a)) a--;
    let b = hi; while (b < goal.length && !g2c.has(b)) b++;
    const ca = a >= 0 ? g2c.get(a)! : -1, cb = b < goal.length ? g2c.get(b)! : cur.length;
    return c > ca && c < cb;
  });
  let hunks = 0, run = false;
  for (let g = 0; g < goal.length; g++) {
    const bad = !g2c.has(g) && !insideGoal(g);
    if (bad && !run) hunks++;
    run = bad;
  }
  run = false;
  for (let c = 0; c < cur.length; c++) {
    const bad = !pairedCur.has(c) && !insideCur(c);
    if (bad && !run) hunks++;
    run = bad;
  }
  return hunks;
}
```

- [ ] **Step 4: Write challenges/index.ts (the two challenge definitions)**

```ts
// src/challenges/index.ts
import type { GeneratedChallenge } from '../lessons/types';
import { CORPUS } from './corpus';

export type ChallengeDef = { id: string; title: string; chips: string[]; challenge: GeneratedChallenge };

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'challenge-fix-the-file',
    title: 'Fix the File',
    chips: ['w', 'f', 'x', 'r', 'i'],
    challenge: {
      kind: 'generated',
      skills: ['movement', 'delete', 'replace', 'insert', 'find'],
      mutations: ['dropped-char', 'extra-char', 'wrong-char', 'wrong-literal', 'wrong-short-ident'],
      corpus: CORPUS,
      edits: [8, 12],
    },
  },
  {
    id: 'challenge-operators',
    title: 'Operators',
    chips: ['d', 'c', 'dd', '.'],
    challenge: {
      kind: 'generated',
      skills: ['movement', 'delete', 'replace', 'insert', 'find', 'operators', 'repeat'],
      mutations: [
        'dropped-char', 'extra-char', 'wrong-char', 'wrong-literal', 'wrong-short-ident',
        'stray-line', 'stray-word', 'wrong-word', 'missing-duplicate-line', 'line-to-remove',
      ],
      corpus: CORPUS,
      edits: [10, 14],
    },
  },
];
```

- [ ] **Step 5: Run the generator tests**

Run: `npx vitest run src/challenges/__tests__/generate.test.ts`
Expected: PASS for both challenges over 200 seeds. If `every corpus file supports the edit range` fails for a file, add candidate sites to that corpus file (more repeated identifiers, another near-duplicate pair) — do not lower `edits`. If a `replaying every fix` case fails with a mismatched goal, the offset bookkeeping in step 6 of the algorithm is wrong for that kind combination; print `g.items` and the two texts.

- [ ] **Step 6: Commit**

```bash
git add src/challenges/generate.ts src/challenges/index.ts src/challenges/__tests__/generate.test.ts
git commit -m "challenges: seeded generator with checklist ticks and par"
```

---

### Task 6: Runtime — `generated` sessions

**Files:**
- Modify: `src/lessons/runtime.ts` (`Session` fields, `total`, `start`, `key`, `view`, `result`; `SessionView` gains `items` and `seed`)
- Test: `src/lessons/__tests__/generated.test.ts`

**Interfaces:**
- Consumes: `generate`, `itemDone`, `collateral`, `Generated` from `src/challenges/generate.ts`; `finalize`, `goalMet`, `createVim`.
- Produces: `new Session(challenge, { seed?: number })`; `SessionView.items: { text: string; kind: string; done: boolean; line: number }[]` (empty for other kinds); `SessionView.seed: number | null`; `Session.generated: Generated | null`.

- [ ] **Step 1: Write the failing runtime test**

```ts
// src/lessons/__tests__/generated.test.ts
import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../../challenges';
import { generate } from '../../challenges/generate';
import { solutionKeys } from '../runtime';
import { Session } from '../runtime';

const ch = CHALLENGES[0].challenge;

describe('generated session', () => {
  it('uses the seed it is given and exposes items', () => {
    const s = new Session(ch, { seed: 99 });
    const g = generate(ch, 99);
    expect(s.view().seed).toBe(99);
    expect(s.vim!.buf.lines).toEqual(g.start);
    expect(s.view().goalText).toEqual(g.goal);
    expect(s.view().items.map(i => i.text)).toEqual(g.items.map(i => i.text));
    expect(s.view().items.every(i => !i.done)).toBe(true);
    expect(s.total).toBe(g.items.length);
  });
  it('completes when every fix is replayed, with acc 1 and correct 1', () => {
    const s = new Session(ch, { seed: 5 });
    const g = generate(ch, 5);
    let t = 0;
    for (const item of g.items) {
      s.vim!.win.cursor = { ...item.fixAt };            // teleport stands in for motion keys
      for (const k of solutionKeys(item.fixKeys)) s.key(k, (t += 100));
      expect(s.view().items.find(i => i.text === item.text)!.done).toBe(true);
    }
    expect(s.done).toBe(true);
    const r = s.result();
    expect(r.correct).toBe(1);
    expect(r.keys).toBeLessThanOrEqual(g.parKeys);
    expect(r.parKeys).toBe(g.parKeys);
    expect(r.parTime).toBe(g.parMs);
    expect(s.view().hits).toBe(g.items.length);
  });
  it('collateral is remembered after undo', () => {
    const s = new Session(ch, { seed: 5 });
    const g = generate(ch, 5);
    let t = 0;
    // Delete an untouched line far from every item, then undo it.
    const safe = g.goal.findIndex((_, i) => g.items.every(it => Math.abs(it.goal[0] - i) > 2) && g.start[i] === g.goal[i]);
    s.vim!.win.cursor = { line: safe, col: 0 };
    for (const k of solutionKeys('ddu')) s.key(k, (t += 100));
    for (const item of g.items) {
      s.vim!.win.cursor = { ...item.fixAt };
      for (const k of solutionKeys(item.fixKeys)) s.key(k, (t += 100));
    }
    expect(s.done).toBe(true);
    expect(s.result().correct).toBeLessThan(1);
    expect(s.result().correct).toBeCloseTo(1 - 1 / g.items.length, 5);
  });
  it('a fresh session without a seed still runs', () => {
    const s = new Session(ch);
    expect(typeof s.view().seed).toBe('number');
    expect(s.view().items.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lessons/__tests__/generated.test.ts`
Expected: FAIL (`seed` option unknown / `items` undefined / vim null).

- [ ] **Step 3: Implement in runtime.ts**

Imports at the top of `runtime.ts`:

```ts
import { type Generated, collateral, generate, itemDone } from '../challenges/generate';
import type { GeneratedChallenge } from './types';
```

Add to `SessionView`:

```ts
  /** Generated challenges: the checklist, ticked live. Empty otherwise. */
  items: { text: string; kind: string; done: boolean; line: number }[];
  seed: number | null;
```

Add fields to `Session`:

```ts
  generated: Generated | null = null;
  private collateralMax = 0;
```

Constructor option and start:

```ts
  constructor(challenge: Challenge, opts: { targetCount?: number; rand?: () => number; carryCursor?: boolean; seed?: number } = {}) {
    this.challenge = challenge;
    this.carryCursor = opts.carryCursor ?? true;
    this.targetCount = opts.targetCount ?? (challenge.kind === 'target' || challenge.kind === 'word' ? challenge.count ?? 12 : 0);
    this.rand = opts.rand ?? Math.random;
    if (challenge.kind === 'generated') this.generated = generate(challenge, opts.seed ?? Math.floor(Math.random() * 0x100000000));
    this.start();
  }
```

In `get total()`, before the quiz fallback: `if (c.kind === 'generated') return this.generated!.items.length;`

In `start()`, add a branch:

```ts
    } else if (c.kind === 'generated') {
      const g = this.generated!;
      this.vim = createVim({ text: g.start, name: g.file, height: Math.min(g.start.length + 1, 40) });
      this.installReset();
    }
```

(`installReset` exists for rounds; if it assumes a `Round`, guard it or skip the call — read it first.)

In `key()`, after the `rounds` branch:

```ts
    } else if (c.kind === 'generated') {
      const g = this.generated!;
      this.collateralMax = Math.max(this.collateralMax, collateral(g.items, vim.buf.lines, g.goal));
      this.hits = g.items.filter(it => itemDone(it, vim.buf.lines, g.goal)).length;
      if (goalMet(vim, { text: g.goal })) this.finish(now);
    }
```

In `view()`: compute

```ts
    const g = c.kind === 'generated' ? this.generated! : null;
    const goalText = g ? g.goal : showGoal ? (...existing...) : null;
    const items = g && this.vim
      ? g.items.map(it => {
          const pairs = align(this.vim!.buf.lines, g.goal);
          const c0 = pairs.find(([, gl]) => gl === it.goal[0])?.[0];
          return { text: it.text, kind: it.kind, done: this.done || itemDone(it, this.vim!.buf.lines, g.goal), line: (c0 ?? it.fixAt.line) + 1 };
        })
      : [];
```

(import `align` from `./goalDiff`; compute `pairs` once outside the map) and return `items, seed: g?.seed ?? null` in the object. `prompt` stays `null` for generated.

In `result()`, before the quiz fallback:

```ts
    if (c.kind === 'generated') {
      const g = this.generated!;
      const correct = Math.max(0, 1 - this.collateralMax / Math.max(1, g.items.length));
      return finalize(elapsed, g.parMs, g.parKeys, this.keys, correct, 'Clean',
        this.collateralMax ? `${this.collateralMax} stray edit${this.collateralMax === 1 ? '' : 's'} outside the list` : 'nothing touched outside the list');
    }
```

- [ ] **Step 4: Run the runtime tests and the full suite**

Run: `npx vitest run src/lessons/__tests__/generated.test.ts && npm test`
Expected: the new file passes; the full suite still passes except `lessons.test.ts` may not yet know the section (Task 7). `npx tsc -b` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lessons/runtime.ts src/lessons/__tests__/generated.test.ts
git commit -m "challenges: generated sessions in the runtime"
```

---

### Task 7: Lessons section, registry, sidebar band

**Files:**
- Create: `src/lessons/sections/challenges.tsx`
- Modify: `src/lessons/index.ts` (import + append), `src/lessons/__tests__/lessons.test.ts` (key-card rule), `src/components/Sidebar.tsx` (`BANDS`)

**Interfaces:**
- Consumes: `CHALLENGES` from `src/challenges`.
- Produces: section `challenges` with lessons `challenge-fix-the-file`, `challenge-operators` (`boss: true`, `keyCards: []`).

- [ ] **Step 1: Relax the well-formed test for generated challenges**

In `lessons.test.ts` `is well formed`, change the two key-card lines to:

```ts
    if (lesson.challenge.kind !== 'generated') {
      expect(lesson.keyCards.length).toBeGreaterThanOrEqual(1);
      expect(lesson.keyCards.length).toBeLessThanOrEqual(5);
    }
```

and add after the `quiz` branch:

```ts
  } else if (c.kind === 'generated') {
    it('generates a solvable run', () => {
      const s = new Session(c, { seed: 1 });
      expect(s.total).toBeGreaterThan(0);
      expect(s.vim!.buf.lineCount).toBeGreaterThanOrEqual(25);
    });
```

- [ ] **Step 2: Run to verify the new case fails**

Run: `npx vitest run src/lessons/__tests__/lessons.test.ts`
Expected: the suite passes but has no `challenges` section yet (0 generated cases). Proceed.

- [ ] **Step 3: Write the section**

```tsx
// src/lessons/sections/challenges.tsx
// Challenges: combined-skill edits on a generated file. Not counted toward completion.
import { CHALLENGES } from '../../challenges';
import { Code } from '../../components/Code';
import type { Lesson, Section } from '../types';

const intros: Record<string, { intro: Lesson['intro']; aside: Lesson['aside'] }> = {
  'challenge-fix-the-file': {
    intro: (
      <>
        <p>
          Everything from the first five sections, together. A real file with a dozen small mistakes: typos,
          a wrong digit, an identifier with one letter off. The list on the right says what each one is; you
          decide how to get there and which key fixes it.
        </p>
        <p>
          Work top to bottom, or by whatever is closest. <Code>f</Code> and <Code>/</Code> beat counting
          columns; <Code>r</Code> beats <Code>x</Code> + <Code>i</Code> for a one-character swap.
        </p>
      </>
    ),
    aside: { title: 'Every run is new', body: <p>The file and its mistakes are generated from a seed. Replay a seed to race yourself, or take a new file.</p> },
  },
  'challenge-operators': {
    intro: (
      <>
        <p>
          Adds operators to the mix: stray lines and words to delete, wrong words to change, a line that is
          missing its near-twin. <Code>dd</Code>, <Code>dw</Code>, <Code>cw</Code> and <Code>yyp</Code> do the
          heavy lifting; <Code>.</Code> repeats the last one.
        </p>
        <p>
          The checklist tells you what changed. Read the item, jump there, pick the operator that does it
          in one go.
        </p>
      </>
    ),
    aside: { title: 'Undo is free', body: <p><Code>u</Code> never costs accuracy; only edits that leave the file wrong somewhere else do.</p> },
  },
};

export const challenges: Section = {
  id: 'challenges',
  title: 'Challenges',
  band: 'challenges',
  lessons: CHALLENGES.map(c => ({
    id: c.id,
    title: c.title,
    chips: c.chips,
    keyCards: [],
    boss: true,
    intro: intros[c.id].intro,
    practice: total => <p>{total} fixes on the list. Any keys you like; the file is done when every item is ticked.</p>,
    aside: intros[c.id].aside,
    challenge: c.challenge,
  })),
};
```

- [ ] **Step 4: Register the section and the band**

In `src/lessons/index.ts`: `import { challenges } from './sections/challenges';` and append `challenges,` as the last entry of `SECTIONS`.

In `src/components/Sidebar.tsx` `BANDS`, append `{ id: 'challenges', title: 'Challenges' },`.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test && npx tsc -b`
Expected: all pass; `lessons.test.ts` now runs two `generates a solvable run` cases. The sidebar band title `Challenges` shows two ★ entries.

- [ ] **Step 6: Commit**

```bash
git add src/lessons/sections/challenges.tsx src/lessons/index.ts src/lessons/__tests__/lessons.test.ts src/components/Sidebar.tsx
git commit -m "challenges: section, registry and sidebar band"
```

---

### Task 8: Checklist panel, seed in URL, results links

**Files:**
- Create: `src/components/Checklist.tsx`, `src/state/seed.ts`
- Modify: `src/components/Practice.tsx`, `src/components/Results.tsx`, `src/components/LessonPage.tsx`, `src/App.tsx`, `src/styles.css`
- Test: `src/state/__tests__/seed.test.ts`

**Interfaces:**
- Produces: `seedFromHash(hash: string): number | null` (valid: decimal integer in `[0, 2^32)`); `lessonIdFromHash(hash: string): string`; `<Checklist items={SessionView['items']} />`; `Results` props gain `seed?: number | null`, `onNewSeed?: () => void`, `replayHref?: string`.

- [ ] **Step 1: Write the failing seed test**

```ts
// src/state/__tests__/seed.test.ts
import { describe, expect, it } from 'vitest';
import { lessonIdFromHash, seedFromHash } from '../seed';

describe('seed in hash', () => {
  it('parses a valid seed', () => {
    expect(seedFromHash('#challenge-fix-the-file?seed=12345')).toBe(12345);
    expect(seedFromHash('#/challenge-fix-the-file?seed=0')).toBe(0);
  });
  it('rejects garbage', () => {
    expect(seedFromHash('#challenge-fix-the-file')).toBeNull();
    expect(seedFromHash('#x?seed=abc')).toBeNull();
    expect(seedFromHash('#x?seed=-1')).toBeNull();
    expect(seedFromHash('#x?seed=4294967296')).toBeNull();
    expect(seedFromHash('#x?seed=1.5')).toBeNull();
  });
  it('strips the query from the lesson id', () => {
    expect(lessonIdFromHash('#challenge-operators?seed=7')).toBe('challenge-operators');
    expect(lessonIdFromHash('#/x')).toBe('x');
    expect(lessonIdFromHash('')).toBe('');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/state/__tests__/seed.test.ts`
Expected: FAIL, cannot resolve `../seed`.

- [ ] **Step 3: Implement seed.ts**

```ts
// src/state/seed.ts
// `#<lesson-id>?seed=N` replays one exact generated challenge.
export function lessonIdFromHash(hash: string): string {
  return decodeURIComponent(hash.replace(/^#\/?/, '').split('?')[0]);
}

export function seedFromHash(hash: string): number | null {
  const q = hash.split('?')[1];
  if (!q) return null;
  const v = new URLSearchParams(q).get('seed');
  if (v === null || !/^\d{1,10}$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n < 0x100000000 ? n : null;
}

export const seedHref = (id: string, seed: number) => `#${id}?seed=${seed}`;
```

- [ ] **Step 4: Use it in App.tsx**

Replace `lessonFromHash`'s body with `const id = lessonIdFromHash(location.hash); return LESSONS[id] ? id : '';` (import from `./state/seed`). In `go()`, keep `history.pushState(null, '', '#' + id)` as is (navigating drops the seed, which is intended). Pass `seed={seedFromHash(location.hash)}` to `<LessonPage>` and re-read it in the `hashchange` handler by storing it in state: `const [seed, setSeed] = useState(() => seedFromHash(location.hash));` updated in `onHash`.

- [ ] **Step 5: Thread seed through LessonPage → Practice → Session**

`LessonPage` props gain `seed: number | null`; pass `seed={seed}` to `<Practice>`. In `Practice`, props gain `seed: number | null`; session creation becomes:

```ts
  const seedRef = useRef<number | null>(p.seed);
  if (!session.current || session.current.challenge !== lesson.challenge) session.current = new Session(lesson.challenge, { seed: seedRef.current ?? undefined });
```

`restart` (repeat) keeps the same seed for generated challenges: `new Session(lesson.challenge, { seed: s.view().seed ?? undefined })`. Add `newFile`: `seedRef.current = null; session.current = new Session(lesson.challenge); setFinished(null); rerender(); focus`. `total` in `LessonPage` (`new Session(lesson.challenge).total`) is fine: the practice note shows the count for a random run; for generated challenges show the range instead: `lesson.challenge.kind === 'generated' ? lesson.practice(0) : lesson.practice(total)` and word the note without the number ("Fixes on the list…"). Update the section's `practice` text accordingly: `practice: () => <p>Every fix is on the list. Any keys you like; the file is done when every item is ticked.</p>`.

- [ ] **Step 6: Checklist component and layout**

```tsx
// src/components/Checklist.tsx
import type { SessionView } from '../lessons/runtime';

export function Checklist({ items }: { items: SessionView['items'] }) {
  const done = items.filter(i => i.done).length;
  return (
    <aside className="checklist" aria-label="edits to make">
      <div className="checklist-head">
        <span>Edits</span>
        <span className="checklist-count">{done} / {items.length}</span>
      </div>
      <ol className="checklist-list">
        {items.map((it, i) => (
          <li key={i} className={'checklist-item' + (it.done ? ' done' : '')}>
            <span className="checklist-tick" aria-hidden="true">{it.done ? '✓' : ''}</span>
            <span className="checklist-text">{it.text}</span>
            <span className="checklist-line">{it.line}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
```

In `Practice.tsx`, wrap the editor for generated challenges:

```tsx
        {!v.done && !isQuiz && s.vim && (
          <div className={'ed-body' + (v.roundDone ? ' round-ok' : '') + (v.items.length ? ' with-list' : '')}>
            <EditorView … />
            {showPane && v.goalText && <GoalPane … />}
            {v.items.length > 0 && <Checklist items={v.items} />}
          </div>
        )}
```

CSS (append to `src/styles.css`):

```css
/* ---------- challenge checklist ---------- */
.ed-body.with-list { display: grid; grid-template-columns: minmax(0, 1fr) 240px; }
.ed-body.with-list > .ev-panes { min-width: 0; }
.checklist { border-left: 1px solid var(--line); background: var(--bg-bar); font-size: 12.5px; display: flex; flex-direction: column; min-height: 0; }
.checklist-head { display: flex; justify-content: space-between; padding: 8px 12px; color: var(--muted); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; font-size: 11px; }
.checklist-count { color: var(--green); }
.checklist-list { list-style: none; margin: 0; padding: 0 0 8px; overflow-y: auto; }
.checklist-item { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; gap: 8px; align-items: baseline; padding: 4px 12px; color: var(--fg); }
.checklist-item.done { color: var(--muted); }
.checklist-item.done .checklist-text { text-decoration: line-through; }
.checklist-tick { color: var(--green); font-weight: 700; }
.checklist-text { font-family: var(--mono); white-space: pre-wrap; word-break: break-word; }
.checklist-line { color: var(--comment); font-family: var(--mono); font-size: 11px; }
@media (max-width: 900px) {
  .ed-body.with-list { grid-template-columns: 1fr; }
  .checklist { border-left: 0; border-top: 1px solid var(--line); max-height: 180px; }
}
```

Note `.ev-panes:not(.multi)` has `overflow-x: auto`; in the grid the editor column gets `minmax(0, 1fr)` so long lines scroll inside it rather than widening the grid.

- [ ] **Step 7: Results: seed line and "new file"**

`Results` props: add `seed?: number | null; replayHref?: string; onNewSeed?: () => void;`. Under the existing action buttons render, when `seed != null`:

```tsx
      {seed != null && (
        <div className="result-seed">
          <span>seed {seed}</span>
          {replayHref && <a href={replayHref}>link to this file</a>}
          {onNewSeed && <button type="button" className="btn-ghost" onClick={onNewSeed}>new file</button>}
        </div>
      )}
```

CSS: `.result-seed { display: flex; gap: 14px; align-items: center; margin-top: 10px; font-family: var(--mono); font-size: 12px; color: var(--muted); }`. In `Practice`, pass `seed={v.seed} replayHref={v.seed != null ? seedHref(lesson.id, v.seed) : undefined} onNewSeed={v.seed != null ? newFile : undefined}`. Keyboard: in the finished-state key handler, `n` already means next; add `f` → `newFile()` when `v.seed != null`, and mention it in the results footer text if one exists.

- [ ] **Step 8: Run everything**

Run: `npx vitest run src/state/__tests__/seed.test.ts && npm test && npx tsc -b`
Expected: all pass, tsc clean.

- [ ] **Step 9: Visual check**

Start `npx vite --host 0.0.0.0`, then run a Playwright script via the cellgate-bridge image (pattern in `~/docker/landing/tests/shot.py`) that opens `http://10.10.10.68:5317/#challenge-fix-the-file?seed=5`, focuses `.editor`, replays the first two items' fixes (teleport is not available from the browser; use `gg` then the item's `line` + `G`, `0`, `col` × `l`, then the keys) and screenshots `.editor`. Confirm: checklist on the right with two ticks, editor still scrolls horizontally, inline hints present. Save the shot under the scratchpad, not the repo. Kill Vite by pid from `ss -ltnp | grep :5317`, never `pkill -f`.

- [ ] **Step 10: Commit**

```bash
git add src/components/Checklist.tsx src/state/seed.ts src/state/__tests__/seed.test.ts src/components/Practice.tsx src/components/Results.tsx src/components/LessonPage.tsx src/App.tsx src/styles.css src/lessons/sections/challenges.tsx
git commit -m "challenges: checklist panel, seed links, new-file action"
```

---

### Task 9: Docs and deploy

**Files:**
- Modify: `CURRICULUM.md` (challenge-types table + a `## Challenges` section before `## Decisions`), `docs/LESSONS.md` (a "Challenges" section: how to add a corpus file, how to add a mutation kind and what its tests must prove)
- Deploy: `docker/up.sh`

- [ ] **Step 1: CURRICULUM.md**

Add a row `| generated | fix a seeded, mutated corpus file; live checklist | live |` to the challenge-types table, and before `## Decisions`:

```markdown
## Challenges

Combined-skill sessions on a generated file (`src/challenges/`). Each names the sections it
draws on; none count toward completion. A run is `generate(challenge, seed)`; `#<id>?seed=N`
replays one.

| # | Lesson | Skills | Mutations |
|---|--------|--------|-----------|
| 1 | Fix the File | Getting Around, Small Edits, Next Steps, Motions, Search | dropped/extra/wrong char, wrong literal, wrong short identifier |
| 2 | Operators | + First Operators | + stray line, stray word, wrong word, missing near-duplicate line, line to remove |
| 3–5 | (planned) text objects & visual; rename & replace; registers & macros | | |
```

- [ ] **Step 2: docs/LESSONS.md**

Append:

```markdown
## Challenges

Generated challenges live in `src/challenges/`. Two things to extend:

- **Corpus** (`corpus/index.ts`): 25–40 lines, ≤ 60 columns, no tabs, ≥ 6 short identifiers used
  twice, ≥ 4 numbers, ≥ 2 strings, one adjacent near-duplicate pair. `corpus.test.ts` enforces it.
- **Mutation kinds** (`mutations/*.ts`): `sites()` lists candidates in the original; `apply()` returns
  the changed line(s), a checklist line, `fixAt` and motion-free `fixKeys`. `mutations.test.ts`
  replays `fixKeys` through the engine from `fixAt` and requires the original back, for every site of
  every corpus file. Register the kind in `mutations/index.ts` and list it in a challenge's
  `mutations` in `challenges/index.ts`.
```

- [ ] **Step 3: Full verification, commit, deploy**

Run: `npm test && npx tsc -b && npm run build`
Expected: all pass, build succeeds.

```bash
git add CURRICULUM.md docs/LESSONS.md
git commit -m "challenges: document the band and how to extend it"
./docker/up.sh
```

Then confirm `https://vimchi.nrsil.io/#challenge-fix-the-file` renders the Challenges band and a checklist, and `curl -s https://vimchi.nrsil.io/healthz` returns `{"ok":true}`.
