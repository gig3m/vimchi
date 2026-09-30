import { describe, expect, it } from 'vitest';
import { createVim } from '../../lessons/runtime';
import { parseKeys } from '../../vim/keys';
import { type ChecklistItem, collateral, generate, itemDone } from '../generate';
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
    for (const i of g.items) expect(itemDone(i, g.start, g.goal), i.text).toBe(false);
    expect(collateral(g.items, g.start, g.goal)).toBe(0);
  });
  it.each(seeds.slice(0, 40))('seed %d: replaying every fix in order reaches the goal with par keys', seed => {
    const g = generate(c, seed);
    const vim = createVim({ text: g.start, name: g.file, plugins: c.plugins });
    let keys = 0;
    for (const item of g.items) {
      // Earlier fixes (all above this one) moved later start-text lines by the change in length.
      vim.win.cursor = { line: item.fixAt.line + vim.buf.lines.length - g.start.length, col: item.fixAt.col };
      vim.feedKeys(item.fixKeys);
      keys += parseKeys(item.fixKeys).length;
      expect(itemDone(item, vim.buf.lines, g.goal), `${item.kind}: ${item.text}`).toBe(true);
    }
    expect(vim.buf.lines).toEqual(g.goal);
    expect(keys).toBeLessThanOrEqual(g.parKeys);
    expect(collateral(g.items, vim.buf.lines, g.goal)).toBe(0);
  });
  it('every corpus file supports the edit range', () => {
    for (const f of c.corpus) {
      const single = { ...c, corpus: [f] };
      const short = seeds.slice(0, 30).filter(s => generate(single, s).items.length < c.edits[0]);
      expect(short, f.name).toEqual([]);
    }
  });
});

describe('itemDone / collateral', () => {
  const goal = ['a', 'b', 'c', 'd', 'e'];
  const item: ChecklistItem = { kind: 'wrong-char', text: 't', goal: [2, 2], fixAt: { line: 2, col: 0 }, fixKeys: 'rc' };
  it('is done only when the window is exactly aligned', () => {
    expect(itemDone(item, ['a', 'b', 'x', 'd', 'e'], goal)).toBe(false);
    expect(itemDone(item, goal, goal)).toBe(true);
    expect(itemDone(item, ['a', 'b', 'c', 'junk', 'd', 'e'], goal)).toBe(false); // junk inside the window
    expect(itemDone(item, ['a', 'b', 'c', 'd', 'e', 'junk'], goal)).toBe(true);  // junk outside
  });
  it('counts damage outside item windows', () => {
    expect(collateral([item], ['a', 'b', 'x', 'd', 'e'], goal)).toBe(0);
    expect(collateral([item], ['zz', 'b', 'x', 'd', 'e'], goal)).toBe(1);
    expect(collateral([item], ['b', 'x', 'd'], goal)).toBe(2); // 'a' and 'e' each lost: two separate runs
  });
  it('charges damage on a neighbouring line even though it is inside the tick window', () => {
    expect(collateral([item], ['a', 'y', 'x', 'd', 'e'], goal)).toBe(1); // 'b' is not the item's line
    expect(collateral([item], ['a', 'b', 'c', 'junk', 'd', 'e'], goal)).toBe(0); // insertion bounded by the item's own line
    expect(collateral([item], ['a', 'junk', 'b', 'c', 'd', 'e'], goal)).toBe(1); // insertion between a and b
  });
});
