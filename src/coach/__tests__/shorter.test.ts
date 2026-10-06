import { describe, expect, it } from 'vitest';
import { createVim, Session } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { segment } from '../segment';
import { shorterEdit, shorterSegment } from '../shorter';
import { taughtBy } from '../vocab';

const taught = taughtBy('repeat-last-change');

describe('shorterEdit', () => {
  it('f)lD on the last character was $x', () => {
    const v = createVim({ text: ['run(a);', 'next();'], name: 'a.ts' });
    expect(shorterEdit(v, 'run(a)\nnext();', 4, taught)).toMatchObject({ keys: '$x', length: 2 });
  });
  it('a line below: jf;lD was j$x', () => {
    const v = createVim({ text: ['a b c', 'run(a);', 'next();'], name: 'a.ts' });
    expect(shorterEdit(v, 'a b c\nrun(a)\nnext();', 5, taught)?.keys).toBe('j$x');
  });
  it('nothing when the saving is under two keys', () => {
    const v = createVim({ text: ['run(a);', 'next();'], name: 'a.ts' });
    expect(shorterEdit(v, 'run(a)\nnext();', 3, taught)).toBeNull();
  });
  it('only keys the learner has been taught', () => {
    const v = createVim({ text: ['run(a);', 'next();'], name: 'a.ts' });
    expect(shorterEdit(v, 'run(a)\nnext();', 4, new Set(['f', 'l', 'D', 'x']))).toBeNull();
  });
});

describe('shorterEdit: typed text, visual, two motions', () => {
  it('xxxiuser<Esc> on usr was cwuser<Esc>', () => {
    const v = createVim({ text: ['let usr = 1;', 'x'], name: 'a.ts' });
    v.feedKeys('w');
    expect(shorterEdit(v, 'let user = 1;\nx', 10, taught)?.keys).toBe('cwuser<Esc>');
  });
  it('$a;<Esc> after wandering was A;<Esc>', () => {
    const v = createVim({ text: ['run(a)', 'x'], name: 'a.ts' });
    expect(shorterEdit(v, 'run(a);\nx', 8, taught)?.keys).toBe('A;<Esc>');
  });
  it('a new line typed after jjjj$ was o on the line', () => {
    const v = createVim({ text: ['a', 'b', 'c', 'd'], name: 'a.ts' });
    expect(shorterEdit(v, 'a\nb\nc\nd\ne', 10, taught)?.keys).toBe('Goe<Esc>');
  });
  it('two motions: from the top, the last word of the last line', () => {
    const v = createVim({ text: ['one two', 'three four', 'five six'], name: 'a.ts' });
    expect(shorterEdit(v, 'one two\nthree four\nfive ', 8, taught)?.keys).toBe('GwD');
  });
});

describe('shorterSegment: visual and speed', () => {
  const play = (text: string[], keys: string) => {
    const c: RoundsChallenge = { kind: 'rounds', base: { name: 'a.ts' }, rounds: [{ setup: { text }, goal: { text: ['__'] }, solution: 'x' }] };
    const s = new Session(c);
    let t = 0;
    for (const k of parseKeys(keys)) s.key(k, (t += 50));
    const segs = segment(s.log());
    return shorterSegment(s, segs, segs.length - 1, taught);
  };
  it('a visual selection deleted (vllllld) was a normal-mode delete', () => {
    expect(play(['alpha beta gamma', 'x', 'y'], 'vllllld')?.keys).toBe('dw');
  });
  it('stays within its time budget on a long, varied line', () => {
    const long = 'const result = await client.fetchAll({ page: 2, size: 50, sort: "name", order: "asc" });';
    const t0 = performance.now();
    play([long, long, long, long], 'wwwwwwwwwwwwwwwwwwwwD');
    expect(performance.now() - t0).toBeLessThan(400);
  });
});

describe('shorterSegment', () => {
  it('finds it from a live session log', () => {
    const c: RoundsChallenge = { kind: 'rounds', base: { name: 'a.ts' }, rounds: [{ setup: { text: ['run(a);', 'next();', 'end();'] }, goal: { text: ['__'] }, solution: 'x' }] };
    const s = new Session(c);
    let t = 0;
    for (const k of parseKeys('f)lD')) s.key(k, (t += 50));
    const segs = segment(s.log());
    expect(shorterSegment(s, segs, segs.length - 1, taught)?.keys).toBe('$x');
  });
  it('a failed motion key on the way still counts as spent', () => {
    const c: RoundsChallenge = { kind: 'rounds', base: { name: 'a.ts' }, rounds: [{ setup: { text: ['run(a);', 'next();', 'end();'] }, goal: { text: ['__'] }, solution: 'x' }] };
    const s = new Session(c);
    let t = 0;
    for (const k of parseKeys('f;llD')) s.key(k, (t += 50)); // both l's beep at the end of the line
    const segs = segment(s.log());
    expect(shorterSegment(s, segs, segs.length - 1, taught)).toMatchObject({ keys: '$x', used: 5 });
  });
});
