// The taught key must be the best route. For every cursor-goal round, a breadth-first search over
// the untaught motions must not find a strictly shorter way to the target; for text-goal rounds,
// generic edits (x, dd, J, p, ~ …) must not reach the goal in fewer keys. Par is the reference
// length, so a shortcut the lesson did not teach makes par a lie and rewards skipping the lesson.
// The search takes ~100 s, so it runs on demand: `npm run routes` (ROUTES=1), not with `npm test`.
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '..';
import { createVim, goalMet, mergeSetup, solutionKeys } from '../runtime';
import type { Pos } from '../../vim/types';
import { commandTokens, taughtBy } from '../../coach/vocab';

/** Rounds whose shortcut is accepted on purpose (`lesson r<n>`), with the reason beside them. */
const ALLOW = new Set<string>([
  // Joining a three-line paragraph from its middle: kJJ is a fine answer too. The round is about
  // vip handing : a range, and a paragraph long enough to beat kJJ would not fit on one goal line.
  'visual-ranges r4',
  // n then a find reaches the end of any match in as many keys or fewer (every pattern in the
  // options file was tried). The round is about reusing the last pattern with a new offset.
  'search-offsets r5',
  // LazyVim's mini.surround keys carry the gs prefix (s is flash), so a find is four keys and a
  // three-key hop can beat it. The round is about landing on the bracket by name, not the hop.
  'find-surroundings r1',
  'find-surroundings r2',
  'find-surroundings r4',
  'find-surroundings r5',
]);

const chipKey = (c: string) => c.replace(/^C-(.)$/, '<C-$1>').replace(/^A-(.)$/, '<A-$1>');
const BASE_MOTIONS = ['h', 'j', 'k', 'l', 'w', 'b', 'e', 'ge', 'W', 'B', 'E', '0', '^', '$', 'gg', 'G', '{', '}', '(', ')', '%', 'H', 'M', 'L', 'n', 'N', '*', '#', ';', ',', '+', '-', '<C-d>', '<C-u>'];
const GENERIC_EDITS = ['x', 'X', 'dd', 'D', 'J', 'p', 'P', '~', 'u', 'h', 'j', 'k', 'l', 'w', 'b', 'e', '0', '$', 'dw', 'cw', '.'];
/** One-character edits tried with every character on the cursor line (r and s are one key each). */
const CHAR_EDITS = ['r', 's'];

let cache: { cursorHits: string[]; editHits: string[] } | null = null;
function sweep() {
  if (cache) return cache;
  const cursorHits: string[] = [], editHits: string[] = [];
  for (const sec of SECTIONS) for (const l of sec.lessons) {
    const c = l.challenge;
    if (c.kind !== 'rounds') continue;
    const chips = l.chips.map(chipKey);
    // A shortcut is a key the learner already has: taught before this lesson and not this lesson's own.
    const known = taughtBy(l.id);
    const own = new Set(chips);
    const usable = (k: string) => {
      const toks = commandTokens(solutionKeys(k));
      return toks.length > 0 && toks.every(t => known.has(t) && !own.has(t)) && !(/^[0-9]/.test(k) && !known.has('COUNT'));
    };
    c.rounds.forEach((r, i) => {
      const tag = `${l.id} r${i + 1}`;
      if (ALLOW.has(tag)) return;
      const setup = mergeSetup(c.base, r.setup);
      const solLen = solutionKeys(r.solution).length;
      const g = r.goal;
      const vim0 = createVim(setup);
      const cursorOnly = g.cursor && g.text == null && !g.check && !g.buffer && !g.files && !g.registers;
      const textUnchanged = () => { const v = createVim(setup); v.feedKeys(r.solution); return v.buf.text() === vim0.buf.text(); };
      if (cursorOnly && solLen <= 7 && textUnchanged()) {
        const lines = vim0.buf.lines;
        const acts = (p: Pos) => {
          const a = [...BASE_MOTIONS];
          // Counts a person really types: up to 3 on line and word motions, never on h/l (nobody counts columns).
          for (const n of '23') for (const m of 'jkwbeWBE') a.push(n + m);
          for (const ch of new Set(lines[p.line])) if (ch !== ' ' && ch !== '<') for (const f of 'fFtT') a.push(f + ch);
          return a.filter(usable);
        };
        const key = (p: Pos, want = p.col) => `${p.line}:${p.col}:${want === Infinity ? '$' : want}`;
        const dist = new Map<string, number>([[key(vim0.cursor, vim0.win.want), 0]]);
        const routeOf = new Map<string, string>([[key(vim0.cursor, vim0.win.want), '']]);
        let frontier = [{ p: { ...vim0.cursor }, want: vim0.win.want, top: vim0.win.top, d: 0 }];
        let found = -1, route = '';
        // Motions only move the cursor and the viewport, so one editor per round is enough.
        const v = createVim(setup);
        for (let depth = 0; depth < solLen && found < 0; depth++) {
          const next: typeof frontier = [];
          for (const f of frontier) for (const a of acts(f.p)) {
            const cost = f.d + a.length;
            if (cost >= solLen) continue; // only strictly shorter routes matter
            v.win.cursor = { ...f.p }; v.win.want = f.want; v.win.top = f.top;
            try { v.feedKeys(a); } catch { continue; }
            if (v.mode !== 'normal' || v.pending.length) { v.feed('<Esc>'); continue; }
            const k = key(v.cursor, v.win.want);
            const r2 = routeOf.get(key(f.p, f.want))! + a;
            if (v.cursor.line === g.cursor!.line && v.cursor.col === g.cursor!.col) { if (found < 0 || cost < found) { found = cost; route = r2; } continue; }
            if ((dist.get(k) ?? 1e9) <= cost) continue;
            dist.set(k, cost); routeOf.set(k, r2);
            next.push({ p: { ...v.cursor }, want: v.win.want, top: v.win.top, d: cost });
          }
          frontier = next;
        }
        if (found >= 0) cursorHits.push(`${tag}: ${r.solution} (${solLen}) beaten by ${route} (${found})`);
      } else if (g.text != null && solLen >= 2) {
        const chars = new Set(vim0.buf.lines.flatMap(l => [...l])); chars.delete(' ');
        const vocab = [...GENERIC_EDITS, ...CHAR_EDITS.flatMap(e => [...chars].map(ch => e + ch + (e === 's' ? '<Esc>' : '')))].filter(usable);
        const maxCost = Math.min(solLen - 1, 3);
        const seen = new Set<string>();
        let frontier: { path: string; cost: number }[] = [{ path: '', cost: 0 }];
        let hit = '';
        outer: for (let depth = 0; depth < 4; depth++) {
          const next: typeof frontier = [];
          for (const f of frontier) for (const a of vocab) {
            const cost = f.cost + solutionKeys(a).length - (a.endsWith('<Esc>') ? 0 : 0);
            if (cost > maxCost) continue;
            const v = createVim(setup);
            try { v.feedKeys(f.path + a); } catch { continue; }
            if (goalMet(v, g)) { hit = f.path + a; break outer; }
            const k = `${v.buf.text()}|${v.cursor.line}:${v.cursor.col}`;
            if (seen.has(k)) continue;
            seen.add(k);
            next.push({ path: f.path + a, cost });
          }
          frontier = next;
        }
        if (hit) editHits.push(`${tag}: ${r.solution} (${solLen}) beaten by ${hit}`);
      }
    });
  }
  return (cache = { cursorHits, editHits });
}

describe.skipIf(!process.env.ROUTES)('the taught key is the shortest route', () => {
  it('no cursor round has a strictly shorter untaught route', () => { expect(sweep().cursorHits).toEqual([]); }, 300_000);
  it('no text round is reached by generic edits in fewer keys', () => { expect(sweep().editHits).toEqual([]); }, 300_000);
});
