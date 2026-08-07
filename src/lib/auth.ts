import { supabase } from './supabase';

const SESSION_KEY = 'reugym_session';

export type WeightUnit = 'kg' | 'lbs';

export type AuthUser = { id: string; email: string; weightUnit: WeightUnit };

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

export async function signIn(email: string): Promise<AuthUser> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, weight_unit')
    .eq('email', email.toLowerCase().trim())
    .single();
  if (error || !data) throw new Error('NO_ACCOUNT');
  const user = {
    id: data.id as string,
    email: data.email as string,
    weightUnit: (data.weight_unit as WeightUnit) ?? 'kg',
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
    .select('id, email, weight_unit')
    .single();
  if (error || !data) throw new Error('SIGNUP_FAILED');
  const user = {
    id: data.id as string,
    email: data.email as string,
    weightUnit: (data.weight_unit as WeightUnit) ?? 'kg',
  };
  setLocalSession(user);
  return user;
}

export function signOut(): void {
  clearLocalSession();
}

// Optimistic: updates the local session immediately (so the UI reflects the
// change offline/instantly), then best-effort pushes to Supabase. Unlike
// workout data this preference isn't routed through the offline sync queue —
// if the push fails while offline, the next fresh sign-in on another device
// will still reflect whatever was last successfully saved to Supabase.
export async function updateWeightUnit(userId: string, unit: WeightUnit): Promise<void> {
  const current = getLocalSession();
  if (current && current.id === userId) {
    setLocalSession({ ...current, weightUnit: unit });
  }
  const { error } = await supabase.from('users').update({ weight_unit: unit }).eq('id', userId);
  if (error) throw new Error(error.message);
}
