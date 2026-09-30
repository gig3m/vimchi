import type { Run } from './store';
import type { CoachFields, CoachProfile } from './coach';

export type Account = { login: string; name: string; avatarUrl: string; created: number };

/** A non-2xx answer, with the status the caller decides on (401: session gone, 429: wait retryAfter s). */
export class ApiError extends Error {
  constructor(public status: number, message: string, public retryAfter = 0) { super(message); }
}
export function classify(status: number, headers: { get(name: string): string | null }): ApiError {
  const ra = Number(headers.get('Retry-After') ?? 0);
  return new ApiError(status, status === 401 ? 'unauthorized' : `HTTP ${status}`, Number.isFinite(ra) && ra > 0 ? ra : 0);
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw classify(res.status, res.headers);
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  /** The signed-in account, or null for a guest (the server answers 204, not a 401 the console logs). */
  me: () => req<Account | undefined>('GET', '/api/me').then(a => a ?? null),
  runs: () => req<Run[]>('GET', '/api/runs'),
  /** A run may carry its coach events and key mix (optional; older runs have neither). */
  addRun: (run: Run & CoachFields) => req<void>('POST', '/api/runs', run),
  importRuns: (runs: (Run & CoachFields)[]) => req<void>('POST', '/api/runs/import', runs),
  coachProfile: () => req<CoachProfile>('GET', '/api/coach/profile'),
  signOut: () => req<void>('POST', '/auth/logout'),
  loginUrl: (returnTo: string) => '/auth/github/login?return=' + encodeURIComponent(returnTo),
};
