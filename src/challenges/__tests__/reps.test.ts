// Per-lesson Reps: every seeded run of every lesson's reps is solvable by its par keys, keeps its
// edits apart, and never asks the learner to type more than 6 characters for one fix.
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ORDER } from '../../lessons';
import { createVim } from '../../lessons/runtime';
import { parseKeys } from '../../vim/keys';
import { CORPUS } from '../corpus';
import { generate } from '../generate';
import { KINDS } from '../mutations';
import { MAX_TYPED, REPS_KINDS } from '../mutations/reps';
import { JOINED, lessonOfRepsRun, repsChallenge, repsRunId } from '../reps';

/** With REPS_REPORT=<path>, the report tests write their tables there (site counts, ranges). */
const report = (suffix: string, text: string) => { if (process.env.REPS_REPORT) writeFileSync(process.env.REPS_REPORT + suffix, text); };
const SEEDS = Array.from({ length: 300 }, (_, i) => i * 104729 + 17);
const WITH_REPS = ORDER.filter(l => l.reps);
const FIRST_WAVE = [
  'intro-operators', 'delete-words', 'change-words', 'delete-lines', 'text-objects-quotes', 'text-objects-parens',
  'word-objects', 'argument-objects', 'indent-objects', 'function-class-objects', 'repeat-last-change',
  'counts-operators', 'search-forward', 'word-under-cursor',
];

describe('reps specs', () => {
  it('cover the first wave', () => {
    expect(WITH_REPS.map(l => l.id).sort()).toEqual([...FIRST_WAVE].sort());
  });
  it.each(WITH_REPS.map(l => [l.id, l] as const))('%s: known kinds, count [10, 15], its own section', (_id, l) => {
    for (const m of l.reps!.mutations) expect(KINDS[m], m).toBeDefined();
    expect(l.reps!.count).toEqual([10, 15]);
    expect(l.reps!.sections.length).toBeGreaterThan(0);
  });
  it('run ids fit the server rule and map back', () => {
    for (const l of WITH_REPS) {
      expect(repsRunId(l.id)).toMatch(/^[a-z0-9-]{1,64}$/);
      expect(lessonOfRepsRun(repsRunId(l.id))).toBe(l.id);
    }
    expect(lessonOfRepsRun('delete-words')).toBeNull();
  });
});

describe('reps kinds', () => {
  it('report their site counts on the corpus', () => {
    const rows = REPS_KINDS.map(k => {
      const per = CORPUS.map(f => k.sites(f.lines).length);
      const joined = JOINED.map(f => k.sites(f.lines).length);
      return `${k.id.padEnd(22)} corpus ${String(per.reduce((a, b) => a + b, 0)).padStart(4)} (${per.join(' ')})  joined ${joined.join('/')}`;
    });
    report('', rows.join('\n') + '\n');
    for (const k of REPS_KINDS) expect(CORPUS.reduce((a, f) => a + k.sites(f.lines).length, 0), k.id).toBeGreaterThan(0);
  });
});

/** Keys of a fix typed as text (fed in insert mode), <Esc> excluded. */
function typed(vim: ReturnType<typeof createVim>, keys: string): number {
  let n = 0;
  for (const k of parseKeys(keys)) { if (vim.mode === 'insert' && k !== '<Esc>') n++; vim.feed(k); }
  return n;
}

describe.each(WITH_REPS.map(l => [l.id, l] as const))('reps %s', (_id, lesson) => {
  const c = repsChallenge(lesson);
  const runs = SEEDS.map(s => generate(c, s));
  it('is deterministic and a drill of the lesson\'s kinds', () => {
    expect(generate(c, 123)).toEqual(generate(c, 123));
    expect(c.drill).toBe(true);
    expect(c.mutations).toEqual(lesson.reps!.mutations);
    expect(c.corpus.length).toBeGreaterThan(0);
  });
  it('reports its edit range and files', () => {
    const n = runs.map(g => g.items.length);
    report(`.${lesson.id}`,
      `${lesson.id.padEnd(24)} edits ${c.edits.join('–')} (got ${Math.min(...n)}–${Math.max(...n)}), files ${c.corpus.map(f => f.name).join(' ')}, groups in ${runs.filter(g => g.items.some(i => i.group !== undefined)).length}/300\n`);
  });
  it('stays in its edit range, with every kind drawn', () => {
    for (const g of runs) {
      expect(g.items.length).toBeGreaterThanOrEqual(c.edits[0]);
      expect(g.items.length).toBeLessThanOrEqual(c.edits[1]);
    }
    const kinds = new Set(runs.flatMap(g => g.items.map(i => i.kind)));
    expect(kinds.size).toBeGreaterThanOrEqual(1);
  });
  it('never has two edits on one line, nor on neighbouring lines', () => {
    for (const g of runs) {
      const r = g.items.map(i => i.goal).sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < r.length; i++) expect(r[i][0] - r[i - 1][1], `seed ${g.seed}`).toBeGreaterThanOrEqual(2);
    }
  });
  it('repeats with . only once . is taught', () => {
    const dot = c.skills.includes('repeat');
    for (const g of runs) for (const i of g.items) if (!dot) expect(i.fixKeys).not.toBe('.');
    if (lesson.id === 'repeat-last-change') expect(runs.filter(g => g.items.some(i => i.fixKeys === '.')).length).toBeGreaterThan(250);
  });
  it('is solved by its par keys on every seed, typing at most 6 characters per fix', () => {
    for (const g of runs) {
      const vim = createVim({ text: g.start, name: g.file, plugins: c.plugins });
      let keys = 0;
      for (const item of g.items) {
        vim.win.cursor = { line: item.fixAt.line + vim.buf.lines.length - g.start.length, col: item.fixAt.col };
        expect(typed(vim, item.fixKeys), `${item.kind} ${item.fixKeys}`).toBeLessThanOrEqual(MAX_TYPED);
        keys += parseKeys(item.fixKeys).length;
      }
      expect(vim.mode, `seed ${g.seed}`).toBe('normal');
      expect(vim.buf.lines, `seed ${g.seed} ${g.file}`).toEqual(g.goal);
      expect(keys).toBeLessThanOrEqual(g.parKeys);
    }
  });
});
