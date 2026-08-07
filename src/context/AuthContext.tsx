import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  getLocalSession,
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  updateWeightUnit as authUpdateWeightUnit,
  markOnboardingSeen as authMarkOnboardingSeen,
  type AuthUser,
  type WeightUnit,
} from '@/lib/auth';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string) => Promise<AuthUser>;
  signUp: (email: string) => Promise<AuthUser>;
  signOut: () => void;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  showOnboarding: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const u = getLocalSession();
    setUser(u);
    setLoading(false);
    if (u && !u.hasSeenOnboarding) setShowOnboarding(true);
  }, []);

  const handleSignIn = async (email: string): Promise<AuthUser> => {
    const u = await authSignIn(email);
    setUser(u);
    if (!u.hasSeenOnboarding) setShowOnboarding(true);
    return u;
  };

  const handleSignUp = async (email: string): Promise<AuthUser> => {
    const u = await authSignUp(email);
    setUser(u);
    if (!u.hasSeenOnboarding) setShowOnboarding(true);
    return u;
  };

  const handleSignOut = () => {
    authSignOut();
    setUser(null);
    setShowOnboarding(false);
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
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
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
