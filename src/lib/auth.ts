import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { enqueueSync, syncNow } from './sync';
import { getLocalSession, setLocalSession, clearLocalSession } from './session';
import type { AuthUser, WeightUnit } from './session';

export { getLocalSession, setLocalSession, clearLocalSession };
export type { AuthUser, WeightUnit };

export type SignUpResult =
  | { status: 'signed_in' }
  | { status: 'confirm_email' };

// Confirmation/reset emails always redirect here rather than to
// window.location.origin — signup can happen from a local dev server that
// won't be running by the time the email is opened, so the link must point
// somewhere permanently reachable. Falls back to window.location.origin only
// so a fork without VITE_SITE_URL configured doesn't get a broken redirect.
const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;

// Single place that turns a Supabase Auth user + its public.users profile
// row into the app's AuthUser shape. Used by AuthContext's onAuthStateChange
// listener, which is the one source of truth for session state — signIn/
// signUp below only trigger the underlying Supabase call and surface errors;
// they don't set local session state themselves, to avoid a double-load race
// with the listener firing for the same event.
export async function loadProfile(authUser: User): Promise<{ user: AuthUser; mustChangePassword: boolean }> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, weight_unit, has_seen_onboarding, has_completed_setup, must_change_password')
    .eq('id', authUser.id)
    .single();
  if (error || !data) throw new Error('PROFILE_NOT_FOUND');

  const user: AuthUser = {
    id: data.id as string,
    email: data.email as string,
    weightUnit: (data.weight_unit as WeightUnit) ?? 'kg',
    hasSeenOnboarding: (data.has_seen_onboarding as boolean) ?? false,
    hasCompletedSetup: (data.has_completed_setup as boolean) ?? false,
    isAdmin: authUser.app_metadata?.is_admin === true,
  };
  return { user, mustChangePassword: (data.must_change_password as boolean) ?? false };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });
  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) throw new Error('EMAIL_NOT_CONFIRMED');
    throw new Error('INVALID_CREDENTIALS');
  }
}

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const trimmed = email.toLowerCase().trim();
  const { data, error } = await supabase.auth.signUp({
    email: trimmed,
    password,
    options: { emailRedirectTo: SITE_URL },
  });
  if (error) {
    if (error.message.toLowerCase().includes('already registered')) throw new Error('ALREADY_EXISTS');
    throw new Error('SIGNUP_FAILED');
  }
  // Supabase returns a user with no identities (instead of an error) when
  // signing up with an email that's already registered and confirmed —
  // avoids leaking which emails exist.
  if (!data.user || data.user.identities?.length === 0) throw new Error('ALREADY_EXISTS');

  // The public.users profile row is created by the on_auth_user_created
  // trigger (see 013_enable_rls.sql), not here. With email confirmation
  // required, this signUp() call returns before a session exists, so an
  // insert attempted from here would run unauthenticated and get rejected
  // by RLS — the trigger runs server-side at row-creation time instead,
  // sidestepping that timing problem entirely.

  return data.session ? { status: 'signed_in' } : { status: 'confirm_email' };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  clearLocalSession();
}

export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
    redirectTo: SITE_URL,
  });
  if (error) throw new Error('RESET_FAILED');
}

// Called both when a signed-in user changes their password voluntarily
// (Settings) and when a migrated/recovering user sets one for the first
// time — either way, the account is no longer on a default/unknown password.
export async function setNewPassword(userId: string, newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error('PASSWORD_UPDATE_FAILED');
  await supabase.from('users').update({ must_change_password: false }).eq('id', userId);
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

// Gates the setup wizard (like setNewPassword, a direct awaited write, not
// the offline queue — must be confirmed before the wizard releases the user
// into the rest of the app).
export async function markSetupComplete(userId: string): Promise<void> {
  const { error } = await supabase.from('users').update({ has_completed_setup: true }).eq('id', userId);
  if (error) throw new Error('SETUP_COMPLETE_FAILED');
}

// Lets a user who already finished (or skipped) the AI setup wizard go
// through it again voluntarily from Settings — same direct-write pattern as
// markSetupComplete, since AppRoutes' needsSetup takeover must see this
// before the user is routed back into the wizard.
export async function resetSetup(userId: string): Promise<void> {
  const { error } = await supabase.from('users').update({ has_completed_setup: false }).eq('id', userId);
  if (error) throw new Error('SETUP_RESET_FAILED');
}
