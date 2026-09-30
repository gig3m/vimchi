// Per-lesson Reps: a lesson's own edit, 10–15 times on a corpus file, as a `generated` challenge.
// The lesson's `reps` spec names the mutation kinds (keyed to its chips); this builds the
// challenge, picks the corpus files that can hold the run, and says whether `.` may chain.
import { ORDER } from '../lessons';
import type { CorpusFile, GeneratedChallenge, Lesson, RepsSpec } from '../lessons/types';
import { CORPUS, JOINED } from './corpus';
import { generate } from './generate';
import { KINDS } from './mutations';

/** The run id Reps are saved under (the server allows [a-z0-9-]{1,64}). */
export const repsRunId = (lessonId: string) => `${lessonId}-reps`;
/** The lesson a saved Reps run belongs to, or null for any other run id. */
export const lessonOfRepsRun = (runId: string): string | null => (runId.endsWith('-reps') ? runId.slice(0, -'-reps'.length) : null);

export { JOINED };

/** Seeds a file must fill the run's minimum on to be offered (deterministic). */
const PROBE_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const DOT_FROM = 'repeat-last-change';

function base(lesson: Lesson, spec: RepsSpec, corpus: CorpusFile[], edits: [number, number]): GeneratedChallenge {
  const at = (id: string) => ORDER.findIndex(l => l.id === id);
  const dot = at(lesson.id) >= at(DOT_FROM);
  const plugins = [...new Set([
    ...(lesson.challenge.kind === 'rounds' ? lesson.challenge.base.plugins ?? [] : []),
    ...spec.mutations.flatMap(m => KINDS[m]?.plugins ?? []),
  ])];
  return {
    kind: 'generated',
    skills: ['reps', ...(dot ? ['repeat'] : [])],
    mutations: spec.mutations,
    corpus,
    edits,
    sections: spec.sections,
    ...(plugins.length && { plugins }),
    drill: true,
  };
}

const least = (c: GeneratedChallenge, f: CorpusFile) => Math.min(...PROBE_SEEDS.map(s => generate({ ...c, corpus: [f] }, s).items.length));

const cache = new Map<string, GeneratedChallenge>();

/**
 * The lesson's Reps as a generated challenge. The seed does not change the challenge: it picks
 * the file and the sites when a Session (or `generate`) runs it; the parameter is accepted so
 * callers can pass one through. Files that cannot hold the run's minimum are
 * left out: single files first, joined files when no single file can. If none can, the range
 * shrinks to what the best file holds, so a run never falls short of its own minimum.
 */
export function repsChallenge(lesson: Lesson, _seed?: number): GeneratedChallenge {
  const hit = cache.get(lesson.id);
  if (hit) return hit;
  const spec = lesson.reps;
  if (!spec) throw new Error(`Lesson "${lesson.id}" has no reps`);
  for (const m of spec.mutations) if (!KINDS[m]) throw new Error(`Lesson "${lesson.id}" reps: unknown mutation "${m}"`);
  // No prose corpus exists yet; every Reps run draws on the code corpus.
  const probe = base(lesson, spec, CORPUS, spec.count);
  // A file must carry every kind of the spec, so each run drills all of the lesson's keys.
  const every = (f: CorpusFile) => spec.mutations.every(m => KINDS[m].sites(f.lines).length > 0);
  const fits = (files: CorpusFile[]) => files.filter(every).map(f => ({ f, n: least(probe, f) }));
  let scored = fits(CORPUS).filter(x => x.n >= spec.count[0]);
  if (!scored.length) scored = fits(JOINED).filter(x => x.n >= spec.count[0]);
  let edits = spec.count;
  if (!scored.length) {
    let all = fits([...CORPUS, ...JOINED]);
    if (!all.length) all = [...CORPUS, ...JOINED].map(f => ({ f, n: least(probe, f) }));
    all.sort((a, b) => b.n - a.n);
    const best = all[0].n;
    scored = all.filter(x => x.n === best);
    edits = [best, Math.max(best, Math.min(spec.count[1], best + 2))];
  }
  const out = base(lesson, spec, scored.map(x => x.f), edits);
  cache.set(lesson.id, out);
  return out;
}
