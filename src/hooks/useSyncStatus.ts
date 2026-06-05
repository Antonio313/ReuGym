import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getLocalSession } from '@/lib/auth';
import { getDB } from '@/data/db';
import { syncAll } from '@/lib/sync';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export function useSyncStatus(): { status: SyncStatus; retry: () => void } {
  const user = getLocalSession();
  const [syncing, setSyncing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const failedOps = useLiveQuery(() => {
    if (!user) return 0;
    return getDB(user.id).syncQueue
      .where('userId').equals(user.id)
      .filter((op) => op.attempts > 0 && !!op.error)
      .count();
  }, [user?.id]) ?? 0;

  const pendingOps = useLiveQuery(() => {
    if (!user) return 0;
    return getDB(user.id).syncQueue
      .where('userId').equals(user.id)
      .count();
  }, [user?.id]) ?? 0;

  const retry = async () => {
    if (!user || syncing) return;
    setHasError(false);
    setSyncing(true);
    try {
      await syncAll(user.id);
    } catch {
      setHasError(true);
    } finally {
      setSyncing(false);
    }
  };

  let status: SyncStatus = 'synced';
  if (!isOnline)             status = 'offline';
  else if (syncing)          status = 'syncing';
  else if (hasError || failedOps > 0) status = 'error';
  else if (pendingOps > 0)   status = 'syncing';

  return { status, retry };
}
