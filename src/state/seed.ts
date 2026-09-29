// `#<lesson-id>?seed=N` replays one exact generated challenge.
export function lessonIdFromHash(hash: string): string {
  return decodeURIComponent(hash.replace(/^#\/?/, '').split('?')[0]);
}

export function seedFromHash(hash: string): number | null {
  const q = hash.split('?')[1];
  if (!q) return null;
  const v = new URLSearchParams(q).get('seed');
  if (v === null || !/^\d{1,10}$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n < 0x100000000 ? n : null;
}

export const seedHref = (id: string, seed: number) => `#${id}?seed=${seed}`;
