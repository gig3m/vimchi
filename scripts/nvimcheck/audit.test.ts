import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { SECTIONS } from '../../src/lessons';
import { mergeSetup, createVim } from '../../src/lessons/runtime';

it.runIf(!!process.env.OUT)('audit', () => {
  const long: string[] = [], single: string[] = [], forbid: string[] = [];
  for (const s of SECTIONS) for (const l of s.lessons) {
    const c = l.challenge;
    const texts: string[][] = [];
    if (c.kind === 'rounds') {
      c.rounds.forEach((r, i) => {
        const st = mergeSetup(c.base, r.setup);
        let lines: string[] = [];
        try { lines = createVim(st).buf.lines.slice(); } catch { /* */ }
        texts.push(lines);
        if (lines.length === 1) single.push(`${s.id}/${l.id}#${i + 1}`);
        if (r.forbid) forbid.push(`${s.id}/${l.id}#${i + 1}`);
      });
    } else if ('code' in c) texts.push(c.code);
    const max = Math.max(0, ...texts.flat().map(t => t.length));
    if (max > 60) long.push(`${s.id}/${l.id} max=${max}`);
  }
  writeFileSync(process.env.OUT!, JSON.stringify({ long, single, forbid }, null, 1));
});
