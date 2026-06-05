import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { nanoid } from 'nanoid';
import { useAuth } from '@/context/AuthContext';
import { getDB } from '@/data/db';
import { initialSync, deltaSync, pushQueue, syncAll } from '@/lib/sync';

// Dev-only page — redirects to home in production
export default function SyncDebug() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;
  return <SyncDebugInner />;
}

function SyncDebugInner() {
  const { user } = useAuth();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [offlineSimulated, setOfflineSimulated] = useState(false);

  const db = user ? getDB(user.id) : null;

  const syncMeta      = useLiveQuery(() => db?.syncMeta.toArray() ?? [], [db]);
  const queueItems    = useLiveQuery(() => db?.syncQueue.where('userId').equals(user?.id ?? '').sortBy('createdAt') ?? [], [db, user]);
  const setCount      = useLiveQuery(() => db?.sets.where('userId').equals(user?.id ?? '').count() ?? 0, [db, user]);
  const sessionCount  = useLiveQuery(() => db?.sessions.where('userId').equals(user?.id ?? '').count() ?? 0, [db, user]);
  const bodyStatCount = useLiveQuery(() => db?.bodyStats.where('userId').equals(user?.id ?? '').count() ?? 0, [db, user]);
  const prefCount     = useLiveQuery(() => db?.exercisePrefs.where('[userId+exerciseId]').between([user?.id ?? '', ''], [user?.id ?? '', '￿']).count() ?? 0, [db, user]);
  const tplExCount    = useLiveQuery(() => db?.templateExercises.where('[userId+templateId]').between([user?.id ?? '', ''], [user?.id ?? '', '￿']).count() ?? 0, [db, user]);
  const tplStCount    = useLiveQuery(() => db?.templateStretches.where('[userId+templateId]').between([user?.id ?? '', ''], [user?.id ?? '', '￿']).count() ?? 0, [db, user]);
  const customExCount = useLiveQuery(() => db?.customExercises.where('userId').equals(user?.id ?? '').count() ?? 0, [db, user]);
  const tplVersions   = useLiveQuery(() => db?.templateVersions.toArray() ?? [], [db]);

  function addLog(msg: string) {
    const ts = new Date().toLocaleTimeString();
    setLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 50));
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    if (!user) return;
    setBusy(true);
    const start = Date.now();
    try {
      const result = await fn();
      addLog(`✓ ${label} — ${Date.now() - start}ms ${result !== undefined ? JSON.stringify(result) : ''}`);
    } catch (err) {
      addLog(`✗ ${label} — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleClearDexie() {
    if (!db || !user) return;
    setConfirmClear(false);
    setBusy(true);
    try {
      await Promise.all([
        db.sets.where('userId').equals(user.id).delete(),
        db.sessions.where('userId').equals(user.id).delete(),
        db.bodyStats.where('userId').equals(user.id).delete(),
        db.exercisePrefs.where('[userId+exerciseId]').between([user.id, ''], [user.id, '￿']).delete(),
        db.templateExercises.where('[userId+templateId]').between([user.id, ''], [user.id, '￿']).delete(),
        db.templateStretches.where('[userId+templateId]').between([user.id, ''], [user.id, '￿']).delete(),
        db.customExercises.where('userId').equals(user.id).delete(),
        db.syncQueue.where('userId').equals(user.id).delete(),
        db.syncMeta.delete(user.id),
        db.templateVersions.clear(),
      ]);
      addLog('✓ Dexie cleared for current user');
    } catch (err) {
      addLog(`✗ Clear failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddTestQueueItem() {
    if (!db || !user) return;
    await db.syncQueue.add({
      id: nanoid(),
      userId: user.id,
      table: 'exercise_prefs',
      operation: 'upsert',
      payload: {
        user_id: user.id,
        exercise_id: `test-exercise-${nanoid(6)}`,
        starting_weight_kg: 0,
        starting_reps: null,
      },
      createdAt: Date.now(),
      attempts: 0,
    });
    addLog('+ Test queue item added (exercise_prefs upsert)');
  }

  const meta = syncMeta?.[0];
  const isOnline = navigator.onLine && !offlineSimulated;

  const badge = (label: string, value: string | number | boolean | undefined, accent = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-micro)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ color: accent ? 'var(--color-accent)' : 'var(--color-text)', fontSize: 'var(--text-meta)', fontFamily: 'var(--font-mono)' }}>{String(value ?? '—')}</span>
    </div>
  );

  const btn = (label: string, onClick: () => void, danger = false) => (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        background: danger ? 'rgba(255,77,77,0.12)' : 'var(--color-surface-2)',
        color: danger ? 'var(--color-regression)' : 'var(--color-text)',
        border: danger ? '1px solid rgba(255,77,77,0.3)' : 'var(--border-thin)',
        borderRadius: 'var(--radius-md)',
        padding: '0.5rem 1rem',
        fontSize: 'var(--text-meta)',
        fontFamily: 'var(--font-body)',
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh', padding: '1.5rem 1rem', fontFamily: 'var(--font-body)', maxWidth: 600, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h1)', color: 'var(--color-text)', letterSpacing: '0.05em' }}>SYNC DEBUG</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* User */}
      <section style={{ background: 'var(--color-surface)', border: 'var(--border-thin)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)', marginBottom: 8 }}>CURRENT USER</p>
        <p style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-meta)' }}>{user?.email ?? 'Not signed in'}</p>
        <p style={{ color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', marginTop: 4 }}>{user?.id ?? ''}</p>
      </section>

      {/* Sync Meta */}
      <section style={{ background: 'var(--color-surface)', border: 'var(--border-thin)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)', marginBottom: 12 }}>SYNC META</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {badge('initialSyncComplete', meta?.initialSyncComplete, meta?.initialSyncComplete)}
          {badge('lastSyncedAt', meta?.lastSyncedAt ? new Date(meta.lastSyncedAt).toLocaleString() : '—')}
        </div>
      </section>

      {/* Row Counts */}
      <section style={{ background: 'var(--color-surface)', border: 'var(--border-thin)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)', marginBottom: 12 }}>DEXIE ROW COUNTS</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {badge('sets', setCount)}
          {badge('sessions', sessionCount)}
          {badge('bodyStats', bodyStatCount)}
          {badge('exercisePrefs', prefCount)}
          {badge('tplExercises', tplExCount)}
          {badge('tplStretches', tplStCount)}
          {badge('customExercises', customExCount)}
          {badge('queueItems', queueItems?.length)}
          {badge('tplVersions', tplVersions?.length)}
        </div>
      </section>

      {/* Sync Queue */}
      <section style={{ background: 'var(--color-surface)', border: 'var(--border-thin)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)', marginBottom: 12 }}>
          SYNC QUEUE ({queueItems?.length ?? 0} items)
        </p>
        {!queueItems?.length && (
          <p style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-meta)' }}>Empty — all synced</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {queueItems?.map((op) => (
            <div key={op.id} style={{ background: 'var(--color-surface-2)', border: op.error ? '1px solid rgba(255,77,77,0.4)' : 'var(--border-thin)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--color-accent)' }}>{op.operation}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--color-text-faint)' }}>{op.table}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
                  {new Date(op.createdAt).toLocaleTimeString()} · attempts: {op.attempts}
                </span>
              </div>
              {op.error && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--color-regression)', marginTop: 4 }}>{op.error}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Template Versions */}
      {!!tplVersions?.length && (
        <section style={{ background: 'var(--color-surface)', border: 'var(--border-thin)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)', marginBottom: 12 }}>TEMPLATE VERSIONS</p>
          {tplVersions.map((v) => (
            <div key={v.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>{v.key}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--color-accent)' }}>v{v.version}</span>
            </div>
          ))}
        </section>
      )}

      {/* Actions */}
      <section style={{ background: 'var(--color-surface)', border: 'var(--border-thin)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)', marginBottom: 12 }}>ACTIONS</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {btn('Initial Sync', () => run('initialSync', () => initialSync(user!.id)))}
          {btn('Delta Sync', () => run('deltaSync', () => deltaSync(user!.id)))}
          {btn('Push Queue', () => run('pushQueue', () => pushQueue(user!.id)))}
          {btn('Sync All', () => run('syncAll', () => syncAll(user!.id)))}
          {btn('Add Test Item', () => void handleAddTestQueueItem())}
          {btn(offlineSimulated ? 'Restore Online Listener' : 'Simulate Offline', () => {
            setOfflineSimulated((v) => !v);
            addLog(offlineSimulated ? 'Online listener restored' : 'Online simulation: online listener paused');
          })}
        </div>
        <div style={{ marginTop: 12 }}>
          {!confirmClear
            ? btn('Clear Dexie (This User)', () => setConfirmClear(true), true)
            : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--color-regression)', fontSize: 'var(--text-meta)' }}>Are you sure?</span>
                {btn('Yes, clear', () => void handleClearDexie(), true)}
                {btn('Cancel', () => setConfirmClear(false))}
              </div>
            )
          }
        </div>
      </section>

      {/* Log */}
      <section style={{ background: 'var(--color-surface)', border: 'var(--border-thin)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>LOG</p>
          <button onClick={() => setLog([])} style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', fontSize: 'var(--text-micro)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Clear</button>
        </div>
        {!log.length && (
          <p style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-meta)' }}>No activity yet</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {log.map((line, i) => (
            <p key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: line.startsWith('[') && line.includes('✓') ? 'var(--color-success)' : line.includes('✗') ? 'var(--color-regression)' : 'var(--color-text-muted)', margin: 0 }}>
              {line}
            </p>
          ))}
        </div>
      </section>

      <div style={{ height: '2rem' }} />
    </div>
  );
}
