// Rebuild the engine state at any point of a logged unit, and compare outcomes.
import { type LogEntry, createVim } from '../lessons/runtime';
import type { Setup } from '../lessons/types';
import type { Vim } from '../vim/editor';

export type SessionLike = { log(): LogEntry[]; setupFor(unit: number): Setup; unitStart(unit: number): number };

/** A scratch Vim in the state just before log index i: setup rebuilt, the unit's keys up to i-1 fed. */
export function stateBefore(s: SessionLike, i: number): Vim {
  const log = s.log();
  const unit = log[i]?.unit ?? log[log.length - 1].unit;
  const vim = createVim(s.setupFor(unit));
  const start = s.unitStart(unit);
  // The attempt may have started with a carried-over cursor, not the setup's.
  if (log[start]) { vim.win.cursor = { ...log[start].before.pos }; vim.win.want = log[start].before.want; }
  for (let k = start; k < i; k++) vim.feed(log[k].key);
  return vim;
}

export type StateNeeds = { register: boolean; lastFind: boolean; search: boolean; lastChange: boolean };

const READS_REGISTER = /^(?:"[^"]?)?[0-9]*[pP]$/;
const READS_FIND = /^[0-9]*[;,]$/;
const READS_SEARCH = /^[0-9]*(?:n|N|cgn|cgN|dgn|g&|&)$|^:[%0-9,.$'a-z]*s\//;
const READS_CHANGE = /^[0-9]*\.$/;
const WRITES_REGISTER = /^(?:"[^"]?)?[0-9]*(?:[xXdDcCsSyY]|dd|yy|cc)/;
const WRITES_FIND = /^[0-9]*[ftFT]./;
const WRITES_SEARCH = /^[/?*#]/;

/** Which state a suggestion must preserve: read by a later command in the unit before any command overwrites it. */
export function stateNeeds(log: LogEntry[], afterIndex: number, _unit: number): StateNeeds {
  const needs: StateNeeds = { register: false, lastFind: false, search: false, lastChange: false };
  const open = { register: true, lastFind: true, search: true, lastChange: true };
  for (let i = afterIndex + 1; i < log.length; i++) {
    const e = log[i];
    if (e.boundary) break; // rounds: a unit change is always a boundary; generated: one buffer, one unit

    if (!e.command || e.command.error) continue;
    const k = e.command.keys.join('');
    if (open.register && READS_REGISTER.test(k)) needs.register = true;
    if (open.lastFind && READS_FIND.test(k)) needs.lastFind = true;
    if (open.search && READS_SEARCH.test(k)) needs.search = true;
    if (open.lastChange && READS_CHANGE.test(k)) needs.lastChange = true;
    if (WRITES_REGISTER.test(k)) open.register = false;
    if (WRITES_FIND.test(k)) open.lastFind = false;
    if (WRITES_SEARCH.test(k)) open.search = false;
    if (e.command.kind === 'operator' || e.command.kind === 'action' || e.command.kind === 'insert') open.lastChange = false;
  }
  return needs;
}

/** Text, cursor and mode always; plus whichever state a later command needs. */
export function sameOutcome(a: Vim, b: Vim, needs: StateNeeds): boolean {
  if (a.buf.text() !== b.buf.text()) return false;
  if (a.cursor.line !== b.cursor.line || a.cursor.col !== b.cursor.col) return false;
  if (a.mode !== b.mode) return false;
  if (needs.register && a.getRegister('"').text !== b.getRegister('"').text) return false;
  if (needs.lastFind && JSON.stringify(a.lastFind) !== JSON.stringify(b.lastFind)) return false;
  if (needs.search && a.search.pattern !== b.search.pattern) return false;
  if (needs.lastChange && JSON.stringify(a.lastChange?.body ?? null) !== JSON.stringify(b.lastChange?.body ?? null)) return false;
  return true;
}
