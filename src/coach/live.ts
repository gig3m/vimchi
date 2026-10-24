// Which segments a live hint may critique: only ones the learner has finished. A motion run
// is closed when something other than a motion follows it (or the round ends); an edit is
// closed when the editor is back in normal mode with nothing pending. Critiquing a run that is
// still growing produces a different hint on every key.
import type { LogEntry } from '../lessons/runtime';
import type { Segment } from './segment';

export function closedSegments(segs: Segment[], log: LogEntry[], closing: boolean): number[] {
  const last = log[log.length - 1];
  const settled = !!last && last.after.mode === 'normal' && last.after.pending === 0;
  const out: number[] = [];
  segs.forEach((seg, i) => {
    if (seg.kind === 'break') return;
    if (i < segs.length - 1) { out.push(i); return; }
    if (closing || (seg.kind === 'edit' && settled)) out.push(i);
  });
  return out;
}

/** The live hint line for the round on screen. A hint from the round just finished stays, labelled
 * with its round ("Round 3: …"), so it still reads as about that round; an older one is dropped. */
export function nudgeLine(nudge: { text: string; unit: number } | null, current: number, label: (unit: number) => string): string | null {
  if (!nudge || nudge.unit < current - 1) return null;
  return nudge.unit === current ? nudge.text : `${label(nudge.unit)}: ${nudge.text}`;
}
