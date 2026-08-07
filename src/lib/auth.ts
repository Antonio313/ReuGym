import { supabase } from './supabase';
import { enqueueSync, syncNow } from './sync';
import { getLocalSession, setLocalSession, clearLocalSession } from './session';
import type { AuthUser, WeightUnit } from './session';

export { getLocalSession, setLocalSession, clearLocalSession };
export type { AuthUser, WeightUnit };

export async function signIn(email: string): Promise<AuthUser> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, weight_unit, has_seen_onboarding')
    .eq('email', email.toLowerCase().trim())
    .single();
  if (error || !data) throw new Error('NO_ACCOUNT');
  const user = {
    id: data.id as string,
    email: data.email as string,
    weightUnit: (data.weight_unit as WeightUnit) ?? 'kg',
    hasSeenOnboarding: (data.has_seen_onboarding as boolean) ?? false,
  };
  setLocalSession(user);
  return user;
}

export async function signUp(email: string): Promise<AuthUser> {
  const trimmed = email.toLowerCase().trim();
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', trimmed)
    .maybeSingle();
  if (existing) throw new Error('ALREADY_EXISTS');
  const { data, error } = await supabase
    .from('users')
    .insert({ email: trimmed })
    .select('id, email, weight_unit, has_seen_onboarding')
    .single();
  if (error || !data) throw new Error('SIGNUP_FAILED');
  const user = {
    id: data.id as string,
    email: data.email as string,
    weightUnit: (data.weight_unit as WeightUnit) ?? 'kg',
    hasSeenOnboarding: (data.has_seen_onboarding as boolean) ?? false,
  };
  setLocalSession(user);
  return user;
}

export function signOut(): void {
  clearLocalSession();
}

// Optimistic: updates the local session immediately (so the UI reflects the
// change offline/instantly), then routes through the same offline queue as
// every other write — so a change made without connectivity isn't lost, it
// just syncs on the next retry/poll/reconnect like everything else.
//
// `email` is included in every partial upsert here even though it never
// changes — Postgres validates NOT NULL constraints while building the
// candidate row for an upsert *before* it checks whether a conflict
// redirects it to UPDATE, so omitting any NOT NULL column 400s even when
// the row already exists and that column is untouched.
export async function updateWeightUnit(userId: string, unit: WeightUnit): Promise<void> {
  const current = getLocalSession();
  if (current && current.id === userId) {
    setLocalSession({ ...current, weightUnit: unit });
  }
  await enqueueSync(userId, 'users', 'upsert', { id: userId, email: current?.email, weight_unit: unit });
  await syncNow(userId);
}

export async function markOnboardingSeen(userId: string): Promise<void> {
  const current = getLocalSession();
  if (current && current.id === userId) {
    setLocalSession({ ...current, hasSeenOnboarding: true });
  }
  await enqueueSync(userId, 'users', 'upsert', { id: userId, email: current?.email, has_seen_onboarding: true });
  await syncNow(userId);
}
