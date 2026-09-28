import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { SECTIONS } from '../../src/lessons';
import { createVim, mergeSetup } from '../../src/lessons/runtime';

it.runIf(!!process.env.OUT)('continuity', () => {
  const rows: string[] = [];
  let same = 0, cont = 0, fresh = 0, lessons = { same: 0, cont: 0, mixed: 0, fresh: 0 };
  for (const s of SECTIONS) for (const l of s.lessons) {
    const c = l.challenge;
    if (c.kind !== 'rounds') continue;
    let prevText: string | null = null, prevGoal: string | null = null;
    const kinds: string[] = [];
    c.rounds.forEach((r, i) => {
      const st = mergeSetup(c.base, r.setup);
      let text = '';
      try { text = createVim(st).buf.text(); } catch { /* */ }
      if (i > 0) {
        if (text === prevText) { kinds.push('same'); same++; }
        else if (prevGoal != null && text === prevGoal) { kinds.push('cont'); cont++; }
        else { kinds.push('fresh'); fresh++; }
      }
      prevText = text;
      prevGoal = r.goal.text == null ? text : Array.isArray(r.goal.text) ? r.goal.text.join('\n') : r.goal.text;
    });
    const k = new Set(kinds);
    const tag = k.size === 1 ? [...k][0] : k.size === 0 ? 'same' : k.has('fresh') ? 'mixed' : 'cont';
    (lessons as Record<string, number>)[tag]++;
    rows.push(`${tag.padEnd(6)} ${s.id}/${l.id}`);
  }
  writeFileSync(process.env.OUT!, `rounds: same ${same} continue ${cont} fresh ${fresh}\nlessons: ${JSON.stringify(lessons)}\n` + rows.join('\n'));
});
