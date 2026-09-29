// Cuts a session key log into motion runs, edits and breaks. Positive classification: a
// motion run is built only from commands the engine reported as motions.
import type { LogEntry } from '../lessons/runtime';
import type { CommandKind } from '../vim/editor';
import type { Key } from '../vim/keys';
import type { Pos } from '../vim/types';

export type Segment =
  | { kind: 'motion'; unit: number; keys: Key[]; from: Pos; to: Pos; logStart: number; logEnd: number }
  | { kind: 'edit'; unit: number; keys: Key[]; from: Pos; logStart: number; logEnd: number; command: CommandKind }
  | { kind: 'break'; unit: number; keys: Key[]; logStart: number; logEnd: number; reason: 'undo' | 'error' | 'other' | 'modal' | 'cmdline' | 'boundary' | 'recording' };

const EDIT_KINDS = new Set<CommandKind>(['operator', 'action', 'insert', 'visual']);
const settled = (e: LogEntry) => e.after.mode === 'normal' && e.after.pending === 0;

export function segment(log: LogEntry[]): Segment[] {
  const out: Segment[] = [];
  let motion: (Segment & { kind: 'motion' }) | null = null;
  const flush = () => { if (motion) out.push(motion); motion = null; };
  const keysOf = (a: number, b: number) => log.slice(a, b + 1).map(e => e.key);

  let start = 0;
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    if (e.boundary && i > start) {
      // Keys that never completed a command before a round load / reset: not critiqued.
      flush();
      out.push({ kind: 'break', unit: log[start].unit, keys: keysOf(start, i - 1), logStart: start, logEnd: i - 1, reason: 'boundary' });
      start = i;
    }
    const cmd = e.command;
    if (!cmd) continue; // pending / insert / cmdline key: belongs to the command in progress
    const unit = log[start].unit;
    const from = log[start].before.pos;

    if (cmd.error) {
      flush();
      out.push({ kind: 'break', unit, keys: keysOf(start, i), logStart: start, logEnd: i, reason: 'error' });
      start = i + 1;
      continue;
    }
    if (cmd.kind === 'motion' && settled(e)) {
      const continues = motion && !log[start].boundary; // units only change at boundaries for rounds; generated runs span items
      if (continues) { motion!.keys.push(...keysOf(start, i)); motion!.to = e.after.pos; motion!.logEnd = i; }
      else { flush(); motion = { kind: 'motion', unit, keys: keysOf(start, i), from, to: e.after.pos, logStart: start, logEnd: i }; }
      start = i + 1;
      continue;
    }
    flush();
    if (cmd.kind === 'undo') {
      const last = out[out.length - 1];
      if (last && last.kind === 'edit') out[out.length - 1] = { kind: 'break', unit: last.unit, keys: last.keys, logStart: last.logStart, logEnd: last.logEnd, reason: 'undo' };
      out.push({ kind: 'break', unit, keys: keysOf(start, i), logStart: start, logEnd: i, reason: 'undo' });
      start = i + 1;
      continue;
    }
    if (EDIT_KINDS.has(cmd.kind) || (cmd.kind === 'motion' && !settled(e))) {
      // An edit runs until the buffer is back in normal mode with nothing pending (insert text,
      // visual motions, cmdline typed for an operator), or the next boundary.
      let end = i;
      while (!settled(log[end]) && end + 1 < log.length && !log[end + 1].boundary) end++;
      out.push({ kind: 'edit', unit, keys: keysOf(start, end), from, logStart: start, logEnd: end, command: log[end].command?.kind ?? cmd.kind });
      i = end;
      start = i + 1;
      continue;
    }
    const reason = cmd.kind === 'modal' ? 'modal' : cmd.kind === 'cmdline' ? 'cmdline' : 'other';
    out.push({ kind: 'break', unit, keys: keysOf(start, i), logStart: start, logEnd: i, reason });
    start = i + 1;
  }
  flush();
  if (start < log.length) out.push({ kind: 'break', unit: log[start].unit, keys: keysOf(start, log.length - 1), logStart: start, logEnd: log.length - 1, reason: 'other' });
  return out;
}
