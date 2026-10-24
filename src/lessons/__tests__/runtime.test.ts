import { describe, expect, it } from 'vitest';
import { createVim, goalMet, Session, marksOf, selecting, solutionKeys, yanked } from '../runtime';
import { LESSONS } from '../index';
import type { MarksChallenge, RoundsChallenge } from '../types';

describe('createVim', () => {
  it('keeps an insert-mode start at the end of the line', () => {
    const v = createVim({ text: ['fn'], name: 'a.ts', init: vim => vim.startInsert('i', { line: 0, col: 2 }) });
    expect(v.mode).toBe('insert');
    expect(v.cursor).toEqual({ line: 0, col: 2 });
  });
  it('always has flash: s is a label jump in every lesson, S a treesitter select', () => {
    const v = createVim({ text: ['alpha beta', 'gamma delta'], name: 'a.ts' });
    v.feedKeys('sde');
    expect(v.pluginData.flash).toBeTruthy();
    v.feedKeys('<CR>');
    expect(v.cursor).toEqual({ line: 1, col: 6 });
    expect(v.buf.lines).toEqual(['alpha beta', 'gamma delta']);
  });
  it('a lesson Session in an early lesson jumps with s and stays playable', () => {
    const l = LESSONS['delete-words'] as { challenge: RoundsChallenge };
    const s = new Session(l.challenge);
    const vim = s.vim!;
    const before = vim.buf.lines.slice();
    const target = vim.buf.lines.findIndex((t, i) => i > vim.cursor.line && t.trim().length > 2);
    const word = vim.buf.lines[target].trim().slice(0, 2);
    for (const k of ['s', ...word, '<CR>']) s.key(k);
    expect(vim.cursor.line).toBeGreaterThan(0);
    expect(vim.buf.lines).toEqual(before);
    expect(vim.mode).toBe('normal');
  });
});

describe('fix / replace scoring after undo', () => {
  it('replace: u after a wrong r is not a second mistake', () => {
    const l = LESSONS['r'] as { challenge: MarksChallenge };
    const s = new Session(l.challenge);
    const vim = s.vim!;
    const [first] = [...marksOf(vim.buf.lines, l.challenge).marks];
    const [ml, mc] = first.split(':').map(Number);
    vim.win.cursor = { line: ml, col: mc };
    s.key('r'); s.key('z');           // wrong character
    expect(s.result().correctText).toBe('0 of 1 edits right');
    s.key('u');
    expect(s.result().correctText).toBe('0 of 1 edits right');
  });
  it('fix: u after a wrong x does not count as an edit', () => {
    const l = LESSONS['x'] as { challenge: MarksChallenge };
    const s = new Session(l.challenge);
    const vim = s.vim!;
    const [first] = [...marksOf(vim.buf.lines, l.challenge).marks];
    const [ml, mc] = first.split(':').map(Number);
    // A column on the same line whose character differs from the typo's, away from it: deleting it is wrong.
    const line = vim.buf.lines[ml];
    const wrong = [...line].findIndex((ch, i) => Math.abs(i - mc) > 1 && ch !== line[mc] && ch !== ' ');
    vim.win.cursor = { line: ml, col: wrong };
    s.key('x');
    expect(s.result().correctText).toBe('0 of 1 edits right');
    s.key('u');
    expect(s.result().correctText).toBe('0 of 1 edits right');
  });
});

describe('cursor carry and folds', () => {
  const text = ['top', '', 'function a() {', '  body', '}', 'end'];
  it('does not carry the cursor into a round that sets up folds', () => {
    const c: RoundsChallenge = {
      kind: 'rounds', base: { name: 'a.ts', text },
      rounds: [
        { setup: { cursor: { line: 0, col: 0 } }, goal: { cursor: { line: 3, col: 2 } }, solution: '3jw' },
        { setup: { cursor: { line: 0, col: 0 }, folds: [{ start: 2, end: 4 }] }, goal: { cursor: { line: 5, col: 0 } }, solution: '2j' },
      ],
    };
    const s = new Session(c);
    for (const k of solutionKeys('3jw')) s.key(k, 100);
    s.advance();
    expect(s.vim!.cursor).toEqual({ line: 0, col: 0 });
    expect(s.vim!.closedFoldAt(s.vim!.cursor.line)).toBeNull();
  });
  it.each(['flash-jump', 'flash-motions', 'flash-treesitter'])('%s: every round starts at its setup cursor, so labels match the reference', id => {
    // Flash labels depend on where the cursor is; a carried cursor would show labels that differ from
    // the reference solutions on Results.
    const c = LESSONS[id].challenge as RoundsChallenge;
    expect(c.carryCursor).toBe(false);
    const s = new Session(c);
    let t = 0;
    c.rounds.forEach((r, i) => {
      const want = { ...(r.setup?.cursor ?? c.base.cursor ?? { line: 0, col: 0 }) };
      expect(s.vim!.cursor, `round ${i + 1} start`).toEqual(want);
      for (const k of solutionKeys(r.solution)) s.key(k, (t += 100));
      expect(s.done || s.roundDone, `round ${i + 1} (${r.solution}) not solved`).toBe(true);
      if (!s.done) s.advance();
    });
  });
  it('carryCursor: false keeps a round at its setup cursor even when the text is unchanged', () => {
    const c: RoundsChallenge = {
      kind: 'rounds', base: { name: 'a.ts', text }, carryCursor: false,
      rounds: [
        { setup: { cursor: { line: 0, col: 0 } }, goal: { cursor: { line: 3, col: 2 } }, solution: '3jw' },
        { setup: { cursor: { line: 0, col: 0 } }, goal: { cursor: { line: 5, col: 0 } }, solution: '5j0' },
      ],
    };
    const s = new Session(c);
    for (const k of solutionKeys('3jw')) s.key(k, 100);
    s.advance();
    expect(s.vim!.cursor).toEqual({ line: 0, col: 0 });
    const carried = new Session({ ...c, carryCursor: undefined });
    for (const k of solutionKeys('3jw')) carried.key(k, 100);
    carried.advance();
    expect(carried.vim!.cursor).toEqual({ line: 3, col: 2 });
  });
  it('moves a carried cursor back, and says so, only when the round would not work from there', () => {
    const c: RoundsChallenge = {
      kind: 'rounds', base: { name: 'a.ts', text },
      rounds: [
        { setup: { cursor: { line: 0, col: 0 } }, goal: { cursor: { line: 3, col: 2 } }, solution: '3jw' },
        // From column 2 of line 0, `5j` keeps the column and misses: the cursor goes back.
        { setup: { cursor: { line: 0, col: 0 } }, goal: { cursor: { line: 5, col: 0 } }, solution: '5j' },
        // `gg` works from anywhere: the cursor stays where round 2 left it.
        { setup: { cursor: { line: 0, col: 0 } }, goal: { cursor: { line: 0, col: 0 } }, solution: 'gg' },
      ],
    };
    const s = new Session(c);
    for (const k of solutionKeys('3jw')) s.key(k, 100);
    s.advance();
    expect(s.vim!.cursor).toEqual({ line: 0, col: 0 });
    expect(s.view().moved).toEqual({ from: { line: 3, col: 2 }, to: { line: 0, col: 0 } });
    expect(s.view().msg).toMatch(/moved to line 1/);
    for (const k of solutionKeys('5j')) s.key(k, 200);
    expect(s.view().moved).toBeNull();
    s.advance();
    expect(s.vim!.cursor).toEqual({ line: 5, col: 0 });
    expect(s.view().moved).toBeNull();
    expect(s.view().msg).toBe('');
  });
  it('a new round starts with a clean command line', () => {
    const c: RoundsChallenge = {
      kind: 'rounds', base: { name: 'a.ts', text },
      rounds: [
        { goal: { cursor: { line: 0, col: 0 } }, solution: '/nomatch<CR>gg' },
        { setup: { init: v => { for (const k of solutionKeys('/alsonothere<CR>')) v.feed(k); } }, goal: { cursor: { line: 1, col: 0 } }, solution: 'j' },
      ],
    };
    const s = new Session(c);
    for (const k of solutionKeys('/nomatch<CR>gg')) s.key(k, 100);
    s.advance();
    expect(s.view().msg).toBe('');
    expect(s.vim!.message).toBeNull();
  });
  it('the Folds lesson solves every round in order with the cursor carried', () => {
    const lesson = LESSONS['toggle-folds'];
    const c = lesson.challenge as RoundsChallenge;
    const s = new Session(c);
    let t = 0;
    c.rounds.forEach((r, i) => {
      for (const k of solutionKeys(r.solution)) s.key(k, (t += 100));
      expect(s.done || s.roundDone, `round ${i + 1} (${r.solution}) not solved`).toBe(true);
      if (!s.done) s.advance();
    });
    expect(s.done).toBe(true);
  });
});

describe('round steps', () => {
  const twoStep: RoundsChallenge = {
    kind: 'rounds', base: { name: 'README.md' },
    rounds: [
      {
        setup: { text: ['# x', '', 'The tutor runs in a browser.'], cursor: { line: 2, col: 0 } },
        steps: [{
          prompt: 'Select "browser".',
          goal: selecting({ line: 2, col: 20 }, { line: 2, col: 26 }),
          mark: { start: { line: 2, col: 20 }, end: { line: 2, col: 26 } },
        }],
        prompt: 'Now " in a browser" goes too.',
        goal: { text: ['# x', '', 'The tutor runs.'] },
        solution: '$bveoTsd',
      },
      { setup: { text: ['a b', 'c', 'd'] }, goal: { text: ['b', 'c', 'd'] }, solution: 'dw' },
    ],
  };
  it('moves through the steps in one editor, swapping prompt, marks and goal', () => {
    const s = new Session(twoStep);
    expect(s.view().prompt).toBe('Select "browser".');
    expect(s.view().span).toEqual({ start: { line: 2, col: 20 }, end: { line: 2, col: 26 } });
    expect(s.view().goalText).toBeNull(); // a selection step has no text goal, so no diff marks yet
    for (const k of solutionKeys('$bve')) s.key(k, 100);
    expect(s.view().step).toBe(1);
    expect(s.view().prompt).toBe('Now " in a browser" goes too.');
    expect(s.view().span).toBeNull();
    expect(s.vim!.mode).toBe('visual'); // the selection survives the step change
    expect(s.view().goalText).toEqual(['# x', '', 'The tutor runs.']);
    for (const k of solutionKeys('oTsd')) s.key(k, 200);
    expect(s.roundDone).toBe(true);
    expect(s.roundPar(0)).toBe(8);
  });
  it('a reset goes back to the first step', () => {
    const s = new Session(twoStep);
    for (const k of solutionKeys('$bve')) s.key(k, 100);
    s.resetRound();
    expect(s.view().step).toBe(0);
  });
  it('the final goal reached another way still finishes the round', () => {
    const s = new Session(twoStep);
    for (const k of solutionKeys('fsldt.')) s.key(k, 100);
    expect(s.roundDone).toBe(true);
  });
  it('yanked() wants the right kind and an untouched buffer', () => {
    const v = createVim({ text: ['alpha beta', 'gamma'], name: 'a.ts' });
    v.feedKeys('yy');
    expect(goalMet(v, yanked('alpha beta\n', 'line'))).toBe(true);
    expect(goalMet(v, yanked('alpha', 'char'))).toBe(false);
    v.feedKeys('yiw');
    expect(goalMet(v, yanked('alpha', 'char'))).toBe(true);
    v.feedKeys('x');
    expect(goalMet(v, yanked('alpha', 'char'))).toBe(false);
  });
});

describe('rounds with steps', () => {
  const two = (round: RoundsChallenge['rounds'][number]): RoundsChallenge => ({
    kind: 'rounds', base: { name: 'a.ts', text: ['alpha beta gamma', 'delta'] }, rounds: [round, { goal: { cursor: { line: 1, col: 0 } }, solution: 'j0' }],
  });
  const play = (c: RoundsChallenge, keys: string) => {
    const s = new Session(c, { carryCursor: false });
    for (const k of solutionKeys(keys)) s.key(k);
    return s.view().roundDone;
  };
  it('a text goal reached another way still finishes the round', () => {
    const c = two({ setup: { cursor: { line: 0, col: 0 } }, steps: [{ prompt: 'w', goal: { cursor: { line: 0, col: 6 } } }], goal: { text: ['beta gamma', 'delta'] }, solution: 'wd0' });
    expect(play(c, 'dw')).toBe(true);
  });
  it('a place to stand only counts once the steps are done', () => {
    const c = two({ setup: { cursor: { line: 0, col: 0 } }, steps: [{ prompt: 'x', goal: { text: ['lpha beta gamma', 'delta'] } }], goal: { cursor: { line: 0, col: 5 } }, solution: 'xw' });
    expect(play(c, '5l')).toBe(false);
    expect(play(c, 'xw')).toBe(true);
  });
  it('inOrder: the same text typed in one go does not skip the steps', () => {
    const c = two({ inOrder: true, setup: { cursor: { line: 0, col: 0 } }, steps: [{ prompt: 'x', goal: { text: ['lpha beta gamma', 'delta'] } }, { prompt: 'j', goal: { text: ['lpha beta gamma', 'delta'], cursor: { line: 1, col: 0 } } }], goal: { text: ['pha beta gamma', 'delta'] }, solution: 'xjkx' });
    expect(play(c, 'xx')).toBe(false);
    expect(play(c, 'xjkx')).toBe(true);
  });
  it('skipping the steps says what is next, and how to undo', () => {
    const c = two({ inOrder: true, setup: { cursor: { line: 0, col: 0 } }, steps: [{ prompt: 'Delete the a.', goal: { text: ['lpha beta gamma', 'delta'] } }, { prompt: 'Go down.', goal: { text: ['lpha beta gamma', 'delta'], cursor: { line: 1, col: 0 } } }], goal: { text: ['pha beta gamma', 'delta'] }, solution: 'xjkx' });
    const s = new Session(c, { carryCursor: false });
    for (const k of solutionKeys('xx')) s.key(k);
    expect(s.view().msg).toBe('This round goes step by step. Next: Go down. (u undoes)');
    expect(s.view().msgKind).toBe('warn');
  });
  it('a goal that Esc meets at the start needs the steps', () => {
    const c = two({ setup: { cursor: { line: 0, col: 0 } }, steps: [{ prompt: 'x', goal: { text: ['lpha beta gamma', 'delta'] } }], goal: { text: ['alpha beta gamma', 'delta'] }, solution: 'xu' });
    expect(play(c, '<Esc>')).toBe(false);
    expect(play(c, 'xu')).toBe(true);
  });
});

describe('setup', () => {
  it('edits made by init leave the buffer modified; the file as given does not', () => {
    expect(createVim({ name: 'a.ts', text: ['x'] }).buf.modified).toBe(false);
    expect(createVim({ name: 'a.ts', text: ['x'], init: v => v.feedKeys('Ay<Esc>') }).buf.modified).toBe(true);
    expect(createVim({ name: 'a.ts', text: ['x'], init: v => v.feedKeys('j') }).buf.modified).toBe(false);
  });
  it('showTarget: false hides the green box', () => {
    const c: RoundsChallenge = { kind: 'rounds', showTarget: false, base: { name: 'a.ts', text: ['a', 'b'] }, rounds: [{ goal: { cursor: { line: 1, col: 0 } }, solution: 'j' }] };
    expect(new Session(c).view().target).toBeNull();
    expect(new Session({ ...c, showTarget: undefined }).view().target).toEqual({ line: 1, col: 0 });
  });
});
