// The taught key must be the best route. For every cursor-goal round, a breadth-first search over
// the untaught motions must not find a strictly shorter way to the target; for text-goal rounds,
// generic edits (x, dd, J, p, ~ …) must not reach the goal in fewer keys. Par is the reference
// length, so a shortcut the lesson did not teach makes par a lie and rewards skipping the lesson.
// The search takes ~100 s, so it runs on demand: `npm run routes` (ROUTES=1), not with `npm test`.
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '..';
import { createVim, goalMet, mergeSetup, solutionKeys } from '../runtime';
import type { Pos } from '../../vim/types';

/** Rounds whose shortcut is accepted on purpose (`lesson r<n>`), with the reason beside them. */
const ALLOW = new Set<string>([]);

const chipKey = (c: string) => c.replace(/^C-(.)$/, '<C-$1>').replace(/^A-(.)$/, '<A-$1>');
const BASE_MOTIONS = ['h', 'j', 'k', 'l', 'w', 'b', 'e', 'W', 'B', 'E', '0', '^', '$', 'gg', 'G', '{', '}', '%', 'H', 'M', 'L'];
const GENERIC_EDITS = ['x', 'X', 'dd', 'D', 'J', 'p', 'P', '~', 'u', 'h', 'j', 'k', 'l', 'w', 'b', 'e', '0', '$', 'dw'];

let cache: { cursorHits: string[]; editHits: string[] } | null = null;
function sweep() {
  if (cache) return cache;
  const cursorHits: string[] = [], editHits: string[] = [];
  for (const sec of SECTIONS) for (const l of sec.lessons) {
    const c = l.challenge;
    if (c.kind !== 'rounds') continue;
    const chips = l.chips.map(chipKey);
    const banned = (k: string) => chips.some(ch => ch === k || (ch.length === 1 && 'fFtT;,'.includes(ch) && /^[fFtT;,]/.test(k)));
    c.rounds.forEach((r, i) => {
      const tag = `${l.id} r${i + 1}`;
      if (ALLOW.has(tag)) return;
      const setup = mergeSetup(c.base, r.setup);
      const solLen = solutionKeys(r.solution).length;
      const g = r.goal;
      const vim0 = createVim(setup);
      const cursorOnly = g.cursor && g.text == null && !g.check && !g.buffer && !g.files && !g.registers;
      const textUnchanged = () => { const v = createVim(setup); v.feedKeys(r.solution); return v.buf.text() === vim0.buf.text(); };
      if (cursorOnly && solLen <= 5 && textUnchanged()) {
        const lines = vim0.buf.lines;
        const acts = (p: Pos) => {
          const a = [...BASE_MOTIONS];
          for (const n of '23456789') for (const m of 'hjklwbeWBE') a.push(n + m);
          for (const ch of new Set(lines[p.line])) if (ch !== ' ' && ch !== '<') for (const f of 'fFtT') a.push(f + ch);
          return a.filter(k => !banned(k));
        };
        const key = (p: Pos) => `${p.line}:${p.col}`;
        const dist = new Map<string, number>([[key(vim0.cursor), 0]]);
        const routeOf = new Map<string, string>([[key(vim0.cursor), '']]);
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
            const k = key(v.cursor);
            const r2 = routeOf.get(key(f.p))! + a;
            if (k === key(g.cursor!)) { if (found < 0 || cost < found) { found = cost; route = r2; } continue; }
            if ((dist.get(k) ?? 1e9) <= cost) continue;
            dist.set(k, cost); routeOf.set(k, r2);
            next.push({ p: { ...v.cursor }, want: v.win.want, top: v.win.top, d: cost });
          }
          frontier = next;
        }
        if (found >= 0) cursorHits.push(`${tag}: ${r.solution} (${solLen}) beaten by ${route} (${found})`);
      } else if (g.text != null && solLen >= 2) {
        const vocab = GENERIC_EDITS.filter(k => !banned(k));
        const maxCost = Math.min(solLen - 1, 3);
        const seen = new Set<string>();
        let frontier: { path: string; cost: number }[] = [{ path: '', cost: 0 }];
        let hit = '';
        outer: for (let depth = 0; depth < 4; depth++) {
          const next: typeof frontier = [];
          for (const f of frontier) for (const a of vocab) {
            const cost = f.cost + a.length;
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
