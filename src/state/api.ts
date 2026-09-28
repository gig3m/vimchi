import type { Run } from './store';

export type Account = { login: string; name: string; avatarUrl: string; created: number };

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  me: () => req<Account>('GET', '/api/me'),
  runs: () => req<Run[]>('GET', '/api/runs'),
  addRun: (run: Run) => req<void>('POST', '/api/runs', run),
  importRuns: (runs: Run[]) => req<void>('POST', '/api/runs/import', runs),
  signOut: () => req<void>('POST', '/auth/logout'),
  loginUrl: (returnTo: string) => '/auth/github/login?return=' + encodeURIComponent(returnTo),
};
