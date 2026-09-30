// Exports plain-text rounds (no plugins, no init, no files) for checking in real Neovim, together with
// what the engine itself does with each one (text, cursor, registers, follow-up probes), plus the
// ad-hoc differential cases in cases.json. check.lua replays all of it and compares.
import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { SECTIONS } from '../../src/lessons';
import { createVim, mergeSetup } from '../../src/lessons/runtime';
import type { Setup } from '../../src/lessons/types';
import { parseKeys } from '../../src/vim/keys';
import { DEFAULT_OPTIONS, type Pos } from '../../src/vim/types';

/** Register type as the first character of getregtype() ('b' stands for <C-v>). */
const REGTYPE = { char: 'v', line: 'V', block: 'b' } as const;

type State =
  | { text: string; cursor: Pos; reg: { text: string; type: string }; regs: Record<string, string> }
  | { error: string };

/** Runs keys in the engine the way check.lua runs them in Neovim: the keys, then <Esc> unless back in Normal. */
function engine(setup: Setup, keys: string, regNames: string[]): State {
  try {
    const v = createVim(setup);
    for (const k of parseKeys(keys)) v.feed(k);
    if (v.mode !== 'normal' || v.pending.length) v.feed('<Esc>');
    const r = v.getRegister('"');
    const regs: Record<string, string> = {};
    for (const n of regNames) regs[n] = v.getRegister(n).text;
    return { text: v.buf.text(), cursor: { ...v.cursor }, reg: { text: r.text, type: REGTYPE[r.kind] }, regs };
  } catch (e) {
    return { error: String(e) };
  }
}

/** Follow-up probes: x always (catches cursor drift), p when the unnamed register holds something (register drift). */
function probes(setup: Setup, keys: string, s: State) {
  const out = ['x'];
  if ('reg' in s && s.reg.text !== '') out.push('p');
  return out.map(p => ({ keys: p, engine: engine(setup, keys + p, []) }));
}

/** Everything check.lua needs to rebuild the same starting state in Neovim. */
function start(st: Setup) {
  return {
    name: st.name ?? 'x.txt', search: st.search ?? '',
    text: Array.isArray(st.text) ? st.text.join('\n') : st.text ?? '',
    cursor: st.cursor ?? { line: 0, col: 0 }, options: { ...DEFAULT_OPTIONS, ...st.options },
    height: createVim(st).win.height,
  };
}

type Case = { id: string; text: string; keys: string; cursor?: Pos; name?: string; options?: Setup['options'] };

it.runIf(!!process.env.OUT)('export', () => {
  const rounds: unknown[] = [];
  for (const s of SECTIONS) for (const l of s.lessons) {
    const c = l.challenge;
    if (c.kind !== 'rounds') continue;
    c.rounds.forEach((r, i) => {
      const st = mergeSetup(c.base, r.setup);
      if (st.plugins?.length || st.init || st.files || st.folds || st.marks || r.goal.text == null) return;
      if (Object.keys(st.registers ?? {}).length) return;
      const regNames = Object.keys(r.goal.registers ?? {});
      const got = engine(st, r.solution, regNames);
      rounds.push({
        id: `${l.id}#${i + 1}`, ...start(st), keys: r.solution,
        want: Array.isArray(r.goal.text) ? r.goal.text.join('\n') : r.goal.text,
        regNames, engine: got, probes: probes(st, r.solution, got),
      });
    });
  }
  const list = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8')) as Case[];
  const cases = list.map(k => {
    const st: Setup = { text: k.text, cursor: k.cursor, name: k.name, options: k.options };
    const got = engine(st, k.keys, []);
    return { id: k.id, ...start(st), keys: k.keys, regNames: [], engine: got, probes: probes(st, k.keys, got) };
  });
  writeFileSync(process.env.OUT!, JSON.stringify({ rounds, cases }));
});
