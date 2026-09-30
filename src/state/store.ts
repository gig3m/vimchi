// Progress storage. Guests keep runs in localStorage; signed-in users (GitHub)
// keep them on the server, and guest runs move to the account on first sign-in.

import { useCallback, useEffect, useRef, useState } from 'react';
import { type Account, ApiError, api } from './api';
import { coachGuest, coachSignedIn, forgetGuestCoach } from './coach';
import { flushOutbox, loadOutbox, pushOutbox, removeOutbox as removeSent, takeOutbox } from './outbox';

export type Run = {
  lesson: string;
  at: number;
  time: number;
  keys: number;
  speed: number;
  acc: number;
  correct: number;
  score: number;
};

/** The longest run the server accepts (ms); it validates `time` against this. */
export const MAX_RUN_TIME = 24 * 60 * 60 * 1000;
/** The timer starts at the first key, so a tab left open overnight can run past the server's limit: cap it rather than lose the run. */
export function clampRun<R extends Run>(run: R): R {
  return run.time > MAX_RUN_TIME ? { ...run, time: MAX_RUN_TIME } : run;
}

type Local = { lesson: string; runs: Run[] };
const KEY = 'vimchi.v1';
/** Guest runs go to the account this many at a time (the server caps an import at 5000). */
const IMPORT_CHUNK = 1000;
/** Where progress lived before the rename; read once as a fallback. */
const OLD_KEY = 'hjkl.v1';

function loadLocal(): Local {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY) ?? 'null');
    if (v && typeof v.lesson === 'string' && Array.isArray(v.runs)) return v;
  } catch {
    /* private mode or corrupt data */
  }
  return { lesson: '', runs: [] };
}

function saveLocal(v: Local) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable: progress lasts for this tab only */
  }
}

export type Progress = {
  account: Account | null;
  /** True until the first /api/me check finishes. */
  loading: boolean;
  runs: Run[];
  lesson: string;
  setLesson: (id: string) => void;
  addRun: (run: Run) => void;
  signOut: () => void;
  /** Set when the last server save failed. */
  syncError: string;
};

export function useProgress(): Progress {
  const [local, setLocal] = useState(loadLocal);
  const [account, setAccount] = useState<Account | null>(null);
  const [serverRuns, setServerRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState('');

  const updateLocal = useCallback((f: (v: Local) => Local) => {
    setLocal(prev => {
      const next = f(prev);
      saveLocal(next);
      return next;
    });
  }, []);

  /** The session is gone: back to guest mode, and any unsent runs join the guest list so the next sign-in imports them. */
  const sessionExpired = useCallback(() => {
    const pending = account ? takeOutbox(account.login) : [];
    if (pending.length) updateLocal(v => ({ ...v, runs: [...v.runs, ...pending] }));
    setAccount(null);
    setServerRuns([]);
    coachGuest();
    setSyncError('Your session expired. Sign in again; nothing was lost.');
  }, [account, updateLocal]);

  /** Send whatever is waiting in the account's outbox; on 429 come back after Retry-After. One flush at a time. */
  const retryT = useRef<number>(undefined);
  const flushing = useRef(false);
  const flush = useCallback(async (login = account?.login) => {
    if (!login || flushing.current) return;
    flushing.current = true;
    clearTimeout(retryT.current);
    try {
      const r = await flushOutbox(login, api.addRun);
      if (r.status === 'unauthorized') return sessionExpired();
      if (r.status === 'ok') return setSyncError('');
      setSyncError('Could not save to the server yet. Saved in this browser; retrying.');
      retryT.current = window.setTimeout(() => void flush(login), Math.max(5, r.retryAfter) * 1000);
    } finally { flushing.current = false; }
  }, [account, sessionExpired]);

  useEffect(() => {
    let live = true;
    (async () => {
      const me = await api.me().catch(() => null);
      if (!live) return;
      if (me) {
        // Guest runs move to the account in chunks; only the runs that were sent are dropped, so a
        // run finished while the import is in flight is not wiped with them.
        const guest = loadLocal().runs;
        let imported = true;
        if (guest.length) {
          try {
            for (let i = 0; i < guest.length; i += IMPORT_CHUNK) {
              const chunk = guest.slice(i, i + IMPORT_CHUNK);
              await api.importRuns(chunk);
              const sent = new Set(chunk.map(r => `${r.lesson}@${r.at}`));
              updateLocal(v => ({ ...v, runs: v.runs.filter(r => !sent.has(`${r.lesson}@${r.at}`)) }));
            }
          } catch {
            imported = false;
            setSyncError('Could not move guest runs to your account. They are still saved in this browser.');
          }
        }
        // The guest's coach profile moved with their runs (each carries its events); the account's
        // profile is read only now, so it includes them.
        if (imported) forgetGuestCoach();
        void coachSignedIn();
        const runs = await api.runs().catch(() => [] as Run[]);
        if (!live) return;
        setAccount(me);
        // Anything still unsent counts as the learner's until the server takes it; then send it.
        setServerRuns([...runs, ...loadOutbox(me.login).filter(o => !runs.some(r => r.lesson === o.lesson && r.at === o.at))]);
        void flush(me.login);
      } else coachGuest();
      setLoading(false);
    })();
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateLocal]);

  useEffect(() => {
    if (!account) return;
    const onOnline = () => { void flush(); };
    window.addEventListener('online', onOnline);
    return () => { window.removeEventListener('online', onOnline); clearTimeout(retryT.current); };
  }, [account, flush]);

  const addRun = useCallback((finished: Run) => {
    const run = clampRun(finished);
    if (!account) return updateLocal(v => ({ ...v, runs: [...v.runs, run] }));
    setServerRuns(rs => [...rs, run]);
    pushOutbox(account.login, run);
    api.addRun(run).then(
      () => { removeSent(account.login, run); void flush(); },
      (e: unknown) => { if (e instanceof ApiError && e.status === 401) sessionExpired(); else void flush(); },
    );
  }, [account, updateLocal, flush, sessionExpired]);

  const signOut = useCallback(() => {
    api.signOut().finally(() => {
      setAccount(null);
      setServerRuns([]);
      coachGuest();
    });
  }, []);

  return {
    account, loading, syncError,
    runs: account ? serverRuns : local.runs,
    lesson: local.lesson,
    setLesson: (id: string) => updateLocal(v => ({ ...v, lesson: id })),
    addRun, signOut,
  };
}
