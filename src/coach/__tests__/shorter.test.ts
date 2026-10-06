import { describe, expect, it } from 'vitest';
import { createVim, Session } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { segment } from '../segment';
import { shorterEdit, shorterSegment } from '../shorter';
import { taughtBy } from '../vocab';

const taught = taughtBy('repeat-last-change');
// The live search stops at 40 ms; under a loaded test run that's too tight to be deterministic.
const SLOW = 2000;

describe('shorterEdit', () => {
  it('f)lD on the last character was $x', () => {
    const v = createVim({ text: ['run(a);', 'next();'], name: 'a.ts' });
    expect(shorterEdit(v, 'run(a)\nnext();', 4, taught, 2, SLOW)).toMatchObject({ keys: '$x', length: 2 });
  });
  it('a line below: jf;lD was j$x', () => {
    const v = createVim({ text: ['a b c', 'run(a);', 'next();'], name: 'a.ts' });
    expect(shorterEdit(v, 'a b c\nrun(a)\nnext();', 5, taught, 2, SLOW)?.keys).toBe('j$x');
  });
  it('nothing when the saving is under two keys', () => {
    const v = createVim({ text: ['run(a);', 'next();'], name: 'a.ts' });
    expect(shorterEdit(v, 'run(a)\nnext();', 3, taught, 2, SLOW)).toBeNull();
  });
  it('only keys the learner has been taught', () => {
    const v = createVim({ text: ['run(a);', 'next();'], name: 'a.ts' });
    expect(shorterEdit(v, 'run(a)\nnext();', 4, new Set(['f', 'l', 'D', 'x']), 2, SLOW)).toBeNull();
  });
});

describe('shorterEdit: typed text, visual, two motions', () => {
  it('xxxiuser<Esc> on usr was cwuser<Esc>', () => {
    const v = createVim({ text: ['let usr = 1;', 'x'], name: 'a.ts' });
    v.feedKeys('w');
    expect(shorterEdit(v, 'let user = 1;\nx', 10, taught, 2, SLOW)?.keys).toBe('cwuser<Esc>');
  });
  it('$a;<Esc> after wandering was A;<Esc>', () => {
    const v = createVim({ text: ['run(a)', 'x'], name: 'a.ts' });
    expect(shorterEdit(v, 'run(a);\nx', 8, taught, 2, SLOW)?.keys).toBe('A;<Esc>');
  });
  it('a new line typed after jjjj$ was o on the line', () => {
    const v = createVim({ text: ['a', 'b', 'c', 'd'], name: 'a.ts' });
    expect(shorterEdit(v, 'a\nb\nc\nd\ne', 10, taught, 2, SLOW)?.keys).toBe('Goe<Esc>');
  });
  it('two motions: from the top, the last word of the last line', () => {
    const v = createVim({ text: ['one two', 'three four', 'five six'], name: 'a.ts' });
    expect(shorterEdit(v, 'one two\nthree four\nfive ', 8, taught, 2, SLOW)?.keys).toBe('GwD');
  });
});

describe('shorterEdit: counts and multi-line changes', () => {
  it('xxxx was 4x', () => {
    const v = createVim({ text: ['abcdefg', 'x'], name: 'a.ts' });
    expect(shorterEdit(v, 'efg\nx', 4, taught, 2, SLOW)?.keys).toBe('4x');
  });
  it('dddddd was 3dd', () => {
    const v = createVim({ text: ['a', 'b', 'c', 'd'], name: 'a.ts' });
    expect(shorterEdit(v, 'd', 6, taught, 2, SLOW)?.keys).toBe('3dd');
  });
  it('a counted motion first: jjjjjD was 5jD', () => {
    const v = createVim({ text: ['a', 'b', 'c', 'd', 'e', 'fgh', 'i'], name: 'a.ts' });
    expect(shorterEdit(v, 'a\nb\nc\nd\ne\n\ni', 7, taught, 2, SLOW)?.keys).toMatch(/^(5jD|GkD)$/); // equal length
  });
  it('three lines replaced by one typed line was c2j', () => {
    const v = createVim({ text: ['x', 'one', 'two', 'three', 'y'], name: 'a.ts' });
    v.feedKeys('j');
    expect(shorterEdit(v, 'x\nnew\ny', 14, taught, 2, SLOW)?.keys).toMatch(/^(c2jnew<Esc>|3ccnew<Esc>)$/);
  });
  it('no counts before counts are taught', () => {
    const v = createVim({ text: ['abcdefg', 'x'], name: 'a.ts' });
    expect(shorterEdit(v, 'efg\nx', 4, new Set(['x']), 2, SLOW)).toBeNull();
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
  it('a change typed again was .', () => {
    expect(play(['run(a)', 'run(b)', 'z'], 'A;<Esc>jA;<Esc>')?.keys).toBe('j.');
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
