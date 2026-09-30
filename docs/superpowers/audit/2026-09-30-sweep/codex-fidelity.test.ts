import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { ORDER, SECTIONS } from '../../../../src/lessons';
import { createVim, mergeSetup, goalMet, solutionKeys } from '../../../../src/lessons/runtime';
it('replays and classifies all registered rounds', () => {
 const rows:any[] = [], traces:any[] = [];
 for (const lesson of ORDER) {
  const c = lesson.challenge;
  if(c.kind !== 'rounds') continue;
  let total=0, buffer=0, cmdline=0, modeKeys=0;
  c.rounds.forEach((round,i) => {
   const vim=createVim(mergeSetup(c.base,round.setup));
   expect(goalMet(vim,round.goal),`${lesson.id}/${i+1} starts solved`).toBe(false);
   const keys=solutionKeys(round.solution), trace:any[]=[];
   for(const key of keys) {
    const mode=vim.mode;
    const textMode=['insert','replace','cmdline'].includes(mode);
    // Printable input is literal text. Mode exit, acceptance, completion,
    // register access and other control keys remain commands.
    const literal=textMode && key.length===1;
    total++; if(textMode) modeKeys++;
    if(literal) { if(mode==='cmdline') cmdline++; else buffer++; }
    trace.push({key,mode,modeCategory:textMode?'text-mode':'command-mode',category:literal?'typed-text':'command'});
    vim.feed(key);
   }
   expect(goalMet(vim,round.goal),`${lesson.id}/${i+1} fails`).toBe(true);
   traces.push({id:lesson.id,round:i+1,prompt:round.prompt,solution:round.solution,trace});
  });
  rows.push({id:lesson.id,title:lesson.title,section:SECTIONS.find(s=>s.lessons.includes(lesson))!.id,rounds:c.rounds.length,total,buffer,cmdline,modeKeys,typed:buffer+cmdline,share:(buffer+cmdline)/total,avg:(buffer+cmdline)/c.rounds.length});
 }
 const dir='docs/superpowers/audit/2026-09-30-sweep/';
 writeFileSync(dir+'codex-fidelity.trace.json',JSON.stringify({kinds:ORDER.reduce((a:any,l)=>{a[l.challenge.kind]=(a[l.challenge.kind]||0)+1;return a},{}),rows,traces},null,2)+'\n');
 const sorted=[...rows].sort((a,b)=>b.share-a.share||b.avg-a.avg);
 const table=(rs:any[])=>['| Lesson | Rounds | Total keys | Buffer chars | Cmdline chars | Typed-text share | Avg typed chars/round | All text-mode keys |','|---|---:|---:|---:|---:|---:|---:|---:|',...rs.map(r=>`| ${r.id} | ${r.rounds} | ${r.total} | ${r.buffer} | ${r.cmdline} | ${(100*r.share).toFixed(1)}% | ${r.avg.toFixed(2)} | ${r.modeKeys} |`)].join('\n');
 writeFileSync(dir+'codex-fidelity.data.md','# Fidelity measurements\n\nRegistry order; every reference solution replayed against its goal. Printable keys in pre-key insert/replace/cmdline mode count as typed text. Special keys are commands; the final column includes ALL keys in those modes (including Esc/CR/control keys) for the literal mode-based interpretation. Buffer and cmdline counts are separate because Ex syntax/search input is often the taught skill. Normal-mode r replacements, f arguments, macro replay, paste, completion and dot-generated text are not manual insert-mode typing. Counts measure solution effort, not user behavior or required minimum effort.\n\nReproduce: `npx vitest run docs/superpowers/audit/2026-09-30-sweep/codex-fidelity.test.ts`. Per-key classifications: `codex-fidelity.trace.json`.\n\n'+table(rows)+'\n\n## Ranked by typed share, then average typed chars\n\n'+table(sorted)+'\n');
 console.log(JSON.stringify({lessons:rows.length,rounds:rows.reduce((a,r)=>a+r.rounds,0),total:rows.reduce((a,r)=>a+r.total,0),typed:rows.reduce((a,r)=>a+r.typed,0),top:sorted.slice(0,15),distribution:rows.reduce((a:any,r)=>{a[r.rounds]=(a[r.rounds]||0)+1;return a}, {})},null,2));
});
