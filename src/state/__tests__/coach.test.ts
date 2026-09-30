import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Critique, Report } from '../../coach';
import {
  type CoachEvent, type CoachProfile, type CoachRun, GUEST_KEY, calloutPrefix, callouts, coachEvents, emptyProfile, getCoachProfile,
  loadCoach, loadGuestProfile, mixShare, normalizeProfile, recordCoachRun, recurrence, resetCoach, retired, stepProfile, topRecurring, usedBucket,
} from '../coach';
import { api } from '../api';

const mem = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0,
} as Storage;

const ev = (pattern: string, at = 1): CoachEvent => ({ pattern, lesson: 'words', unit: 0, you: 8, better: 2, used: 'key-run', at });
const run = (at: number, ...patterns: string[]): CoachRun => ({ lesson: 'words', at, mix: { moving: 6, typing: 2, editing: 2 }, events: patterns.map(p => ev(p, at)) });
const fold = (...runs: CoachRun[]) => runs.reduce(stepProfile, emptyProfile());

const critique = (you: Critique['youChips'], rule = 'idiom', pattern = 'op-to-char', saves = 5): Critique => ({
  unit: 1, you: you.map(c => c.v).join(''), youChips: you, keys: 9, logStart: 0, logEnd: 8,
  better: [{ keys: 'dt)', saves, why: '', rule, uses: ['d', 't'], pattern, chips: [{ kind: 'key', v: 'd' }] }],
});
const K = (v: string) => ({ kind: 'key' as const, v });
const T = (v: string) => ({ kind: 'text' as const, v });
const report = (critiques: Critique[]): Report => ({ critiques, reference: [], summary: { keys: 30, moving: 12, typing: 8, editing: 10, par: 20 } });

describe('stepProfile', () => {
  it('counts sightings, runs, fixed streaks and the first lesson', () => {
    const p = fold(
      { ...run(1), lesson: 'delete-to-char', events: [ev('op-to-char'), ev('op-to-char')].map(e => ({ ...e, lesson: 'delete-to-char' })) },
      run(2, 'find-char'), run(3, 'op-to-char'), run(4), { ...run(5, 'find-char'), mix: undefined }, run(6),
    );
    expect(p.patterns['op-to-char']).toEqual({ seen: 3, runs: 2, lastSeen: 3, fixedStreak: 3, firstSeenLesson: 'delete-to-char' });
    expect(p.patterns['find-char']).toEqual({ seen: 2, runs: 2, lastSeen: 5, fixedStreak: 1, firstSeenLesson: 'words' });
    expect(p.keyMix.map(m => m.at)).toEqual([1, 2, 3, 4, 6]);
    expect(p.recent.map(r => r.at)).toEqual([2, 3, 4, 5, 6]);
    expect(p.recent[3].patterns).toEqual(['find-char']);
  });
  it('keeps the key mix to the last 20 runs and does not change its input', () => {
    const before = fold(run(0, 'dot'));
    const snapshot = JSON.stringify(before);
    stepProfile(before, run(1));
    expect(JSON.stringify(before)).toBe(snapshot);
    const many = fold(...Array.from({ length: 30 }, (_, i) => run(i)));
    expect(many.keyMix).toHaveLength(20);
    expect(many.keyMix[0].at).toBe(10);
  });
});

describe('recurrence callouts', () => {
  it('says "3rd run in a row" when the last two runs had it too', () => {
    const p = fold(run(1), run(2), run(3), run(4, 'op-to-char'), run(5, 'op-to-char'));
    expect(recurrence(p, 'op-to-char')).toEqual({ inRow: 3, inLast: 3 });
    expect(calloutPrefix(p, 'op-to-char')).toBe('3rd run in a row:');
  });
  it('counts on past three (4th, 11th never "11st")', () => {
    const p = fold(run(1, 'x'), run(2, 'x'), run(3, 'x'), run(4, 'x'), run(5, 'x'));
    expect(calloutPrefix(p, 'x')).toBe('5th run in a row:');
    expect(calloutPrefix(fold(run(1), run(2, 'x'), run(3, 'x'), run(4, 'x')), 'x')).toBe('4th run in a row:');
  });
  it('names the count when the runs were not consecutive', () => {
    const p = fold(run(1, 'x'), run(2), run(3, 'x'), run(4), run(5));
    expect(calloutPrefix(p, 'x')).toBeNull(); // run 1 is outside the last five with this one
    const q = fold(run(1), run(2, 'x'), run(3), run(4, 'x'), run(5));
    expect(calloutPrefix(q, 'x')).toBe('3 of your last 5 runs:');
  });
  it('stays quiet below three', () => {
    expect(calloutPrefix(fold(run(1, 'x')), 'x')).toBeNull();
    expect(calloutPrefix(emptyProfile(), 'x')).toBeNull();
  });
  it('maps a report to callouts per pattern', () => {
    const p = fold(run(1, 'dot'), run(2, 'dot'));
    expect(callouts(p, [ev('dot'), ev('find-char')])).toEqual({ dot: '3rd run in a row:' });
  });
});

describe('retirement', () => {
  it('retires a live hint after five clean coached runs, and brings it back when it recurs', () => {
    let p = fold(run(1, 'dot'), run(2), run(3), run(4), run(5));
    expect(retired(p, 'dot')).toBe(false);
    p = stepProfile(p, run(6));
    expect(retired(p, 'dot')).toBe(true);
    expect(topRecurring(p)).toEqual([]);
    p = stepProfile(p, run(7, 'dot'));
    expect(retired(p, 'dot')).toBe(false);
  });
});

describe('profile page helpers', () => {
  it('ranks recurring patterns by runs, then sightings', () => {
    const p = fold(run(1, 'a', 'b'), run(2, 'a', 'c', 'c', 'c'), run(3, 'a', 'b'), run(4, 'd'));
    expect(topRecurring(p).map(s => s.id)).toEqual(['a', 'b', 'c']);
  });
  it('shares the key mix over the window', () => {
    expect(mixShare(emptyProfile())).toBeNull();
    const m = mixShare(fold(run(1), run(2)))!;
    expect(m.runs).toBe(2);
    expect(m.moving).toBeCloseTo(0.6);
    expect(m.moving + m.typing + m.editing).toBeCloseTo(1);
  });
});

describe('events from a report', () => {
  it('buckets what the learner did', () => {
    expect(usedBucket(critique([K('x'), K('x'), K('x'), K('x')]))).toBe('key-run');
    expect(usedBucket(critique([K('c'), K('w'), T('foo'), K('<Esc>')]))).toBe('retype');
    expect(usedBucket(critique([K('j'), K('w'), K('e')], 'motion', 'find-char'))).toBe('motions');
    expect(usedBucket(critique([K('d'), K('w'), K('d'), K('w')]))).toBe('commands');
  });
  it('caps a run at ten events, one per critique', () => {
    const r = report(Array.from({ length: 14 }, () => critique([K('x'), K('x'), K('x')])));
    const es = coachEvents(r, 'delete-to-char', 1234);
    expect(es).toHaveLength(10);
    expect(es[0]).toEqual({ pattern: 'op-to-char', lesson: 'delete-to-char', unit: 1, you: 9, better: 4, used: 'key-run', at: 1234 });
  });
  it('privacy: an event carries patterns and counts only, never keys or buffer text', () => {
    const secret = 'hunter2-secret-text';
    const c = critique([K('c'), K('i'), K('w'), T(secret), K('<Esc>'), K('l'), K('l'), K('l')]);
    c.you = `ciw${secret}<Esc>lll`;
    c.better[0].keys = `ciw${secret}<Esc>`;
    c.better[0].chips = [K('c'), K('i'), K('w'), T(secret)];
    c.better[0].why = secret;
    const [e] = coachEvents(report([c]), 'word-objects', 99);
    expect(Object.keys(e).sort()).toEqual(['at', 'better', 'lesson', 'pattern', 'unit', 'used', 'you']);
    for (const k of ['at', 'better', 'unit', 'you'] as const) expect(typeof e[k]).toBe('number');
    expect(e.pattern).toMatch(/^[a-z-]{1,32}$/);
    expect(['key-run', 'retype', 'motions', 'commands']).toContain(e.used);
    const wire = JSON.stringify(e);
    expect(wire).not.toContain(secret);
    expect(wire).not.toContain('ciw');
    expect(wire).not.toContain('<Esc>');
    expect(wire).not.toContain('lll');
  });
});

describe('guest storage and the live profile', () => {
  beforeEach(() => { mem.clear(); resetCoach(); vi.restoreAllMocks(); });
  const flush = () => new Promise(r => setTimeout(r, 0));

  it('guests keep the profile in localStorage, in the server shape', async () => {
    vi.spyOn(api, 'coachProfile').mockRejectedValue(new Error('401'));
    loadCoach();
    recordCoachRun(run(1, 'dot')); // finished before the load answered: kept, folded in once known
    await flush();
    recordCoachRun(run(2, 'dot'));
    const stored = JSON.parse(mem.get(GUEST_KEY)!) as CoachProfile;
    expect(Object.keys(stored).sort()).toEqual(['keyMix', 'patterns', 'recent']);
    expect(stored.patterns.dot).toMatchObject({ seen: 2, runs: 2, fixedStreak: 0 });
    expect(loadGuestProfile()).toEqual(getCoachProfile());
  });
  it('accounts read the server profile and never write the guest mirror', async () => {
    vi.spyOn(api, 'coachProfile').mockResolvedValue(fold(run(1, 'dot'), run(2, 'dot')));
    loadCoach();
    await flush();
    recordCoachRun(run(3, 'dot'));
    expect(getCoachProfile().patterns.dot.seen).toBe(3);
    expect(mem.has(GUEST_KEY)).toBe(false);
  });
  it('drops malformed stored data', () => {
    expect(normalizeProfile({ patterns: { 'BAD ID': {}, ok: { seen: -1, runs: 'x' } }, keyMix: 'no', recent: [null, { at: 1, patterns: [2, 'dot'] }] }))
      .toEqual({ patterns: { ok: { seen: 0, runs: 0, lastSeen: 0, fixedStreak: 0, firstSeenLesson: '' } }, keyMix: [], recent: [{ at: 1, patterns: ['dot'] }] });
    mem.set(GUEST_KEY, '{not json');
    expect(loadGuestProfile()).toEqual(emptyProfile());
  });
});
