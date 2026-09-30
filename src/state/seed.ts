// `#warm-up` opens the Warm-up (`#warm-up?seed=N` replays one).
// `#<lesson-id>?seed=N` replays one exact generated challenge; `#<lesson-id>?reps=N` opens the
// lesson's Reps on seed N.
export function lessonIdFromHash(hash: string): string {
  return decodeURIComponent(hash.replace(/^#\/?/, '').split('?')[0]);
}

/** A 32-bit unsigned integer query parameter of the hash, or null. */
function param(hash: string, name: string): number | null {
  const q = hash.split('?')[1];
  if (!q) return null;
  const v = new URLSearchParams(q).get(name);
  if (v === null || !/^\d{1,10}$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n < 0x100000000 ? n : null;
}

export const seedFromHash = (hash: string): number | null => param(hash, 'seed');
export const repsFromHash = (hash: string): number | null => param(hash, 'reps');

export const seedHref = (id: string, seed: number) => `#${id}?seed=${seed}`;
export const repsHref = (id: string, seed: number) => `#${id}?reps=${seed}`;
/** A fresh 32-bit seed. */
export const newSeed = () => Math.floor(Math.random() * 0x100000000);

/** The Warm-up's route id (also the lesson id its runs are saved under). */
export const WARMUP_ROUTE = 'warm-up';
export const isWarmUpHash = (hash: string) => lessonIdFromHash(hash) === WARMUP_ROUTE;
export const warmUpHref = (seed?: number) => (seed == null ? `#${WARMUP_ROUTE}` : seedHref(WARMUP_ROUTE, seed));
