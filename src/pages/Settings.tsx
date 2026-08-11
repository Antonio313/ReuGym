import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, LockKey, SignOut, ArrowsClockwise } from '@phosphor-icons/react';
import { PageShell } from '@/components/layout/PageShell';
import { PasswordForm } from '@/components/auth/PasswordForm';
import { useAuth } from '@/context/AuthContext';
import { useExercises, useStretches } from '@/hooks/useExercises';
import { syncLibraryToDefaults } from '@/lib/adminExerciseSync';
import type { WeightUnit } from '@/lib/auth';

const UNITS: { id: WeightUnit; label: string }[] = [
  { id: 'kg', label: 'Kilograms (kg)' },
  { id: 'lbs', label: 'Pounds (lbs)' },
];

export default function Settings() {
  const navigate = useNavigate();
  const { user, setWeightUnit, openOnboarding, completePasswordReset, signOut } = useAuth();
  const [saving, setSaving] = useState<WeightUnit | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const exercises = useExercises();
  const stretches = useStretches();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSelect = async (unit: WeightUnit) => {
    if (!user || unit === user.weightUnit) return;
    setSaving(unit);
    try {
      await setWeightUnit(unit);
    } finally {
      setSaving(null);
    }
  };

  const handleChangePassword = async (password: string) => {
    await completePasswordReset(password);
    setShowPasswordForm(false);
    setPasswordChanged(true);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const count = await syncLibraryToDefaults(exercises, stretches);
      setSyncResult(count);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <PageShell>
      <header
        className="flex items-center gap-3 px-4 sticky top-0 z-40"
        style={{
          height: 'var(--header-height)',
          borderBottom: 'var(--border-thin)',
          background: 'var(--color-bg)',
        }}
      >
        <button onClick={() => navigate(-1)} style={{ color: 'var(--color-text-muted)' }} aria-label="Go back">
          <ArrowLeft size={22} />
        </button>
        <h1
          className="font-display"
          style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)', letterSpacing: '0.02em' }}
        >
          SETTINGS
        </h1>
      </header>

      <main className="px-4 py-5">
        <p
          className="font-body uppercase tracking-widest mb-3"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          Account
        </p>

        {user && (
          <p className="font-body mb-3" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
            {user.email}
          </p>
        )}

        {!showPasswordForm && (
          <button
            type="button"
            onClick={() => { setShowPasswordForm(true); setPasswordChanged(false); }}
            className="flex items-center gap-3 w-full py-4 px-4 font-body"
            style={{
              fontSize: 'var(--text-body)',
              background: 'var(--color-surface)',
              border: 'var(--border-thin)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text)',
            }}
          >
            <LockKey size={20} style={{ color: 'var(--color-text-muted)' }} />
            Change password
          </button>
        )}

        {showPasswordForm && (
          <div className="py-1">
            <PasswordForm
              onSubmit={handleChangePassword}
              submitLabel="Update Password"
              loadingLabel="Saving…"
            />
          </div>
        )}

        {passwordChanged && (
          <p className="font-body mt-2" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-success)' }}>
            Password updated.
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="flex items-center gap-3 w-full py-4 px-4 font-body mt-2"
          style={{
            fontSize: 'var(--text-body)',
            background: 'var(--color-surface)',
            border: 'var(--border-thin)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-muted)',
          }}
        >
          <SignOut size={20} />
          Sign out
        </button>

        <p
          className="font-body uppercase tracking-widest mb-3 mt-8"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          Weight Unit
        </p>

        <div className="flex flex-col gap-2">
          {UNITS.map(({ id, label }) => {
            const active = user?.weightUnit === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => void handleSelect(id)}
                disabled={saving !== null}
                className="flex items-center justify-between w-full py-4 px-4 font-body"
                style={{
                  fontSize: 'var(--text-body)',
                  background: active ? 'var(--color-accent-dim)' : 'var(--color-surface)',
                  border: active ? '1px solid var(--color-accent)' : 'var(--border-thin)',
                  borderRadius: 'var(--radius-md)',
                  color: active ? 'var(--color-accent)' : 'var(--color-text)',
                }}
              >
                {label}
                {saving === id && (
                  <span className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
                    Saving…
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p
          className="font-body mt-3"
          style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)' }}
        >
          Applies to lifting weights and Body Stats.
        </p>

        <p
          className="font-body uppercase tracking-widest mb-3 mt-8"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          Help
        </p>

        <button
          type="button"
          onClick={openOnboarding}
          className="flex items-center gap-3 w-full py-4 px-4 font-body"
          style={{
            fontSize: 'var(--text-body)',
            background: 'var(--color-surface)',
            border: 'var(--border-thin)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text)',
          }}
        >
          <BookOpen size={20} style={{ color: 'var(--color-text-muted)' }} />
          Replay welcome guide
        </button>

        {user?.isAdmin && (
          <>
            <p
              className="font-body uppercase tracking-widest mb-3 mt-8"
              style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
            >
              Admin
            </p>

            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={syncing}
              className="flex items-center gap-3 w-full py-4 px-4 font-body"
              style={{
                fontSize: 'var(--text-body)',
                background: 'var(--color-surface)',
                border: 'var(--border-thin)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
              }}
            >
              <ArrowsClockwise size={20} style={{ color: 'var(--color-text-muted)' }} />
              {syncing ? 'Syncing…' : 'Sync library to defaults'}
            </button>

            {syncResult != null && (
              <p className="font-body mt-2" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-success)' }}>
                Synced {syncResult} exercises.
              </p>
            )}
            {syncError && (
              <p className="font-body mt-2" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-regression)' }}>
                {syncError}
              </p>
            )}
          </>
        )}
      </main>
    </PageShell>
  );
}
