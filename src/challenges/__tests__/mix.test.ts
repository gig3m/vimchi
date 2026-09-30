// The mix of a generated run: kinds drawn fairly, operator edits actually present in the
// Operators challenge, and repeated edits so `.` earns its chip.
import { describe, expect, it } from 'vitest';
import { createVim } from '../../lessons/runtime';
import { parseKeys } from '../../vim/keys';
import { type Generated, generate } from '../generate';
import { CHALLENGES } from '../index';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 104729 + 17);
const OPERATOR_KINDS = new Set(['stray-line', 'stray-word', 'wrong-word', 'missing-duplicate-line', 'line-to-remove']);
const fix = CHALLENGES.find(c => c.id === 'challenge-fix-the-file')!.challenge;
const ops = CHALLENGES.find(c => c.id === 'challenge-operators')!.challenge;

/** Share of items per kind; with `draws`, a repeated group counts once (one draw of its kind). */
function shares(runs: Generated[], draws = false): Map<string, number> {
  const count = new Map<string, number>();
  let total = 0;
  for (const g of runs) for (const i of g.items) {
    if (draws && i.group !== undefined && g.items.find(j => j.group === i.group) !== i) continue;
    count.set(i.kind, (count.get(i.kind) ?? 0) + 1); total++;
  }
  return new Map([...count].map(([k, n]) => [k, n / total]));
}

describe('challenge-operators mix', () => {
  const runs = SEEDS.map(s => generate(ops, s));
  const sh = shares(runs);
  const drawn = shares(runs, true);
  it('reports its kind shares', () => {
    const pct = (m: Map<string, number>) => Object.fromEntries([...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v * 100).toFixed(1)]));
    console.log('operators kind shares (items):', pct(sh), '(draws):', pct(drawn));
  });
  it('honours the spec edit range of 10–14', () => {
    expect(ops.edits).toEqual([10, 14]);
    for (const g of runs) { expect(g.items.length).toBeGreaterThanOrEqual(10); expect(g.items.length).toBeLessThanOrEqual(14); }
  });
  it('draws kinds fairly: no kind above 20%, every kind drawn, operator kinds at least 40%', () => {
    for (const k of ops.mutations) expect(sh.get(k) ?? 0, k).toBeGreaterThan(0);
    for (const [k, v] of sh) expect(v, k).toBeLessThanOrEqual(0.2);
    const op = [...sh].filter(([k]) => OPERATOR_KINDS.has(k)).reduce((a, [, v]) => a + v, 0);
    expect(op).toBeGreaterThanOrEqual(0.4);
  });
  it('draws the kinds with plenty of sites within 4 points of an even share', () => {
    // A repeated group is one draw of its kind; the kinds with few sites run dry and their
    // share falls to the rest.
    const even = 1 / ops.mutations.length;
    for (const k of ['dropped-char', 'extra-char', 'wrong-char', 'wrong-short-ident', 'stray-line', 'stray-word', 'wrong-word'])
      expect(Math.abs((drawn.get(k) ?? 0) - even), k).toBeLessThanOrEqual(0.04);
  });
  it('averages at least 4 operator edits per run', () => {
    const per = runs.map(g => g.items.filter(i => OPERATOR_KINDS.has(i.kind)).length);
    expect(per.reduce((a, b) => a + b, 0) / runs.length).toBeGreaterThanOrEqual(4);
  });
  it('repeats an edit in most runs, and the par repeats it with .', () => {
    const withGroup = runs.filter(g => g.items.some(i => i.group !== undefined));
    expect(withGroup.length / runs.length).toBeGreaterThanOrEqual(0.5);
    for (const g of withGroup) {
      const groups = new Map<number, typeof g.items>();
      for (const i of g.items) if (i.group !== undefined) groups.set(i.group, [...(groups.get(i.group) ?? []), i]);
      for (const members of groups.values()) {
        expect(members.length).toBeGreaterThanOrEqual(2);
        expect(members.length).toBeLessThanOrEqual(3);
        expect(new Set(members.map(m => m.kind)).size).toBe(1);
        expect(new Set(members.map(m => m.text)).size).toBe(1);
        // the members are consecutive in the checklist, so the par can chain them with `.`
        const idx = members.map(m => g.items.indexOf(m));
        expect(idx[idx.length - 1] - idx[0]).toBe(members.length - 1);
        for (const m of members.slice(1)) expect(m.fixKeys).toBe('.');
      }
    }
  });
  it('covers every repeatable kind', () => {
    const kinds = new Set(runs.flatMap(g => g.items.filter(i => i.group !== undefined).map(i => i.kind)));
    expect([...kinds].sort()).toEqual(['stray-line', 'stray-word', 'wrong-word']);
  });
  it.each(SEEDS)('seed %d: the par keys solve the file', seed => {
    const g = generate(ops, seed);
    const vim = createVim({ text: g.start, name: g.file });
    let keys = 0, shift = 0;
    for (const item of g.items) {
      vim.win.cursor = { line: item.fixAt.line + shift, col: item.fixAt.col };
      vim.feedKeys(item.fixKeys);
      keys += parseKeys(item.fixKeys).length;
      shift += item.kind === 'stray-line' || item.kind === 'line-to-remove' ? -1 : item.kind === 'missing-duplicate-line' ? 1 : 0;
    }
    expect(vim.mode).toBe('normal');
    expect(vim.buf.lines).toEqual(g.goal);
    expect(keys).toBeLessThanOrEqual(g.parKeys);
  });
});

describe('challenge-fix-the-file mix', () => {
  const runs = SEEDS.map(s => generate(fix, s));
  const sh = shares(runs);
  it('reports its kind shares', () => {
    console.log('fix-the-file kind shares:', Object.fromEntries([...sh].map(([k, v]) => [k, +(v * 100).toFixed(1)])));
  });
  it('draws its five kinds evenly (within 5 points of 20%)', () => {
    for (const k of fix.mutations) expect(Math.abs((sh.get(k) ?? 0) - 0.2), k).toBeLessThanOrEqual(0.05);
  });
  it('never repeats an edit: . is not among its skills', () => {
    for (const g of runs) for (const i of g.items) { expect(i.group).toBeUndefined(); expect(i.fixKeys).not.toBe('.'); }
  });
});
