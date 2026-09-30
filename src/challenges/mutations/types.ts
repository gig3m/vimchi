import type { Rng } from '../rng';

/** A region in the ORIGINAL text. */
export type Site = { line: number; col: number; len: number };

export type Mutation = {
  kind: string;
  site: Site;
  /**
   * Lines replacing the `span` original lines from site.line: fewer (removed), as many
   * (changed) or more (lines inserted after the first).
   */
  lines: string[];
  /** Original lines replaced, from site.line (default 1). */
  span?: number;
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
  /**
   * Present on kinds that can repeat one edit on several lines (the same junk line, the same
   * stray word, the same wrong word) so `.` repeats the fix. True when site `b` can carry the
   * edit made at `a`. apply() must be a pure function of (lines, site, rng draws): the
   * generator replays the first member's draws at the others.
   */
  repeat?(lines: readonly string[], a: Site, b: Site): boolean;
  /** Chance a pick of this kind becomes a repeated group (default REPEAT_P); runs use 1. */
  repeatP?: number;
  /** Plugins the fix needs (the editor and the tests enable them). */
  plugins?: string[];
};

/** The mutated file: original with lines site.line .. site.line + span - 1 replaced by m.lines. */
export function applyMutation(lines: readonly string[], m: Mutation): string[] {
  return [...lines.slice(0, m.site.line), ...m.lines, ...lines.slice(m.site.line + (m.span ?? 1))];
}

/** Word-ish tokens with their columns. */
export function words(line: string): { col: number; text: string }[] {
  return [...line.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].map(m => ({ col: m.index!, text: m[0] }));
}

/** Escape a string for use inside Vim key notation (only '<' needs it). */
export const keyText = (s: string) => s.replace(/</g, '<lt>');
