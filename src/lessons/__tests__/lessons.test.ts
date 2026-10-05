// Validates every lesson: shape, and that each round's reference solution
// actually reaches its goal in the engine (and the goal isn't met at the start).
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '..';
import { Session, createVim, goalMet, marksOf, mergeSetup, solutionKeys, stepsOf } from '../runtime';
import type { Lesson } from '../types';

const only = process.env.LESSON_SECTION;

/** Longest line a practice buffer may have; longer lines get clipped at some widths. */
const MAX_COLS = 60;
const tooLong = (lines: readonly string[]) => lines.filter(l => l.length > MAX_COLS);

const all: [string, Lesson][] = SECTIONS.filter(s => !only || s.id === only).flatMap(s => s.lessons.map(l => [s.id, l] as [string, Lesson]));

describe('lesson registry', () => {
  it('has unique lesson ids', () => {
    const ids = SECTIONS.flatMap(s => s.lessons.map(l => l.id));
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dup).toEqual([]);
  });
});

/**
 * Does the solution's first command act from the exact cursor column? A charwise operator with a
 * motion (dw, ct;, gUt=, d/x, gsa3e), a selection start (v, <C-v>), or a one-character edit (x, r, R…).
 * Linewise forms (dd, yj) and text objects (ciw, da() work from anywhere inside, so they don't count.
 */
const startsAtCursor = (sol: string) => {
  if (/^(v|<C-v>)(?!\d*[ia])/.test(sol) || /^\d*[xsrRDCY~]/.test(sol)) return true;
  const m = /^\d*(d|c|y|gU|gu|g~|gsa|g\?)\d*/.exec(sol);
  return !!m && /^([wWeEbB$0^_tTfF/?]|g[eE_])/.test(sol.slice(m[0].length));
};

describe('rounds start where a person would be', () => {
  // Real editing begins with getting to the spot. A round whose cursor sits mid-line, right where
  // the edit starts, skips that, and the learner can't tell which character it's on under the block.
  for (const [, lesson] of all) {
    const c = lesson.challenge;
    if (c.kind !== 'rounds') continue;
    c.rounds.forEach((r, i) => {
      const s = mergeSetup(c.base, r.setup);
      if (!s.cursor || !startsAtCursor(r.solution)) return;
      const text = Array.isArray(s.text) ? s.text : (s.text ?? '').split('\n');
      const line = text[s.cursor.line] ?? '';
      if (s.cursor.col === 0 || s.cursor.col === line.search(/\S|$/)) return;
      it(`${lesson.id} round ${i + 1}: ${r.solution}`, () => {
        expect.fail(`starts at col ${s.cursor!.col} of ${JSON.stringify(line)}; start at the line's start and get there in the solution`);
      });
    });
  }
  it('tells cursor-exact starts from navigation and text objects', () => {
    for (const k of ['vt,d', '<C-v>3j4ld', 'cwuser<Esc>', 'gUt=', 'd/Then<CR>', 'gsa3e)', 'x', 'RDONE<Esc>']) expect(startsAtCursor(k), k).toBe(true);
    for (const k of ['wcwuser<Esc>', 'f.vf)d', 'ciw', 'vi(d', 'dd', 'yj', 'gsaiw"', 'Vjd']) expect(startsAtCursor(k), k).toBe(false);
  });
});

describe.each(all)('%s / %s', (_section, lesson) => {
  it('is well formed', () => {
    expect(lesson.id).toMatch(/^[a-z0-9-]+$/);
    expect(lesson.chips.length).toBeGreaterThanOrEqual(1);
    expect(lesson.chips.length).toBeLessThanOrEqual(4);
    if (lesson.challenge.kind !== 'generated') {
      expect(lesson.keyCards.length).toBeGreaterThanOrEqual(1);
      expect(lesson.keyCards.length).toBeLessThanOrEqual(5);
    }
    expect(lesson.title.length).toBeLessThanOrEqual(28);
  });

  const c = lesson.challenge;
  if (c.kind === 'rounds') {
    it('has 3–10 rounds', () => {
      expect(c.rounds.length).toBeGreaterThanOrEqual(3);
      expect(c.rounds.length).toBeLessThanOrEqual(10);
    });
    c.rounds.forEach((r, i) => {
      it(`round ${i + 1}: ${r.solution}`, () => {
        const vim = createVim(mergeSetup(c.base, r.setup));
        expect(tooLong(vim.buf.lines), `lines over ${MAX_COLS} columns`).toEqual([]);
        expect(vim.buf.lineCount, 'give the round a few lines of context (≥ 3)').toBeGreaterThanOrEqual(3);
        const goal = r.goal.text == null ? [] : Array.isArray(r.goal.text) ? r.goal.text : r.goal.text.split('\n');
        expect(tooLong(goal), `goal lines over ${MAX_COLS} columns`).toEqual([]);
        const steps = stepsOf(r);
        expect(goalMet(vim, steps[0].goal), 'goal already met before any keys').toBe(false);
        if (!r.steps?.length) vim.feedKeys(r.solution);
        else {
          // Steps are met in order, each by some prefix of the solution, as the session sees them.
          let at = 0;
          for (const k of solutionKeys(r.solution)) {
            vim.feed(k);
            while (at < steps.length - 1 && goalMet(vim, steps[at].goal)) at++;
          }
          expect(at, `stuck on step ${at + 1}: ${steps[at].prompt}`).toBe(steps.length - 1);
        }
        const msg = vim.message?.text ?? '';
        expect(goalMet(vim, r.goal), `goal not met. buffer:\n${vim.buf.text()}\ncursor ${vim.cursor.line}:${vim.cursor.col} mode ${vim.mode} msg "${msg}"`).toBe(true);
      });
    });
    it('plays through a session', () => {
      const s = new Session(c, { carryCursor: false });
      let t = 0;
      c.rounds.forEach(r => {
        for (const k of solutionKeys(r.solution)) s.key(k, (t += 100));
        if (!s.done) s.advance();
      });
      expect(s.done).toBe(true);
      expect(s.result().acc).toBe(1);
    });
    it('carries the cursor between rounds without breaking', () => {
      const s = new Session(c);
      for (let i = 0; i < c.rounds.length; i++) {
        const v = s.vim!;
        expect(v.cursor.line).toBeLessThan(v.buf.lineCount);
        expect(goalMet(v, c.rounds[i].goal), `round ${i + 1} starts already solved`).toBe(false);
        // Jump straight to the next round.
        (s as unknown as { roundDone: boolean }).roundDone = true;
        if (i < c.rounds.length - 1) s.advance();
      }
    });
  } else if (c.kind === 'quiz') {
    it('has valid questions', () => {
      expect(c.questions.length).toBeGreaterThanOrEqual(3);
      for (const q of c.questions) {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options.length).toBeLessThanOrEqual(4);
      }
    });
  } else if (c.kind === 'fix' || c.kind === 'replace') {
    it('lines fit', () => expect(tooLong(c.code)).toEqual([]));
    it('marks are consistent', () => {
      expect(c.code.length).toBe(c.correct.length);
      const m = marksOf(c.code, c);
      expect(m.broken.size).toBe(0);
      expect(m.marks.size).toBeGreaterThan(0);
    });
  } else if (c.kind === 'generated') {
    it('generates a solvable run', () => {
      const s = new Session(c, { seed: 1 });
      expect(s.total).toBeGreaterThan(0);
      expect(s.vim!.buf.lineCount).toBeGreaterThanOrEqual(25);
    });
  } else {
    it('lines fit', () => expect(tooLong(c.code)).toEqual([]));
    it('has code', () => {
      expect(c.code.length).toBeGreaterThan(2);
      const s = new Session(c, { rand: () => 0.5 });
      expect(s.view().target).not.toBeNull();
    });
  }
});
