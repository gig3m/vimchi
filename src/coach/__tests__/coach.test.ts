import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../../challenges';
import { generate } from '../../challenges/generate';
import { SECTIONS } from '../../lessons';
import { Session, createVim, solutionKeys } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { coach, keyChips } from '../index';
import { coachable } from '../vocab';
import { LESSONS } from '../../lessons';

function play(text: string[], keys: string, lessonId = 'insert-mode', cursor = { line: 0, col: 0 }) {
  const c: RoundsChallenge = { kind: 'rounds', base: { text, name: 'a.ts', cursor }, rounds: [{ goal: { text: ['__never__'] }, solution: 'x' }] };
  const s = new Session(c);
  let t = 0;
  for (const k of parseKeys(keys)) s.key(k, (t += 50));
  return coach(s, lessonId);
}

describe('coach', () => {
  it('hhhhhh → 6h with counts taught', () => {
    const r = play(['abcdefgh'], 'hhhhhhx', 'insert-mode', { line: 0, col: 7 });
    const c = r.critiques.find(x => x.you === 'hhhhhh');
    expect(c).toBeDefined();
    expect(c!.better.map(b => b.keys)).toContain('6h');
  });
  it('minimum saving: one key saved is not shown', () => {
    const r = play(['abc def ghi jkl'], 'wwx');
    expect(r.critiques).toEqual([]);
  });
  it('never undercuts the lesson key the learner used', () => {
    const r = play(['a,b,c,d,e,f'], 'f,;;;x', 'repeat-find');
    expect(r.critiques.filter(c => c.you.includes(';'))).toEqual([]);
  });
  it('drops a suggestion whose state a later key reads', () => {
    // A later p pastes the unnamed register: xxxx leaves "d", de leaves "abcd", 4x leaves "abcd".
    const withP = play(['abcd efg', 'x'], 'xxxxjp');
    expect(withP.critiques.filter(c => c.you.startsWith('xxxx'))).toEqual([]);
    const noP = play(['abcd efg', 'x'], 'xxxxj');
    expect(noP.critiques.some(c => c.better.some(b => b.keys === 'de' || b.keys === '4x'))).toBe(true);
  });
  it('reference lines use par, not raw solution length', () => {
    const lesson = SECTIONS.flatMap(s => s.lessons).find(l => l.id === 'insert-mode')!;
    const c = lesson.challenge as RoundsChallenge;
    const s = new Session(c);
    let t = 0;
    for (const r of c.rounds) { for (const k of solutionKeys(r.solution)) s.key(k, (t += 50)); if (!s.done) s.advance(); }
    const rep = coach(s, 'insert-mode');
    for (const line of rep.reference) expect(line.par).toBeGreaterThanOrEqual(solutionKeys(c.rounds[line.unit].solution).length);
  });
  it('every reference playthrough yields zero critiques', () => {
    const offenders: string[] = [];
    for (const sec of SECTIONS) for (const l of sec.lessons) {
      if (!coachable(l.id) || l.challenge.kind !== 'rounds') continue;
      const c = l.challenge;
      const s = new Session(c, { carryCursor: false });
      let t = 0;
      for (const r of c.rounds) { for (const k of solutionKeys(r.solution)) s.key(k, (t += 50)); if (!s.done) s.advance(); }
      const rep = coach(s, l.id);
      for (const cr of rep.critiques) offenders.push(`${l.id} r${cr.unit + 1}: ${cr.you} → ${cr.better.map(b => `${b.keys} (${b.rule})`).join(' | ')}`);
    }
    expect(offenders).toEqual([]);
  });
  it('a generated run replayed with par motions gets no critiques', () => {
    const ch = CHALLENGES[0];
    for (let seed = 1; seed <= 20; seed++) {
      const s = new Session(ch.challenge, { seed });
      const g = generate(ch.challenge, seed);
      let t = 0;
      // Teleport stands in for the motion between items; the `0` keeps the fixes from reading as one
      // consecutive window (in real play a motion run always separates them).
      for (const item of g.items) { s.vim!.win.cursor = { ...item.fixAt }; for (const k of solutionKeys(item.fixKeys)) s.key(k, (t += 50)); s.key('0', (t += 50)); }
      const rep = coach(s, ch.id);
      expect(rep.critiques.filter(c => c.better.some(b => b.rule !== 'motion')), `seed ${seed}`).toEqual([]);
    }
  });
});

describe('coach heuristics from the reference audit', () => {
  it('a two-key run beaten by one key is not worth showing', () => {
    expect(play(['abc def', 'ghi jkl'], 'j0x').critiques).toEqual([]); // j0 → w saves 1 on a 2-key run
  });
  it('never undercuts a key drilled by this lesson or the ones before it in the section', () => {
    // clear-highlights is in the Search section: searching is the point, even if 7j reaches the line.
    const lines = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'leader'];
    expect(play(lines, '/leader<CR>x', 'clear-highlights').critiques).toEqual([]);
  });
  it('a j/k/l run in an operator lesson is critiqued: dk drills d and k as an operator, not k as a walk', () => {
    const r = play(['abc def ghi jkl mno', 'x'], 'kllllllllllllllD', 'delete-lines', { line: 1, col: 0 });
    expect(r.critiques.some(c => c.you.includes('lll'))).toBe(true);
  });
  it('w-spam in the f lesson is told about f', () => {
    const r = play(['send(order, { retries: 3 });'], 'wwwwwx', 'find-char');
    expect(r.critiques.some(c => c.better.some(b => /^[ft]/.test(b.keys)))).toBe(true);
  });
  it('repeated f, in the ; lesson is told about ; (the target char is an argument, not the drilled key)', () => {
    const r = play(['a,b,c,d,e,f'], 'f,f,f,f,x', 'repeat-find');
    expect(r.critiques.some(c => c.better.some(b => b.keys.includes(';')))).toBe(true);
  });
  it('the reference line shows solutions whose only "untaught" keys are arguments or typed text', () => {
    const l = LESSONS['find-char'];
    const s = new Session(l.challenge as RoundsChallenge);
    let t = 0;
    for (let i = 0; i < 80 && !s.roundDone && !s.done; i++) s.key('l', (t += 50)); // walk to the ( instead of f(
    const r = coach(s, 'find-char');
    expect(r.reference[0]?.ref).toBe((l.challenge as RoundsChallenge).rounds[0].solution);
  });
  it(':%s// reads the search pattern, so a search is not replaced before it', () => {
    const r = play(['x 12ms', 'y'], '/\\d\\+ms<CR>:%s//ZZ/<CR>', 'sub-last-search');
    expect(r.critiques.filter(c => c.you.startsWith('/'))).toEqual([]);
  });
});

describe('coach fix pass (review findings)', () => {
  /** Three rounds on one text so the cursor carries over (the app default). */
  const carried: RoundsChallenge = {
    kind: 'rounds',
    base: { text: ['abc def ghijklmnop', 'x'], name: 'a.ts', cursor: { line: 0, col: 0 } },
    rounds: [
      { goal: { cursor: { line: 0, col: 4 } }, solution: 'w' },
      { goal: { text: ['abc def ghijklmnp', 'x'] }, solution: 'fox' },
    ],
  };
  it('critiques a run in a round whose cursor was carried over', () => {
    const s = new Session(carried);
    let t = 0;
    s.key('w', (t += 50)); s.advance();
    expect(s.vim!.cursor).toEqual({ line: 0, col: 4 });
    for (const k of parseKeys('llllllllllllx')) s.key(k, (t += 50));
    expect(s.done).toBe(true);
    const r = coach(s, 'insert-mode');
    expect(r.critiques.find(c => c.you === 'llllllllllll' && c.unit === 1)).toBeDefined();
  });
  it('a later . reads the last change, so xiz<Esc> is not replaced by rz before it', () => {
    const r = play(['abc', 'def'], 'xiz<Esc>j0.');
    expect(r.critiques.some(c => c.better.some(b => b.keys === 'rz'))).toBe(false);
  });
  it('dot-repeat never suggests . for a yank', () => {
    const r = play(['ab cd ef gh'], 'veywwvey');
    expect(r.critiques.filter(c => c.better.some(b => b.rule === 'dot-repeat'))).toEqual([]);
  });
  // Rule tests run on a lesson past which A, I, o, dd and p are all taught.
  const late = 'counts-operators';
  it('rules starting with a motion reach the report: wwwwa!<Esc> → A!<Esc>', () => {
    const r = play(['ab cd ef gh i'], 'wwwwa!<Esc>', late); // wwww lands on the last character
    expect(r.critiques.some(c => c.better.some(b => b.keys === 'A!<Esc>'))).toBe(true);
  });
  it('one-key rules still show: A<CR>x<Esc> → ox<Esc>, ddjP → ddp, ^i → I, de+i → cw', () => {
    expect(play(['abc'], 'A<CR>new<Esc>', late).critiques.some(c => c.better.some(b => b.keys === 'onew<Esc>'))).toBe(true);
    expect(play(['a', 'b', 'c'], 'ddjP', late).critiques.some(c => c.better.some(b => b.keys === 'ddp'))).toBe(true);
    expect(play(['  abc'], '^i//<Esc>', late, { line: 0, col: 4 }).critiques.some(c => c.better.some(b => b.keys === 'I//<Esc>'))).toBe(true);
    expect(play(['abc def'], 'deixyz<Esc>', late).critiques.some(c => c.better.some(b => b.keys === 'cwxyz<Esc>'))).toBe(true);
  });
  it('stopping a macro recording does not silence the rest of the run', () => {
    const r = play(['abc def ghi jkl mno', 'abc def ghi jkl mno', 'abc def ghi jkl mno', 'x'], 'qajjq' + 'lllllllllx');
    expect(r.critiques.some(c => c.you === 'lllllllll')).toBe(true);
  });
  it('a bare <Esc> or a cancelled pending key is not part of the next run', () => {
    const r = play(['abcdefghijkl', 'x', 'y', 'z', 'w'], '<Esc>lllllllllx');
    expect(r.critiques.some(c => c.you.includes('<Esc>'))).toBe(false);
    expect(r.critiques.some(c => c.you === 'lllllllll')).toBe(true);
    const r2 = play(['abcdefghijkl', 'x'], 'd<Esc>lllllllllx');
    expect(r2.critiques.some(c => c.you.includes('d'))).toBe(false);
  });
  it('generated challenges: a motion run is not split when the nearest item changes', () => {
    const ch = CHALLENGES[0];
    const s = new Session(ch.challenge, { seed: 5 });
    let t = 0;
    for (const k of parseKeys('jjjjjjjjjjx')) s.key(k, (t += 50));
    const r = coach(s, ch.id);
    expect(r.critiques.some(c => c.you === 'jjjjjjjjjj')).toBe(true);
  });
});

describe('rule windows never cross a round boundary', () => {
  it('daw in round 1 and daw in round 2 are not one dot-repeat window', () => {
    const c: RoundsChallenge = {
      kind: 'rounds', base: { name: 'a.ts' },
      rounds: [
        { setup: { text: ['foo bar', 'baz'], cursor: { line: 0, col: 0 } }, goal: { text: ['bar', 'baz'] }, solution: 'daw' },
        { setup: { text: ['qux', 'quux corge'], cursor: { line: 1, col: 0 } }, goal: { text: ['qux', 'corge'] }, solution: 'daw' },
      ],
    };
    const s = new Session(c, { carryCursor: false });
    let t = 0;
    for (const r of c.rounds) { for (const k of solutionKeys(r.solution)) s.key(k, (t += 50)); if (!s.done) s.advance(); }
    expect(coach(s, 'counts-operators').critiques).toEqual([]);
  });
});

describe('coach: star and relative numbers', () => {
  it('suggests * once the search section is taught, not before', () => {
    const lines = ['foo bar', 'baz', 'qux', 'foo end'];
    const early = play(lines, 'jjjx', 'counts-operators', { line: 0, col: 0 }); // First Operators: * not taught yet
    expect(early.critiques.some(c => c.better.some(b => b.keys === '*'))).toBe(false);
    const late = play(lines, 'jjjx', 'clear-highlights', { line: 0, col: 0 });   // Search section
    expect(late.critiques.some(c => c.better.some(b => b.keys === '*'))).toBe(true);
  });
});

describe('chips: keys rendered from the engine, not a regex', () => {
  it('splits a reference into command keys and one text chip per insert', () => {
    const c: RoundsChallenge = { kind: 'rounds', base: { text: ['old in v1.1', 'x', 'y'], name: 'a.md', cursor: { line: 0, col: 0 } }, rounds: [{ goal: { text: ['DONE in v1.2', 'x', 'y'] }, solution: 'RDONE in v1.2<Esc>' }] };
    const s = new Session(c);
    let t = 0;
    for (const k of parseKeys('lllllllllllllllllllhhhhhhhhhhhhhhhhhhhRDONE in v1.2<Esc>')) s.key(k, (t += 50)); // a wasteful walk back to column 0, then the edit
    const r = coach(s, 'replace-mode');
    expect(r.reference[0]?.chips).toEqual([{ kind: 'key', v: 'R' }, { kind: 'text', v: 'DONE in v1.2' }, { kind: 'key', v: '<Esc>' }]);
    expect(r.reference[0]?.par).toBe(14);
  });
  it('find arguments and counts stay keys; typed digits inside insert are text', () => {
    expect(keyChips(createVim({ text: ['v1 = 1.0', 'x', 'y'], name: 'a.ts' }), parseKeys('f1R2.0<Esc>'))).toEqual([
      { kind: 'key', v: 'f' }, { kind: 'key', v: '1' }, { kind: 'key', v: 'R' }, { kind: 'text', v: '2.0' }, { kind: 'key', v: '<Esc>' },
    ]);
  });
});

describe('generated challenges: per-item par and the key summary', () => {
  it('items well over par get "par a, you b" lines, worst first, at most three', () => {
    const ch = CHALLENGES[0];
    const s = new Session(ch.challenge, { seed: 3 });
    let t = 0;
    // A novice: walks with j and l to every item, then fixes it with the reference keys.
    for (const item of s.generated!.items) {
      while (s.vim!.cursor.line < item.fixAt.line) s.key('j', (t += 50));
      s.key('0', (t += 50));
      while (s.vim!.cursor.col < item.fixAt.col) s.key('l', (t += 50));
      for (const k of solutionKeys(item.fixKeys)) s.key(k, (t += 50));
    }
    const rep = coach(s, ch.id);
    expect(rep.reference.length).toBeGreaterThan(0);
    expect(rep.reference.length).toBeLessThanOrEqual(3);
    for (const r of rep.reference) { expect(r.kind).toBe('item'); expect(r.you - r.par).toBeGreaterThanOrEqual(2); }
    const gaps = rep.reference.map(r => r.you - r.par);
    expect(gaps).toEqual([...gaps].sort((a, b) => b - a));
    expect(rep.summary.par).toBe(s.generated!.parKeys);
    expect(rep.summary.moving + rep.summary.typing + rep.summary.editing).toBe(rep.summary.keys);
    expect(rep.summary.moving).toBeGreaterThan(rep.summary.editing);
  });
});
