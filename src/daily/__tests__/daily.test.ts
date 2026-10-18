import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../../challenges';
import { type Generated, generate } from '../../challenges/generate';
import { Session } from '../../lessons/runtime';
import { LESSONS } from '../../lessons';
import { routeFromHash } from '../../state/seed';
import { parseKeys } from '../../vim/keys';
import { GREEN, RED, YELLOW, daily, dailyGrid, dailyNumber, firstRun, isDailyRun, loadGrid, saveGrid, shareText } from '../index';

describe('daily', () => {
  it('numbers local calendar days from launch', () => {
    expect(dailyNumber(new Date(2026, 9, 17, 0, 5).getTime())).toBe(1);
    expect(dailyNumber(new Date(2026, 9, 17, 23, 55).getTime())).toBe(1);
    expect(dailyNumber(new Date(2026, 9, 18, 0, 5).getTime())).toBe(2);
    expect(dailyNumber(new Date(2026, 10, 17, 12).getTime())).toBe(32);
  });
  it('is the same file for everyone on a day and rotates the ladder', () => {
    expect(daily(7).generated).toEqual(generate(daily(7).rung.challenge, daily(7).seed));
    expect(new Set([1, 2, 3, 4, 5].map(n => daily(n).rung.id)).size).toBe(CHALLENGES.length);
    expect(daily(1).seed).not.toBe(daily(2).seed);
  });
  it('fills its rung\'s minimum on the first 60 days', () => {
    for (let n = 1; n <= 60; n++) {
      const d = daily(n);
      expect(d.generated.items.length, `#${n}`).toBeGreaterThanOrEqual(d.rung.challenge.edits[0]);
    }
  });
  it('run ids never collide with lessons and the route resolves', () => {
    expect(isDailyRun(daily(3).id)).toBe(true);
    expect(LESSONS[daily(3).id]).toBeUndefined();
    expect(routeFromHash('#daily', () => false).view).toBe('daily');
  });
  it('a par replay settles each item on its last fix key and grades all green', () => {
    for (let n = 1; n <= 15; n++) {
      const d = daily(n);
      const s = new Session(d.rung.challenge, { seed: d.seed });
      const g = s.generated!;
      let t = 0;
      for (const [i, item] of g.items.entries()) {
        s.vim!.win.cursor = { line: item.fixAt.line + s.vim!.buf.lines.length - g.start.length, col: item.fixAt.col };
        for (const k of parseKeys(item.fixKeys)) s.key(k, ++t);
        expect(s.ticks[i], `#${n} item ${i} ${item.fixKeys}`).toBe(t);
      }
      expect(s.done, `#${n}`).toBe(true);
      expect(dailyGrid(g, s.ticks, s.keys), `#${n}`).toBe(GREEN.repeat(g.items.length));
    }
  });
  // Two one-key fixes two lines apart: either order is 1 key, then 2 motion keys + 1.
  const tiny = {
    start: ['aaaa', 'bbbb', 'cccc'],
    items: [{ fixAt: { line: 0, col: 0 }, fixKeys: 'x' }, { fixAt: { line: 2, col: 0 }, fixKeys: 'x' }] as Generated['items'],
  };
  it('grades each item against the trip actually taken', () => {
    expect(dailyGrid(tiny, [1, 4], 4)).toBe(GREEN + GREEN);
    // out of checklist order: 3 keys to the far item, 3 back
    expect(dailyGrid(tiny, [6, 3], 6)).toBe(GREEN + GREEN);
    // 5 keys against par 3 is near (<= 1.5x + 1), 7 is not
    expect(dailyGrid(tiny, [1, 6], 6)).toBe(GREEN + YELLOW);
    expect(dailyGrid(tiny, [1, 8], 8)).toBe(GREEN + RED);
  });
  it('charges keys after the last finish to the last group, and shares one key\'s span', () => {
    expect(dailyGrid(tiny, [1, 4], 7)).toBe(GREEN + YELLOW);
    const ex = { ...tiny, items: tiny.items.map(i => ({ ...i, fixKeys: ':%s/a/b/<CR>', anywhere: true })) };
    expect(dailyGrid(ex, [10, 10], 10)).toBe(GREEN + GREEN);
  });
  it('gives the . discount only right after the edit it repeats', () => {
    const items = [
      { fixAt: { line: 0, col: 0 }, fixKeys: 'ciwfoo<Esc>' },
      { fixAt: { line: 0, col: 0 }, fixKeys: '.', soloKeys: 'ciwfoo<Esc>' },
    ] as Generated['items'];
    const g = { start: ['aaaa'], items };
    // in order: 7 keys then 1
    expect(dailyGrid(g, [7, 8], 8)).toBe(GREEN + GREEN);
    // the . item first: it has nothing to repeat, so its par is the full 7
    expect(dailyGrid(g, [14, 7], 14)).toBe(GREEN + GREEN);
  });
  it('gives the @a discount while register a holds that macro, whatever its count', () => {
    const rec = { fixAt: { line: 0, col: 0 }, fixKeys: 'qaxjq2@a', macro: 'xj' };
    const run = { fixAt: { line: 0, col: 0 }, fixKeys: '4@a', soloKeys: 'qaxjq3@a', macro: 'xj' };
    const other = { fixAt: { line: 0, col: 0 }, fixKeys: 'qaddq', macro: 'dd' };
    const g = (items: object[]) => ({ start: ['aaaa'], items: items as Generated['items'] });
    expect(dailyGrid(g([rec, run]), [8, 11], 11)).toBe(GREEN + GREEN);
    // par for the replay is 3 keys: 7 is past near
    expect(dailyGrid(g([rec, run]), [8, 15], 15)).toBe(GREEN + RED);
    // another macro overwrote register a: the replay pays for recording again (8 keys), so 7 is under par
    expect(dailyGrid(g([rec, other, run]), [8, 13, 20], 20)).toBe(GREEN + GREEN + GREEN);
  });
  it('settles an Insert-mode fix on its Esc and clears a tick on undo', () => {
    const d = daily(1);
    const s = new Session(d.rung.challenge, { seed: d.seed });
    const g = s.generated!;
    const i = g.items.findIndex(it => it.fixKeys.endsWith('<Esc>'));
    expect(i, 'daily #1 has an Insert-mode fix').toBeGreaterThanOrEqual(0);
    s.vim!.win.cursor = { ...g.items[i].fixAt };
    const keys = parseKeys(g.items[i].fixKeys);
    keys.forEach((k, j) => {
      s.key(k, j + 1);
      expect(s.ticks[i] ?? 0).toBe(j === keys.length - 1 ? keys.length : 0);
    });
    s.key('u', 99);
    expect(s.ticks[i]).toBe(0);
  });
  it('keeps a grid only for the run that made it', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    saveGrid(9, 1000, GREEN);
    expect(loadGrid(9, 1000)).toBe(GREEN);
    expect(loadGrid(9, 999)).toBeNull();
    expect(loadGrid(8, 1000)).toBeNull();
  });
  it('shares the first run', () => {
    const run = (at: number, keys: number) => ({ lesson: 'daily-1', at, time: 72_400, keys, speed: 1, acc: 1, correct: 1, score: 90 });
    const first = firstRun([run(20, 30), run(10, 50)])!;
    expect(first.keys).toBe(50);
    const text = shareText(daily(1), first, GREEN.repeat(3));
    expect(text.split('\n')).toEqual([
      `vimchi daily #1 · ${daily(1).rung.title}`,
      `50 keys (par ${daily(1).generated.parKeys}) · 1:12.4`,
      GREEN.repeat(3),
      'https://vimchi.dev/#daily',
    ]);
  });
});
