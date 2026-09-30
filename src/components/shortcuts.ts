/** What a key does on the results screen. */
export type ShortcutAction = 'reps-again' | 'back-to-lesson' | 'restart' | 'reps' | 'new-file' | 'warm-up-again' | 'next' | 'stats' | 'scroll-down' | 'scroll-up';

export type ShortcutCtx = {
  /** Playing a lesson's Reps (`#id?reps=N`). */
  inReps: boolean;
  /** Playing the Warm-up (`#warm-up`). */
  inWarmUp: boolean;
  /** The lesson has Reps to offer. */
  hasReps: boolean;
  /** The finished file came from a seed (a generated challenge). */
  hasSeed: boolean;
  /** There is a next lesson. */
  hasNext: boolean;
};

/** The results screen's single-key shortcuts; null = the key does nothing here. */
export function resultsShortcut(key: string, c: ShortcutCtx): ShortcutAction | null {
  if (c.inReps && (key === '<CR>' || key === 'a')) return 'reps-again';
  if (c.inReps && key === 'b') return 'back-to-lesson';
  if (key === '<CR>' || key === 'r') return 'restart';
  if (!c.inReps && key === 'p' && c.hasReps) return 'reps';
  // Warm-up's file is pinned to its seed (checked for reach and lesson coverage): a new file is a new Warm-up.
  if (key === 'f' && c.hasSeed) return c.inReps ? 'reps-again' : c.inWarmUp ? 'warm-up-again' : 'new-file';
  // Reps show no Next button, so n does nothing there.
  if (key === 'n' && c.hasNext && !c.inReps) return 'next';
  if (key === 's') return 'stats';
  // The Better ways list scrolls on its own; focus stays on the editor, so it gets Vim's keys.
  if (key === 'j' || key === '<Down>') return 'scroll-down';
  if (key === 'k' || key === '<Up>') return 'scroll-up';
  return null;
}

/**
 * Whether Tab / Shift-Tab goes to the browser (moves focus) instead of the editor. Vim takes it in
 * Insert mode, on the command line and in a modal; the quiz takes it; on the Results screen it
 * always moves focus on, to the Better ways list and the result buttons.
 */
export function tabToBrowser(key: string, c: { vimWantsTab: boolean; done: boolean; quiz: boolean }): boolean {
  if (key !== '<Tab>' && key !== '<S-Tab>') return false;
  return c.done || (!c.vimWantsTab && !c.quiz);
}
