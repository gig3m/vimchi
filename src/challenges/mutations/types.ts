import type { Rng } from '../rng';

/** A region in the ORIGINAL text. */
export type Site = { line: number; col: number; len: number };

export type Mutation = {
  kind: string;
  site: Site;
  /** Lines replacing original line site.line: 0 (removed), 1 (changed) or 2 (line inserted after). */
  lines: string[];
  /** Cursor in the MUTATED file, relative to site.line, from which fixKeys restores the original. */
  fixAt: { dline: number; col: number };
  /** Vim keys (parseKeys notation) that restore the original from fixAt. Motion-free. */
  fixKeys: string;
  /** Time allowance for the edit itself, ms (motion time is added by the generator). */
  parMs: number;
  checklist: string;
};

export type MutationKind = {
  id: string;
  sites(lines: readonly string[]): Site[];
  /** null when no valid mutation exists at this site (rule 4: never a no-op). */
  apply(lines: readonly string[], site: Site, rng: Rng): Mutation | null;
};

/** The mutated file: original with line site.line replaced by m.lines. */
export function applyMutation(lines: readonly string[], m: Mutation): string[] {
  return [...lines.slice(0, m.site.line), ...m.lines, ...lines.slice(m.site.line + 1)];
}

/** Word-ish tokens with their columns. */
export function words(line: string): { col: number; text: string }[] {
  return [...line.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].map(m => ({ col: m.index!, text: m[0] }));
}

/** Escape a string for use inside Vim key notation (only '<' needs it). */
export const keyText = (s: string) => s.replace(/</g, '<lt>');
