// The Warm-up challenge: ONE generated file whose kinds are the union of the picked lessons'
// Reps kinds. The generator draws kinds, not lessons, so a pick is not guaranteed its edit; the
// build tries every corpus file on the run's seed and keeps the one that reaches the edit count
// and gives an edit to the most picked lessons (generate is deterministic, so the Session that
// runs this challenge on the same seed gets exactly that file).
import { CORPUS } from '../challenges/corpus';
import { type Generated, generate } from '../challenges/generate';
import { KINDS } from '../challenges/mutations';
import { JOINED, repsChallenge } from '../challenges/reps';
import { mulberry32, shuffle } from '../challenges/rng';
import type { CorpusFile, GeneratedChallenge } from '../lessons/types';
import type { WarmUpPick } from './select';

export const MIN_EDITS = 8;
export const MAX_EDITS = 10;

const uniq = <T>(xs: T[]) => [...new Set(xs)];

const produced = new Map<string, Set<string>>();
/**
 * The checklist kinds a mutation kind produces (a `-run` kind's items carry its base kind, e.g.
 * `wrong-word-run` -> `wrong-word`), found by applying it to corpus sites.
 */
export function itemKinds(id: string): Set<string> {
  let out = produced.get(id);
  if (out) return out;
  out = new Set([id]);
  const rng = mulberry32(1);
  for (const f of CORPUS) for (const site of KINDS[id].sites(f.lines).slice(0, 12)) {
    const m = KINDS[id].apply(f.lines, site, rng);
    if (m) out.add(m.kind);
  }
  produced.set(id, out);
  return out;
}

/** How many picks have at least one edit of their own kinds in the run. */
export const coverage = (picks: WarmUpPick[], g: Generated) => {
  const kinds = new Set(g.items.map(i => i.kind));
  return picks.filter(p => p.lesson.reps!.mutations.some(m => [...itemKinds(m)].some(k => kinds.has(k)))).length;
};

/** Lexicographic: the first differing entry decides. */
const better = (a: number[], b: number[]) => {
  const i = a.findIndex((v, j) => v !== b[j]);
  return i >= 0 && a[i] > b[i];
};

const cache = new Map<string, GeneratedChallenge>();

export function warmUpChallenge(picks: WarmUpPick[], seed: number): GeneratedChallenge {
  if (!picks.length) throw new Error('Warm-up: nothing to review');
  const key = picks.map(p => p.lesson.id).join(',') + '@' + seed;
  const hit = cache.get(key);
  if (hit) return hit;
  const reps = picks.map(p => repsChallenge(p.lesson));
  const mutations = uniq(reps.flatMap(r => r.mutations));
  const plugins = uniq(reps.flatMap(r => r.plugins ?? []));
  const n = Math.max(MIN_EDITS, Math.min(MAX_EDITS, picks.length)); // editsFor
  const c: GeneratedChallenge = {
    kind: 'generated',
    skills: uniq(['warm-up', ...reps.flatMap(r => r.skills.filter(s => s !== 'reps'))]),
    mutations,
    corpus: CORPUS,
    edits: [n, n],
    sections: uniq(reps.flatMap(r => r.sections)),
    ...(plugins.length && { plugins }),
    // With one or two kinds the mix cap (half the run per kind) could not fill the run.
    ...(mutations.length < 3 && { drill: true }),
  };
  const files = shuffle(mulberry32(seed ^ 0x9e3779b9), [...CORPUS, ...JOINED])
    .filter(f => mutations.some(m => KINDS[m].sites(f.lines).length > 0));
  let best: { f: CorpusFile; score: number[] } | null = null;
  for (const f of files) {
    const g = generate({ ...c, corpus: [f] }, seed);
    const score = [g.items.length >= MIN_EDITS ? 1 : 0, coverage(picks, g), g.items.length];
    if (!best || better(score, best.score)) best = { f, score };
  }
  const out = { ...c, corpus: [best ? best.f : CORPUS[0]] };
  cache.set(key, out);
  return out;
}
