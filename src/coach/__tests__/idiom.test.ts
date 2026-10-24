// Acceptance rows from the coach audit (docs/superpowers/audit/2026-09-30-sweep/claude-coach.report.md,
// F4 table): what a novice typed, and the idiom an expert names. Played on the real lesson round so
// the vocabulary gate (what that lesson has taught) is the real one. Where today's round differs
// from the audit's, the keys are adapted to the same habit on the current text (noted per row).
import { describe, expect, it } from 'vitest';
import { LESSONS } from '../../lessons';
import { Session } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { coach, gain, nudgeText } from '../index';
import { searchIdioms } from '../idiom';
import { createVim } from '../../lessons/runtime';
import { PATTERNS } from '../patterns';

function run(lessonId: string, round: number, keys: string) {
  const c = LESSONS[lessonId].challenge as RoundsChallenge;
  const s = new Session({ ...c, rounds: [c.rounds[round]] }, { carryCursor: false });
  let t = 0;
  for (const k of parseKeys(keys)) { if (s.done) break; s.key(k, (t += 50)); }
  return coach(s, lessonId);
}
const said = (lessonId: string, round: number, keys: string) => run(lessonId, round, keys).critiques.map(c => c.better[0].keys);

const ROWS: [lesson: string, round: number, typed: string, expert: string][] = [
  ['delete-to-char', 1, 'kf,' + 'x'.repeat(16), 'dt)'],
  ['delete-lines', 1, 'kf/h' + 'x'.repeat(27), 'D'],
  ['delete-words', 1, 'jjwww' + 'x'.repeat(7), 'dw'],
  ['counts-operators', 0, 'w' + 'x'.repeat(14), 'd2w'], // audit: kw…; the round now starts on line 0
  ['text-objects-quotes', 3, 'jjf"l' + 'x'.repeat(14), 'di"'],
  ['change-lines', 1, 'jj^C}<Esc>', 'cc}<Esc>'], // audit: ^Creturn sum; — the round's line is now `}`
  ['counts-operators', 0, 'wdwdw', 'd2w'], // audit: kwdwdw
  ['word-objects', 0, 'jfLbcworders<Esc>', 'ciworders<Esc>'],
  ['word-objects', 1, 'jjfybdw', 'daw'],
  ['open-lines', 1, '0i<CR><Esc>', 'O<Esc>'], // audit: 0i## This week<CR><Esc> — the round now opens a blank line
  ['insert-line-ends', 2, '0lli-- <Esc>', 'I-- <Esc>'],
  ['toggle-case', 0, 'kkwxiU<Esc>', '~'], // audit: xiF — the word is now userService
  ['case-operators', 0, 'ww' + '~'.repeat(11), 'gUiw'], // audit: ~~~~~ toggled half the word, which is not the same edit; the round now starts at col 0
  ['indenting', 0, 'I  <Esc>', '>>'],
  ['join-lines', 0, 'jjjI<BS> <Esc>', 'J'], // audit: jjA <Esc>jd$kp leaves a stray line, so it is not a join
];

describe('idiom search: the audit table gets the expert answer', () => {
  for (const [lesson, round, typed, expert] of ROWS) {
    it(`${lesson} r${round}: ${typed} → ${expert}`, () => {
      expect(said(lesson, round, typed)).toContain(expert);
    });
  }
  it('jjA<Del> <Esc> is a join too', () => {
    expect(said('join-lines', 0, 'jjA<Del> <Esc>')).toContain('J');
  });
});

describe('patterns: every suggestion teaches a named idea with a lesson link', () => {
  it('every pattern points at a real lesson', () => {
    for (const [id, p] of Object.entries(PATTERNS)) expect(LESSONS[p.lesson], `${id} → ${p.lesson}`).toBeDefined();
  });
  it('a suggestion carries its pattern, and the live hint names it with both key counts', () => {
    const r = run('delete-to-char', 1, 'kf,' + 'x'.repeat(16));
    const c = r.critiques.find(x => x.better[0].keys === 'dt)')!;
    expect(c.better[0].pattern).toBe('op-to-char');
    expect(c.better[0].why).toBe(PATTERNS['op-to-char'].principle);
    expect(nudgeText(c)).toBe('Edit up to a character: dt) does that in 3 keys instead of 16.');
  });
  it('says one key, not "1 keys", and never calls an equal count shorter', () => {
    expect(gain(5, 1)).toBe('in 1 key instead of 5');
    expect(gain(5, 5)).toBe('in one command, with the same 5 keys');
  });
  it('a habit that keeps coming up adds one word, so the one-line hint does not clip it', () => {
    const c = run('delete-to-char', 1, 'kf,' + 'x'.repeat(16)).critiques.find(x => x.better[0].keys === 'dt)')!;
    expect(nudgeText(c, true)).toBe('Edit up to a character, again: dt) does that in 3 keys instead of 16.');
  });
});

describe('report summary', () => {
  it('splits the keys into moving, typing and editing, with the par', () => {
    const r = run('change-lines', 1, 'jj^C}<Esc>');
    // jj^ moving (3), } typed (1), C and <Esc> editing (2); par is the reference jjcc}<Esc>
    expect(r.summary).toEqual({ keys: 6, moving: 3, typing: 1, editing: 2, par: 6 });
  });
});

describe('motion critic: canonical routes, one suggestion', () => {
  const motion = (lesson: string, round: number, keys: string) => run(lesson, round, keys).critiques.filter(c => c.better[0].rule === 'motion');
  it('24 j to line 25 → 25G once G is taught', () => {
    expect(motion('top-bottom', 2, 'j'.repeat(24)).map(c => c.better[0].keys)).toContain('25G');
  });
  it('l-spam to the closing paren in the % lesson → %', () => {
    const c = motion('matching-pairs', 4, 'l'.repeat(20));
    expect(c.map(x => x.better[0].keys)).toContain('%');
  });
  it('j-spam in the half-pages lesson → <C-d>', () => {
    const c = motion('half-pages', 0, 'j'.repeat(12));
    expect(c[0]?.better[0].keys).toMatch(/^(<C-d>)+$/);
  });
  it('vertical then horizontal: never 3jEj3j3j or 2wjl', () => {
    for (const [lesson, round, keys] of [['search-forward', 0, 'jjjjjjjjjjw'], ['insert-mode', 0, 'j' + 'l'.repeat(17)]] as const) {
      for (const c of motion(lesson, round, keys)) {
        expect(c.better).toHaveLength(1);
        // after the first horizontal move, no vertical one
        expect(c.better[0].keys, `${lesson}: ${c.better[0].keys}`).not.toMatch(/[wbeWBEhl0^$fFtT].*[jk]|[jk].*[jk]/);
      }
    }
  });
  it('a same-line target gets f/t, not a search', () => {
    const same = run('search-forward', 0, 'l'.repeat(12)).critiques.filter(x => x.you === 'l'.repeat(12));
    for (const x of same) expect(x.better[0].keys).not.toMatch(/^\//);
  });
  it('motion critiques name a motion pattern', () => {
    const c = motion('top-bottom', 2, 'j'.repeat(24))[0];
    expect(c.better[0].pattern).toBe('jump-line');
  });
});

describe('search rounds: no hand-motion tips', () => {
  const tips = (lesson: string, round: number, keys: string) => run(lesson, round, keys).critiques.filter(c => c.better[0].rule === 'motion').map(c => c.better[0].keys);
  it('a second search for the same pattern → n, never 3j^ or j$b', () => {
    expect(tips('pattern-atoms', 2, '/^function<CR>Iasync <Esc>/^function<CR>.')).toEqual(['n']);
    expect(tips('pattern-atoms', 0, '/gr.y<CR>cgnsilver<Esc>/gr.y<CR>.')).toEqual(['n']);
  });
  it('a search to a spot on the same line stays: dgn needs it ($ is not better)', () => {
    expect(tips('pattern-atoms', 1, '/;$<CR>dgn..')).toEqual([]);
  });
  it('a search that lands where a hand motion would is not critiqued', () => {
    expect(tips('pattern-atoms', 4, '/\\s$<CR>xjj$x')).toEqual([]);
  });
  it('a round solved by moving still gets its motion tip', () => {
    expect(tips('top-bottom', 2, 'j'.repeat(24))).toContain('25G');
  });
});

describe('a change that types nothing is a delete', () => {
  it('di" is offered, ci"<Esc> never', () => {
    const text = ['  token: "sk-live-4f9a2c",'];
    const start = createVim({ name: 'a.ts', text, cursor: { line: 0, col: 9 } });
    const scratch = createVim({ name: 'a.ts', text, cursor: { line: 0, col: 9 } });
    const found = searchIdioms(scratch, start, '  token: "",', { taught: new Set(['d', 'c', 'i"', 'a"', 't', 'f', 'D', 'C', 'x']), maxKeys: 20 });
    const keys = found.map(x => x.keys.join(''));
    expect(keys).toContain('di"');
    // Changes that type nothing; a change that retypes the quote (ct""<Esc>) is a different edit.
    expect(found.filter(x => x.typed === '' && /^[cC]/.test(x.keys[0])).map(x => x.keys.join(''))).toEqual([]);
  });
});
