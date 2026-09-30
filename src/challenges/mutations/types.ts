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
  /**
   * The fix is more than one change (a yank and a put, a macro, several `cgn`s, an Ex command),
   * so `.` cannot replay it: the par never turns a repeat of it into `.`.
   */
  multi?: boolean;
  /** The fix works from any cursor position (an Ex command over the file): the par adds no motion. */
  anywhere?: boolean;
  /**
   * The fix records macro `a` with this body and runs it over `runs` lines. A later item with the
   * same body replays the register (`<runs>@a`) instead of recording it again.
   */
  macro?: { body: string; runs: number };
  /**
   * Text this mutation's fix searches for across the file (a misspelt name for `*` / `:%s`). No
   * other item of the run may put this text in the file, nor may this one put theirs.
   */
  claims?: string[];
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
  /**
   * At most one item of this kind per run: its fix acts on the whole file (`:g`, `:%s` over a
   * shared pattern), so a second item of the kind would be fixed by the first one's command.
   */
  once?: boolean;
  /**
   * Relative chance of being drawn (default 1). The ladder's own kinds are drawn more often than
   * the kinds they keep from earlier rungs, and big multi-line kinds need the early picks to fit.
   */
  weight?: number;
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
