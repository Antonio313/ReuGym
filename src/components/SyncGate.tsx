import { useState, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getDB } from '@/data/db';
import { initialSync, deltaSync, registerOnlineSync } from '@/lib/sync';

type SyncState = 'checking' | 'syncing' | 'ready' | 'error';

export function SyncGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (loading) return;

    // No user — let auth gates handle it, nothing to sync
    if (!user) {
      setSyncState('ready');
      return;
    }

    void run(user.id);
  }, [user, loading]);

  async function run(userId: string) {
    const db = getDB(userId);
    const meta = await db.syncMeta.get(userId);

    if (!meta?.initialSyncComplete) {
      setSyncState('syncing');
      try {
        await initialSync(userId);
        setSyncState('ready');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
        setSyncState('error');
        return;
      }
    } else {
      setSyncState('ready');
      // Delta sync in the background — don't block the UI
      if (navigator.onLine) void deltaSync(userId);
    }

    // Register online listener for the rest of the session
    return registerOnlineSync(userId);
  }

  async function handleRetry() {
    if (!user) return;
    setErrorMessage('');
    setSyncState('syncing');
    try {
      await initialSync(user.id);
      setSyncState('ready');
      registerOnlineSync(user.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
      setSyncState('error');
    }
  }

  if (loading || syncState === 'checking') {
    return (
      <div
        className="flex items-center justify-center min-h-dvh"
        style={{ background: 'var(--color-bg)' }}
      >
        <span
          className="font-display tracking-widest"
          style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text-faint)' }}
        >
          REUGYM
        </span>
      </div>
    );
  }

  if (syncState === 'syncing') {
    return (
      <div
        className="flex flex-col items-center justify-center gap-6 min-h-dvh"
        style={{ background: 'var(--color-bg)' }}
      >
        <span
          className="font-display tracking-widest"
          style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)' }}
        >
          REUGYM
        </span>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
          />
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)', fontFamily: 'var(--font-body)' }}>
            Syncing your data…
          </p>
        </div>
      </div>
    );
  }

  if (syncState === 'error') {
    return (
      <div
        className="flex flex-col items-center justify-center gap-6 min-h-dvh px-8 text-center"
        style={{ background: 'var(--color-bg)' }}
      >
        <span
          className="font-display tracking-widest"
          style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)' }}
        >
          REUGYM
        </span>
        <div className="flex flex-col items-center gap-4">
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-body)', fontFamily: 'var(--font-body)' }}>
            Couldn't sync your data. Check your connection and try again.
          </p>
          {errorMessage && (
            <p style={{ color: 'var(--color-regression)', fontSize: 'var(--text-meta)', fontFamily: 'var(--font-mono)' }}>
              {errorMessage}
            </p>
          )}
          <button
            onClick={() => void handleRetry()}
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-bg)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-body)',
              fontWeight: 600,
              padding: '0.75rem 2rem',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
