// Acceptance rows from the coach audit (docs/superpowers/audit/2026-09-30-sweep/claude-coach.report.md,
// F4 table): what a novice typed, and the idiom an expert names. Played on the real lesson round so
// the vocabulary gate (what that lesson has taught) is the real one. Where today's round differs
// from the audit's, the keys are adapted to the same habit on the current text (noted per row).
import { describe, expect, it } from 'vitest';
import { LESSONS } from '../../lessons';
import { Session } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { coach, nudgeText } from '../index';
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
  ['substitute', 0, 'xi===<Esc>', 's===<Esc>'],
  ['change-lines', 1, 'jj^C}<Esc>', 'cc}<Esc>'], // audit: ^Creturn sum; — the round's line is now `}`
  ['counts-operators', 0, 'wdwdw', 'd2w'], // audit: kwdwdw
  ['word-objects', 0, 'jfLbcworders<Esc>', 'ciworders<Esc>'],
  ['word-objects', 1, 'jjfybdw', 'daw'],
  ['open-lines', 1, '0i<CR><Esc>', 'O<Esc>'], // audit: 0i## This week<CR><Esc> — the round now opens a blank line
  ['insert-line-ends', 2, '0lli-- <Esc>', 'I-- <Esc>'],
  ['toggle-case', 0, 'kkwxiU<Esc>', '~'], // audit: xiF — the word is now userService
  ['case-operators', 0, 'b' + '~'.repeat(11), 'gUiw'], // audit: ~~~~~ toggled half the word, which is not the same edit
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
    expect(nudgeText(c)).toBe('Delete to a character: dt) (3 instead of 16)');
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
    const c = motion('matching-pairs', 1, 'l'.repeat(38));
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
