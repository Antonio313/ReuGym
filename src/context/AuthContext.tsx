import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getLocalSession,
  setLocalSession,
  clearLocalSession,
  loadProfile,
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  resetPassword as authResetPassword,
  setNewPassword as authSetNewPassword,
  updateWeightUnit as authUpdateWeightUnit,
  markOnboardingSeen as authMarkOnboardingSeen,
  type AuthUser,
  type WeightUnit,
  type SignUpResult,
} from '@/lib/auth';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  needsPasswordReset: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  completePasswordReset: (newPassword: string) => Promise<void>;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  showOnboarding: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // onAuthStateChange is the single source of truth for session state — it
  // fires an INITIAL_SESSION event immediately on subscribe (covering the
  // on-mount case) and again on every sign-in/out/recovery/token-refresh, so
  // signIn/signUp below never set user state themselves — doing so would
  // race this listener handling the same event.
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      void (async () => {
        if (!session) {
          clearLocalSession();
          setUser(null);
          setNeedsPasswordReset(false);
          setLoading(false);
          return;
        }
        try {
          const { user: profileUser, mustChangePassword } = await loadProfile(session.user);
          setLocalSession(profileUser);
          setUser(profileUser);
          setNeedsPasswordReset(event === 'PASSWORD_RECOVERY' || mustChangePassword);
          if (!profileUser.hasSeenOnboarding) setShowOnboarding(true);
        } catch {
          // Profile row missing/unreachable — don't strand the user in a
          // half-signed-in state.
          await supabase.auth.signOut();
          clearLocalSession();
          setUser(null);
          setNeedsPasswordReset(false);
        } finally {
          setLoading(false);
        }
      })();
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const handleSignIn = async (email: string, password: string): Promise<void> => {
    await authSignIn(email, password);
  };

  const handleSignUp = async (email: string, password: string): Promise<SignUpResult> => {
    return authSignUp(email, password);
  };

  const handleSignOut = async (): Promise<void> => {
    await authSignOut();
    setUser(null);
    setNeedsPasswordReset(false);
    setShowOnboarding(false);
  };

  const handleCompletePasswordReset = async (newPassword: string): Promise<void> => {
    if (!user) throw new Error('NOT_SIGNED_IN');
    await authSetNewPassword(user.id, newPassword);
    setNeedsPasswordReset(false);
  };

  const handleSetWeightUnit = async (unit: WeightUnit): Promise<void> => {
    setUser((u) => (u ? { ...u, weightUnit: unit } : u));
    await authUpdateWeightUnit(getLocalSession()!.id, unit);
  };

  const openOnboarding = () => setShowOnboarding(true);

  const closeOnboarding = () => {
    setShowOnboarding(false);
    const current = getLocalSession();
    if (current && !current.hasSeenOnboarding) {
      setUser((u) => (u ? { ...u, hasSeenOnboarding: true } : u));
      void authMarkOnboardingSeen(current.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        needsPasswordReset,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        resetPassword: authResetPassword,
        completePasswordReset: handleCompletePasswordReset,
        setWeightUnit: handleSetWeightUnit,
        showOnboarding,
        openOnboarding,
        closeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
