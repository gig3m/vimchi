// Exports plain-text rounds (no plugins, no init, no files) for checking in real Neovim.
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { SECTIONS } from '../../src/lessons';
import { mergeSetup } from '../../src/lessons/runtime';

it.runIf(!!process.env.OUT)('export', () => {
  const out: unknown[] = [];
  for (const s of SECTIONS) for (const l of s.lessons) {
    const c = l.challenge;
    if (c.kind !== 'rounds') continue;
    c.rounds.forEach((r, i) => {
      const st = mergeSetup(c.base, r.setup);
      if (st.plugins?.length || st.init || st.files || st.folds || st.marks || r.goal.text == null) return;
      if (Object.keys(st.registers ?? {}).length || st.search) return;
      out.push({
        id: `${l.id}#${i + 1}`, name: st.name ?? 'x.txt',
        text: Array.isArray(st.text) ? st.text.join('\n') : st.text ?? '',
        cursor: st.cursor ?? { line: 0, col: 0 }, options: st.options ?? {},
        keys: r.solution, want: Array.isArray(r.goal.text) ? r.goal.text.join('\n') : r.goal.text,
      });
    });
  }
  writeFileSync(process.env.OUT!, JSON.stringify(out));
});
