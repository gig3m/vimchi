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
/** Profile has its own URL, so Back from it returns to where the learner was. */
export const PROFILE_HREF = '#profile';

export type Route = {
  view: 'lesson' | 'profile' | 'warm-up';
  /** The lesson a lesson route names; null = the app picks one (the last lesson, or the first). */
  id: string | null;
  /** False for an empty or unknown hash: the app should replace it with the page it shows. */
  canonical: boolean;
};
/** What a hash shows: a lesson (`#id`, `#id?seed=N`, `#id?reps=N`), the Warm-up, or Profile. */
export function routeFromHash(hash: string, isLesson: (id: string) => boolean): Route {
  const id = lessonIdFromHash(hash);
  if (id === WARMUP_ROUTE) return { view: 'warm-up', id: null, canonical: true };
  if ('#' + id === PROFILE_HREF) return { view: 'profile', id: null, canonical: true };
  if (id && isLesson(id)) return { view: 'lesson', id, canonical: true };
  return { view: 'lesson', id: null, canonical: false };
}
export const warmUpHref = (seed?: number) => (seed == null ? `#${WARMUP_ROUTE}` : seedHref(WARMUP_ROUTE, seed));
