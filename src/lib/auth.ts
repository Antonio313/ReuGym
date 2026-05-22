import { supabase } from './supabase';

const SESSION_KEY = 'reugym_session';

export type AuthUser = { id: string; email: string };

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
    .select('id, email')
    .eq('email', email.toLowerCase().trim())
    .single();
  if (error || !data) throw new Error('NO_ACCOUNT');
  const user = { id: data.id as string, email: data.email as string };
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
    .select('id, email')
    .single();
  if (error || !data) throw new Error('SIGNUP_FAILED');
  const user = { id: data.id as string, email: data.email as string };
  setLocalSession(user);
  return user;
}

export function signOut(): void {
  clearLocalSession();
}
