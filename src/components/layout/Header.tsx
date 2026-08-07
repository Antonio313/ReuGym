import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignOut, Gear } from '@phosphor-icons/react';
import { useAuth } from '@/context/AuthContext';
import { useSyncStatus } from '@/hooks/useSyncStatus';

type HeaderProps = {
  subtitle?: ReactNode;
};

function SyncDot() {
  const { status, retry } = useSyncStatus();

  // Three-color model: green = synced, orange = a write is queued or
  // actively pushing/pulling, red = actually stuck (offline or failed) — the
  // dot is always visible so a glance confirms green, rather than only
  // appearing when something's wrong.
  const colors: Record<typeof status, string> = {
    synced:  'var(--color-success)',
    syncing: 'var(--color-accent)',
    pending: 'var(--color-accent)',
    offline: 'var(--color-regression)',
    error:   'var(--color-regression)',
  };

  const clickable = status === 'error' || status === 'pending' || status === 'offline';

  return (
    <button
      onClick={clickable ? () => void retry() : undefined}
      title={
        status === 'synced'  ? 'Synced' :
        status === 'syncing' ? 'Syncing…' :
        status === 'offline' ? 'Offline — changes saved locally, tap to retry' :
        status === 'pending' ? 'Syncing…' :
        'Sync error — tap to retry'
      }
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: colors[status],
        border: 'none',
        padding: 0,
        cursor: clickable ? 'pointer' : 'default',
        animation: status === 'syncing' || status === 'pending' ? 'pulse 1.2s ease-in-out infinite' : 'none',
        flexShrink: 0,
      }}
    />
  );
}

export function Header({ subtitle }: HeaderProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = () => {
    signOut();
    navigate('/signin');
  };

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4"
      style={{
        height: 'var(--header-height)',
        background: 'var(--color-bg)',
        borderBottom: 'var(--border-thin)',
      }}
    >
      <div className="flex items-center gap-2">
        <div className="flex flex-col justify-center">
          <span
            className="font-display tracking-[0.05em] uppercase"
            style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)' }}
          >
            REUGYM
          </span>
          {subtitle && (
            <span
              className="font-body"
              style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
            >
              {subtitle}
            </span>
          )}
        </div>
        <SyncDot />
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => navigate('/settings')}
          aria-label="Settings"
          style={{ color: 'var(--color-text-faint)', padding: '0.25rem' }}
        >
          <Gear size={20} />
        </button>
        <button
          onClick={handleLogout}
          aria-label="Log out"
          style={{ color: 'var(--color-text-faint)', padding: '0.25rem' }}
        >
          <SignOut size={20} />
        </button>
      </div>
    </header>
  );
}
