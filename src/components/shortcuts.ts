/** What a key does on the results screen. */
export type ShortcutAction = 'reps-again' | 'back-to-lesson' | 'restart' | 'reps' | 'new-file' | 'warm-up-again' | 'next' | 'stats';

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
  return null;
}
