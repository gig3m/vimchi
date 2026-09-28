// Progress storage. Guests keep runs in localStorage; signed-in users (GitHub)
// keep them on the server, and guest runs move to the account on first sign-in.

import { useCallback, useEffect, useState } from 'react';
import { type Account, api } from './api';

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

type Local = { lesson: string; runs: Run[] };
const KEY = 'vimchi.v1';
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

  useEffect(() => {
    let live = true;
    (async () => {
      const me = await api.me().catch(() => null);
      if (!live) return;
      if (me) {
        const guest = loadLocal().runs;
        if (guest.length) {
          try {
            await api.importRuns(guest);
            updateLocal(v => ({ ...v, runs: [] }));
          } catch {
            setSyncError('Could not move guest runs to your account. They are still saved in this browser.');
          }
        }
        const runs = await api.runs().catch(() => [] as Run[]);
        if (!live) return;
        setAccount(me);
        setServerRuns(runs);
      }
      setLoading(false);
    })();
    return () => { live = false; };
  }, [updateLocal]);

  const addRun = useCallback((run: Run) => {
    if (!account) return updateLocal(v => ({ ...v, runs: [...v.runs, run] }));
    setServerRuns(rs => [...rs, run]);
    api.addRun(run).then(
      () => setSyncError(''),
      () => setSyncError('Could not save that run to the server.'),
    );
  }, [account, updateLocal]);

  const signOut = useCallback(() => {
    api.signOut().finally(() => {
      setAccount(null);
      setServerRuns([]);
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
