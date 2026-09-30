import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from '../settings';

/** vitest runs in node: a minimal localStorage stand-in. */
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
});

describe('settings', () => {
  it('defaults coachLive to true and round-trips', () => {
    expect(loadSettings().coachLive).toBe(true);
    saveSettings({ coachLive: false });
    expect(loadSettings().coachLive).toBe(false);
  });
  it('survives corrupt storage', () => {
    localStorage.setItem('vimchi.coach.v1', '{nope');
    expect(loadSettings().coachLive).toBe(true);
  });
});
