import { nanoid } from 'nanoid';
import { supabase } from '@/lib/supabase';
import {
  getDB,
  rowToSet,
  rowToSession,
  rowToBodyStat,
  rowToExercisePref,
  rowToTemplateExercise,
  rowToTemplateStretch,
  rowToCustomExercise,
  type SupabaseTableName,
  type SyncOperation,
  type ReplaceAllPayload,
} from '@/data/db';

// ─── Public API ───────────────────────────────────────────────────

// Full pull of all user data from Supabase into Dexie.
// Called once per device on first login. Throws on network failure.
export async function initialSync(userId: string): Promise<void> {
  const db = getDB(userId);

  const [sessions, sets, bodyStats, exercisePrefs, templateExercises, templateStretches, customExercises] =
    await Promise.all([
      supabase.from('workout_sessions').select('*').eq('user_id', userId),
      supabase.from('logged_sets').select('*').eq('user_id', userId),
      supabase.from('body_stats').select('*').eq('user_id', userId),
      supabase.from('exercise_prefs').select('*').eq('user_id', userId),
      supabase.from('template_exercises').select('*').eq('user_id', userId),
      supabase.from('template_stretches').select('*').eq('user_id', userId),
      supabase.from('custom_exercises').select('*').eq('user_id', userId),
    ]);

  // Surface any Supabase errors so SyncGate can show retry UI
  const errors = [sessions, sets, bodyStats, exercisePrefs, templateExercises, templateStretches, customExercises]
    .map((r) => r.error)
    .filter(Boolean);
  if (errors.length > 0) {
    throw new Error(errors[0]!.message);
  }

  await Promise.all([
    db.sessions.bulkPut((sessions.data ?? []).map((r) => rowToSession(r, userId))),
    db.sets.bulkPut((sets.data ?? []).map((r) => rowToSet(r, userId))),
    db.bodyStats.bulkPut((bodyStats.data ?? []).map((r) => rowToBodyStat(r, userId))),
    db.exercisePrefs.bulkPut((exercisePrefs.data ?? []).map((r) => rowToExercisePref(r, userId))),
    db.templateExercises.bulkPut((templateExercises.data ?? []).map((r) => rowToTemplateExercise(r, userId))),
    db.templateStretches.bulkPut((templateStretches.data ?? []).map((r) => rowToTemplateStretch(r, userId))),
    db.customExercises.bulkPut((customExercises.data ?? []).map((r) => rowToCustomExercise(r, userId))),
  ]);

  await db.syncMeta.put({ userId, initialSyncComplete: true, lastSyncedAt: Date.now() });
}

// Pulls rows from the last 7 days from Supabase and upserts into Dexie.
// Catches changes from other devices. Non-fatal — swallows errors.
export async function deltaSync(userId: string): Promise<number> {
  const db = getDB(userId);
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let rowsUpdated = 0;

  try {
    const [sessions, sets, bodyStats] = await Promise.all([
      supabase.from('workout_sessions').select('*').eq('user_id', userId).gte('started_at', cutoff),
      supabase.from('logged_sets').select('*').eq('user_id', userId).gte('completed_at', cutoff),
      supabase.from('body_stats').select('*').eq('user_id', userId).gte('date', cutoff),
    ]);

    // Config tables are small — full re-sync is simpler and more reliable
    const [exercisePrefs, templateExercises, templateStretches, customExercises] = await Promise.all([
      supabase.from('exercise_prefs').select('*').eq('user_id', userId),
      supabase.from('template_exercises').select('*').eq('user_id', userId),
      supabase.from('template_stretches').select('*').eq('user_id', userId),
      supabase.from('custom_exercises').select('*').eq('user_id', userId),
    ]);

    const writes = await Promise.allSettled([
      db.sessions.bulkPut((sessions.data ?? []).map((r) => rowToSession(r, userId))),
      db.sets.bulkPut((sets.data ?? []).map((r) => rowToSet(r, userId))),
      db.bodyStats.bulkPut((bodyStats.data ?? []).map((r) => rowToBodyStat(r, userId))),
      db.exercisePrefs.bulkPut((exercisePrefs.data ?? []).map((r) => rowToExercisePref(r, userId))),
      db.templateExercises.bulkPut((templateExercises.data ?? []).map((r) => rowToTemplateExercise(r, userId))),
      db.templateStretches.bulkPut((templateStretches.data ?? []).map((r) => rowToTemplateStretch(r, userId))),
      db.customExercises.bulkPut((customExercises.data ?? []).map((r) => rowToCustomExercise(r, userId))),
    ]);

    rowsUpdated =
      (sessions.data?.length ?? 0) +
      (sets.data?.length ?? 0) +
      (bodyStats.data?.length ?? 0) +
      (exercisePrefs.data?.length ?? 0) +
      (templateExercises.data?.length ?? 0) +
      (templateStretches.data?.length ?? 0) +
      (customExercises.data?.length ?? 0);

    // Log any Dexie write failures without crashing
    writes.forEach((r) => { if (r.status === 'rejected') console.warn('deltaSync write failed:', r.reason); });

    await db.syncMeta.update(userId, { lastSyncedAt: Date.now() });
  } catch (err) {
    console.warn('deltaSync failed (non-fatal):', err);
  }

  return rowsUpdated;
}

// Pushes all queued offline operations to Supabase.
// Per-operation error handling: failures are marked and retried next sync.
export async function pushQueue(userId: string): Promise<{ success: number; failed: number }> {
  const db = getDB(userId);
  const operations = await db.syncQueue.where('userId').equals(userId).sortBy('createdAt');

  let success = 0;
  let failed = 0;

  for (const op of operations) {
    try {
      await applyOperation(op, userId);
      await db.syncQueue.delete(op.id);
      success++;
    } catch (err) {
      await db.syncQueue.update(op.id, {
        attempts: op.attempts + 1,
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }
  }

  return { success, failed };
}

// Pushes the queue then runs a delta sync. Called on reconnect and app startup.
export async function syncAll(userId: string): Promise<void> {
  try {
    await pushQueue(userId);
  } catch (err) {
    // Queue push failure should not prevent delta sync
    console.warn('pushQueue error during syncAll:', err);
  }
  await deltaSync(userId);
}

// Enqueues a write operation for later sync to Supabase.
// payload for 'upsert': snake_case row ready for Supabase
// payload for 'delete': { id: string }
// payload for 'replaceAll': ReplaceAllPayload
export async function enqueueSync(
  userId: string,
  table: SupabaseTableName,
  operation: SyncOperation['operation'],
  payload: unknown,
): Promise<void> {
  const db = getDB(userId);
  await db.syncQueue.add({
    id: nanoid(),
    userId,
    table,
    operation,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  });
}

// ─── Internal ─────────────────────────────────────────────────────

async function applyOperation(op: SyncOperation, userId: string): Promise<void> {
  if (op.operation === 'upsert') {
    const payload = op.payload as Record<string, unknown>;
    const onConflict = op.table === 'exercise_prefs' ? 'user_id,exercise_id' : 'id';
    const { error } = await supabase.from(op.table).upsert(payload, { onConflict });
    if (error) throw new Error(error.message);
    return;
  }

  if (op.operation === 'delete') {
    const { id } = op.payload as { id: string };
    const { error } = await supabase.from(op.table).delete().eq('id', id).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }

  if (op.operation === 'replaceAll') {
    const { templateId, phase, rows, version } = op.payload as ReplaceAllPayload;
    const db = getDB(userId);

    // Conflict check: skip if a newer version was already applied locally
    const versionKey = phase ? `${userId}_${templateId}_${phase}` : `${userId}_${templateId}`;
    const stored = await db.templateVersions.get(versionKey);
    if (stored && stored.version > version) return;

    let deleteQuery = supabase.from(op.table).delete().eq('user_id', userId).eq('template_id', templateId);
    if (phase) {
      // Dexie table type doesn't have 'phase' on template_exercises, only template_stretches
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deleteQuery = (deleteQuery as any).eq('phase', phase);
    }
    const { error: deleteError } = await deleteQuery;
    if (deleteError) throw new Error(deleteError.message);

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from(op.table).insert(rows);
      if (insertError) throw new Error(insertError.message);
    }

    await db.templateVersions.put({ key: versionKey, version });
  }
}

// ─── Online listener setup ────────────────────────────────────────

let syncUserId: string | null = null;
let activeHandler: (() => void) | null = null;

export function registerOnlineSync(userId: string): () => void {
  // Remove any existing listener before adding a new one
  if (activeHandler) {
    window.removeEventListener('online', activeHandler);
    activeHandler = null;
  }

  syncUserId = userId;

  const handler = () => {
    if (syncUserId) void syncAll(syncUserId);
  };

  activeHandler = handler;
  window.addEventListener('online', handler);

  return () => {
    window.removeEventListener('online', handler);
    if (activeHandler === handler) activeHandler = null;
    if (syncUserId === userId) syncUserId = null;
  };
}
