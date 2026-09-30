import type { Run } from './store';

/** The longest run the server accepts (ms); it validates `time` against this. */
export const MAX_RUN_TIME = 24 * 60 * 60 * 1000;
/** The timer starts at the first key, so a tab left open overnight can run past the server's limit: cap it rather than lose the run. */
export function clampRun<R extends Run>(run: R): R {
  return run.time > MAX_RUN_TIME ? { ...run, time: MAX_RUN_TIME } : run;
}
