import { describe, expect, it } from 'vitest';
import { LESSONS } from '../../lessons';
import type { Run } from '../../state/store';
import { editsFor, todaysWarmUp, warmUpSub } from '../index';
import { DAY, REPS_LESSONS, WARMUP_ID } from '../select';

const NOW = new Date(2026, 8, 30, 15).getTime();
const run = (lesson: string, daysAgo: number): Run =>
  ({ lesson, at: NOW - daysAgo * DAY, time: 1, keys: 1, speed: 0.5, acc: 0.5, correct: 1, score: 50 });

describe('today\'s warm-up', () => {
  it('does not collide with a lesson id', () => {
    expect(LESSONS[WARMUP_ID]).toBeUndefined();
  });
  it('is the same through the day (its rng is seeded by the date)', () => {
    const runs = REPS_LESSONS.map((l, i) => run(l.id, [1, 3, 7, 21][i % 4]));
    const ids = (t: number) => todaysWarmUp(runs, t).picks.map(p => p.lesson.id).join();
    const morning = new Date(2026, 8, 30, 13).getTime(), evening = new Date(2026, 8, 30, 17, 30).getTime();
    expect(ids(morning)).toBe(ids(evening));
    expect(todaysWarmUp(runs, NOW).picks.map(p => p.seed)).toEqual(todaysWarmUp(runs, NOW + 60_000).picks.map(p => p.seed));
  });
  it('sizes the run at 8–10 edits', () => {
    expect(editsFor(1)).toBe(8);
    expect(editsFor(9)).toBe(9);
    expect(editsFor(14)).toBe(10);
  });
  it('says what is due in the sidebar', () => {
    expect(warmUpSub(todaysWarmUp([], NOW))).toBe('nothing due yet');
    const three = todaysWarmUp([run(REPS_LESSONS[0].id, 1), run(REPS_LESSONS[1].id, 3), run(REPS_LESSONS[2].id, 7)], NOW);
    expect(warmUpSub(three)).toBe('8 items · 3 lessons due');
    expect(warmUpSub(todaysWarmUp([run(REPS_LESSONS[0].id, 1)], NOW))).toBe('8 items · 1 lesson due');
    expect(warmUpSub(todaysWarmUp([run(REPS_LESSONS[0].id, 0.1)], NOW))).toBe('8 items · recent lessons');
  });
});
