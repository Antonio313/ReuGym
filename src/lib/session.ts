// Local session primitives, split out of auth.ts so sync.ts can read the
// current session (to self-heal stale queued payloads — see applyOperation)
// without an auth.ts <-> sync.ts circular import: auth.ts already imports
// enqueueSync/syncNow from sync.ts.

const SESSION_KEY = 'reugym_session';

export type WeightUnit = 'kg' | 'lbs';

export type AuthUser = { id: string; email: string; weightUnit: WeightUnit; hasSeenOnboarding: boolean; isAdmin: boolean };

export function getLocalSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setLocalSession(user: AuthUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearLocalSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
