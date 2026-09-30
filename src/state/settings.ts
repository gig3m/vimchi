// Per-browser settings (not synced to the account): the live coach hint.
import { useCallback, useState } from 'react';

export type Settings = { coachLive: boolean };
const KEY = 'vimchi.coach.v1';
const DEFAULTS: Settings = { coachLive: true };

export function loadSettings(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return { ...DEFAULTS, ...(v && typeof v === 'object' ? v : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: this tab only */ }
}

export function useSettings() {
  const [s, setS] = useState(loadSettings);
  const setCoachLive = useCallback((coachLive: boolean) => { const n = { ...s, coachLive }; setS(n); saveSettings(n); }, [s]);
  return { coachLive: s.coachLive, setCoachLive };
}
