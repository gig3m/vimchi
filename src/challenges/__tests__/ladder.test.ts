// Challenges 3–5: every seeded run is solvable by its par keys, keeps its edits apart, draws its
// kinds fairly, types at most 6 characters in Insert mode per fix, and (Challenge 5 only) at most
// 24 characters on the command line.
import { describe, expect, it } from 'vitest';
import { createVim } from '../../lessons/runtime';
import { parseKeys } from '../../vim/keys';
import { type Generated, generate } from '../generate';
import { CHALLENGES } from '../index';
import { MAX_CMDLINE } from '../mutations/ex';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 104729 + 17);
const byId = (id: string) => CHALLENGES.find(c => c.id === id)!;

/** What a fix exercises, for the per-run means. */
const FAMILY: Record<string, 'operator' | 'object' | 'visual' | 'register' | 'macro' | 'ex'> = {
  'stray-line': 'operator', 'wrong-word': 'operator', 'line-to-remove': 'operator',
  'wrong-string-contents': 'object', 'wrong-args': 'object', 'wrong-inner-word': 'object', 'stray-word-aw': 'object', 'extra-block': 'object', 'block-indent': 'object',
  'commented-block': 'visual',
  'swapped-lines': 'register', 'moved-block': 'register', 'swapped-chars': 'register', 'swapped-words': 'register', 'duplicate-and-change': 'register',
  'line-run-transform': 'macro',
  'renamed-ident': 'ex', 'junk-lines': 'ex', 'mixed-tails': 'ex',
};
/** The family a fix actually used: a rename by `*` + `cgn` is a search edit, not an Ex one. */
const familyOf = (i: Generated['items'][number]) =>
  i.kind === 'line-run-transform' && !/@a/.test(i.fixKeys) ? 'operator'
  : FAMILY[i.kind] === 'ex' && !i.fixKeys.startsWith(':') ? 'operator'
  : FAMILY[i.kind];

/** Share of items per kind; with `draws`, a repeated group (`.` on 2–3 lines) counts once. */
function shares(runs: Generated[], draws = false): Map<string, number> {
  const n = new Map<string, number>();
  let total = 0;
  for (const g of runs) for (const i of g.items) {
    if (draws && i.group !== undefined && g.items.find(j => j.group === i.group) !== i) continue;
    n.set(i.kind, (n.get(i.kind) ?? 0) + 1); total++;
  }
  return new Map([...n].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v / total]));
}
const pct = (m: Map<string, number>) => Object.fromEntries([...m].map(([k, v]) => [k, +(v * 100).toFixed(1)]));
function means(runs: Generated[]) {
  const n: Record<string, number> = {};
  for (const g of runs) for (const i of g.items) n[familyOf(i)] = (n[familyOf(i)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, +(v / runs.length).toFixed(2)]));
}

/** Replays a run's par keys; returns keys, and the most Insert / command-line text any one fix typed. */
function replay(c: (typeof CHALLENGES)[number]['challenge'], g: Generated) {
  const vim = createVim({ text: g.start, name: g.file, plugins: c.plugins });
  let keys = 0, insert = 0, cmdline = 0;
  for (const item of g.items) {
    vim.win.cursor = { line: item.fixAt.line + vim.buf.lines.length - g.start.length, col: item.fixAt.col };
    let ins = 0, cmd = 0;
    for (const k of parseKeys(item.fixKeys)) {
      if (vim.mode === 'insert' && k !== '<Esc>') ins++;
      if (vim.mode === 'cmdline' && k !== '<CR>') cmd++;
      vim.feed(k);
    }
    insert = Math.max(insert, ins); cmdline = Math.max(cmdline, cmd);
    keys += parseKeys(item.fixKeys).length;
  }
  return { vim, keys, insert, cmdline };
}

describe.each([
  ['challenge-objects-visual', ['commented-block', 'swapped-lines', 'moved-block', 'block-indent', 'extra-block', 'wrong-string-contents', 'wrong-args', 'wrong-inner-word', 'stray-word-aw']],
  ['challenge-registers-macros', ['line-run-transform', 'swapped-chars', 'swapped-words', 'duplicate-and-change', 'swapped-lines', 'moved-block']],
  ['challenge-rename-replace', ['renamed-ident', 'junk-lines', 'mixed-tails']],
] as const)('%s', (id, core) => {
  const def = byId(id);
  const c = def.challenge;
  const runs = SEEDS.map(s => generate(c, s));
  const sh = shares(runs);
  const drawn = shares(runs, true);
  const ex = id === 'challenge-rename-replace';

  it('reports its kind shares and mean edits per run by family', () => {
    console.log(`${id} kind shares (items):`, pct(sh), '(draws):', pct(drawn), 'per run:', means(runs), `edits ${Math.min(...runs.map(g => g.items.length))}–${Math.max(...runs.map(g => g.items.length))}`);
  });
  it('is deterministic', () => {
    expect(generate(c, 123)).toEqual(generate(c, 123));
    expect(generate(c, 123).start).not.toEqual(generate(c, 124).start);
  });
  it('stays in its edit range with a one-line gap between items', () => {
    for (const g of runs) {
      expect(g.items.length, `seed ${g.seed}`).toBeGreaterThanOrEqual(c.edits[0]);
      expect(g.items.length).toBeLessThanOrEqual(c.edits[1]);
      const r = g.items.map(i => i.goal).sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < r.length; i++) expect(r[i][0] - r[i - 1][1], `seed ${g.seed}`).toBeGreaterThanOrEqual(2);
    }
  });
  it('draws every kind; its own kinds make up at least half the draws; no kind above 30% of items', () => {
    for (const k of c.mutations) expect(sh.get(k) ?? 0, k).toBeGreaterThan(0);
    for (const [k, v] of sh) expect(v, k).toBeLessThanOrEqual(0.3);
    const own = core.reduce((a, k) => a + (drawn.get(k) ?? 0), 0);
    expect(own).toBeGreaterThanOrEqual(0.5);
  });
  it('is solved by its par keys on every seed, within the typing budget', () => {
    for (const g of runs) {
      const { vim, keys, insert, cmdline } = replay(c, g);
      expect(vim.mode, `seed ${g.seed}`).toBe('normal');
      expect(vim.buf.lines, `seed ${g.seed} ${g.file}`).toEqual(g.goal);
      expect(keys).toBeLessThanOrEqual(g.parKeys);
      expect(insert, `seed ${g.seed}`).toBeLessThanOrEqual(6);
      expect(cmdline, `seed ${g.seed}`).toBeLessThanOrEqual(ex ? MAX_CMDLINE : 0);
    }
  });
  it('never turns a multi-change fix into .', () => {
    const single = new Set(['wrong-string-contents', 'wrong-args', 'wrong-inner-word', 'stray-word-aw', 'extra-block', 'block-indent', 'stray-line', 'wrong-word', 'line-to-remove']);
    for (const g of runs) for (const i of g.items) if (i.fixKeys === '.') expect(single.has(i.kind), i.kind).toBe(true);
  });
});

describe('challenge-registers-macros: macros', () => {
  const c = byId('challenge-registers-macros').challenge;
  const runs = SEEDS.map(s => generate(c, s));
  const items = runs.flatMap(g => g.items.filter(i => i.kind === 'line-run-transform'));
  it('records a macro when it beats the plain route, and replays it for a second run of the same edit', () => {
    const recorded = items.filter(i => i.fixKeys.startsWith('qa'));
    const reused = items.filter(i => /^\d+@a$/.test(i.fixKeys));
    const plain = items.filter(i => !/@a/.test(i.fixKeys));
    console.log(`line-run-transform: ${recorded.length} recorded, ${reused.length} replayed from the register, ${plain.length} plain (dw +.)`);
    expect(recorded.length).toBeGreaterThan(plain.length);
    expect(reused.length).toBeGreaterThan(0);
    expect(plain.length).toBeGreaterThan(0);
    // A recorded macro is always shorter than doing each line by hand: two changes and a motion per line.
    for (const i of recorded) {
      const n = Number(/(\d+)@a$/.exec(i.fixKeys)![1]) + 1;
      const perLine = parseKeys(i.fixKeys.slice(2, i.fixKeys.indexOf('q', 2))).length;
      expect(parseKeys(i.fixKeys).length).toBeLessThan(perLine * n - 1);
    }
  });
  it('runs with a macro in most runs', () => {
    expect(runs.filter(g => g.items.some(i => /@a/.test(i.fixKeys))).length / runs.length).toBeGreaterThanOrEqual(0.5);
  });
});

describe('challenge-rename-replace: routes', () => {
  const c = byId('challenge-rename-replace').challenge;
  const runs = SEEDS.map(s => generate(c, s));
  const items = runs.flatMap(g => g.items);
  it('uses both the cgn route and :%s for renames, and :g / :%s for the pattern kinds', () => {
    const ren = items.filter(i => i.kind === 'renamed-ident');
    const cgn = ren.filter(i => i.fixKeys.startsWith('*cgn')).length, sub = ren.filter(i => i.fixKeys.startsWith(':%s')).length;
    const g = items.filter(i => i.kind === 'junk-lines'), t = items.filter(i => i.kind === 'mixed-tails');
    console.log(`renamed-ident: ${cgn} *cgn, ${sub} :%s; junk-lines: ${g.filter(i => i.fixKeys.startsWith(':g')).length}/${g.length} :g; mixed-tails: ${t.filter(i => i.fixKeys.startsWith(':%s')).length}/${t.length} :%s`);
    expect(cgn).toBeGreaterThan(0);
    expect(sub).toBeGreaterThan(0);
    expect(g.filter(i => i.fixKeys.startsWith(':g')).length / g.length).toBeGreaterThanOrEqual(0.5);
    expect(t.filter(i => i.fixKeys.startsWith(':%s')).length / t.length).toBeGreaterThanOrEqual(0.5);
  });
  it('averages at least 3 rename / pattern edits per run, at least 1.5 of them by Ex command', () => {
    expect(items.filter(i => FAMILY[i.kind] === 'ex').length / runs.length).toBeGreaterThanOrEqual(3);
    expect(items.filter(i => i.fixKeys.startsWith(':')).length / runs.length).toBeGreaterThanOrEqual(1.5);
  });
});
