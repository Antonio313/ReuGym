import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nanoid } from 'nanoid';

// ─── In-memory Supabase mock ──────────────────────────────────────
// vi.hoisted runs before module imports, so these helpers are accessible
// inside the vi.mock factory below.

const mockUtils = vi.hoisted(() => {
  let db: Map<string, Record<string, unknown>[]> = new Map();
  let errs: Map<string, { message: string }> = new Map();

  function makeBuilder(tableName: string) {
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    let op = 'read';
    let payload: Record<string, unknown>[] = [];
    let conflictKey = 'id';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select() { return b; },
      order() { return b; },
      limit() { return b; },
      eq(col: string, val: unknown) { filters.push((r) => r[col] === val); return b; },
      neq(col: string, val: unknown) { filters.push((r) => r[col] !== val); return b; },
      gte(col: string, val: unknown) { filters.push((r) => (r[col] as number) >= (val as number)); return b; },
      maybeSingle() { return b; },
      single() { return b; },
      delete() { op = 'delete'; return b; },
      insert(data: Record<string, unknown> | Record<string, unknown>[]) {
        op = 'insert';
        payload = Array.isArray(data) ? data : [data];
        return b;
      },
      upsert(data: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string }) {
        op = 'upsert';
        payload = Array.isArray(data) ? data : [data];
        conflictKey = opts?.onConflict ?? 'id';
        return b;
      },
      then(resolve: (v: unknown) => void) {
        const err = errs.get(tableName);
        if (err) { resolve({ data: null, error: err }); return; }

        if (!db.has(tableName)) db.set(tableName, []);
        const rows = db.get(tableName)!;

        if (op === 'read') {
          resolve({ data: rows.filter((r) => filters.every((f) => f(r))), error: null });
          return;
        }
        if (op === 'delete') {
          db.set(tableName, rows.filter((r) => !filters.every((f) => f(r))));
          resolve({ data: null, error: null });
          return;
        }
        if (op === 'insert') {
          rows.push(...payload);
          resolve({ data: payload, error: null });
          return;
        }
        if (op === 'upsert') {
          const keys = conflictKey.split(',').map((k) => k.trim());
          for (const row of payload) {
            const idx = rows.findIndex((r) => keys.every((k) => r[k] === row[k]));
            if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
            else rows.push(row);
          }
          resolve({ data: payload, error: null });
          return;
        }
      },
    };
    return b;
  }

  return {
    reset() { db = new Map(); errs = new Map(); },
    seed(table: string, rows: Record<string, unknown>[]) { db.set(table, [...rows]); },
    getRows(table: string) { return db.get(table) ?? []; },
    setError(table: string, message: string) { errs.set(table, { message }); },
    makeBuilder,
    getDB() { return db; },
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockUtils.makeBuilder(table),
  },
}));

// ─── Import sync functions after mock is set up ───────────────────

import { initialSync, deltaSync, pushQueue, syncAll, enqueueSync } from '@/lib/sync';
import { getDB } from '@/data/db';

// ─── Test helpers ─────────────────────────────────────────────────

function makeUser() {
  // Unique userId per test — each gets its own Dexie database (ReuGymDB_${userId})
  const userId = `test-${nanoid(8)}`;
  return { userId, db: getDB(userId) };
}

const NOW = Date.now(); // must be recent so deltaSync's 7-day window includes test rows

// ─── initialSync ─────────────────────────────────────────────────

describe('initialSync', () => {
  beforeEach(() => mockUtils.reset());

  it('populates all 7 Dexie tables from Supabase', async () => {
    const { userId, db } = makeUser();

    mockUtils.seed('workout_sessions', [
      { id: 'sess-1', user_id: userId, template_id: 'push', started_at: NOW, completed_at: NOW + 3600000, duration_seconds: 3600 },
    ]);
    mockUtils.seed('logged_sets', [
      { id: 'set-1', user_id: userId, session_id: 'sess-1', exercise_id: 'bench', set_number: 1, weight_kg: 80, reps: 8, rir: 2, is_warmup: false, is_pr: false, completed_at: NOW + 100 },
      { id: 'set-2', user_id: userId, session_id: 'sess-1', exercise_id: 'bench', set_number: 2, weight_kg: 80, reps: 7, rir: 1, is_warmup: false, is_pr: true, completed_at: NOW + 200 },
    ]);
    mockUtils.seed('body_stats', [
      { id: 'stat-1', user_id: userId, date: NOW, weight_kg: 82.5, waist_cm: 85, chest_cm: 100 },
    ]);
    mockUtils.seed('exercise_prefs', [
      { user_id: userId, exercise_id: 'bench', starting_weight_kg: 80, starting_reps: 8 },
    ]);
    mockUtils.seed('template_exercises', [
      { id: 'te-1', user_id: userId, template_id: 'push', exercise_id: 'bench', position: 0, sets: 4, rep_range_min: 6, rep_range_max: 8, starting_weight_kg: 80, rest_seconds: 120, is_bodyweight: false, is_timed: false, is_superset: false },
    ]);
    mockUtils.seed('template_stretches', [
      { id: 'ts-1', user_id: userId, template_id: 'push', exercise_id: 'chest-stretch', phase: 'post', position: 0, sets: 1, rep_range_min: 30, rep_range_max: 30, starting_weight_kg: 0, rest_seconds: 30, is_bodyweight: true, is_timed: true },
    ]);
    mockUtils.seed('custom_exercises', [
      { id: 'ce-1', user_id: userId, name: 'My Exercise', category: 'push', type: 'accessory', muscles: ['chest'], is_bodyweight: false, is_cable: false, is_timed: false, is_stretch: false },
    ]);

    await initialSync(userId);

    // Verify each table populated
    expect(await db.sessions.count()).toBe(1);
    expect(await db.sets.count()).toBe(2);
    expect(await db.bodyStats.count()).toBe(1);
    expect(await db.exercisePrefs.count()).toBe(1);
    expect(await db.templateExercises.count()).toBe(1);
    expect(await db.templateStretches.count()).toBe(1);
    expect(await db.customExercises.count()).toBe(1);
  });

  it('converts snake_case Supabase rows to camelCase Dexie rows', async () => {
    const { userId, db } = makeUser();

    mockUtils.seed('logged_sets', [
      { id: 'set-1', user_id: userId, session_id: 'sess-1', exercise_id: 'bench', set_number: 3, weight_kg: 100, reps: 5, rir: 0, is_warmup: false, is_pr: true, completed_at: NOW },
    ]);

    await initialSync(userId);

    const set = await db.sets.get('set-1');
    expect(set).toBeDefined();
    expect(set!.sessionId).toBe('sess-1');     // snake → camel
    expect(set!.exerciseId).toBe('bench');
    expect(set!.setNumber).toBe(3);
    expect(set!.weightKg).toBe(100);
    expect(set!.isPR).toBe(true);
    expect(set!.isWarmup).toBe(false);
    expect(set!.completedAt).toBe(NOW);
    expect(set!.userId).toBe(userId);
  });

  it('sets initialSyncComplete and lastSyncedAt in syncMeta', async () => {
    const { userId, db } = makeUser();
    const before = Date.now();

    await initialSync(userId);

    const meta = await db.syncMeta.get(userId);
    expect(meta?.initialSyncComplete).toBe(true);
    expect(meta?.lastSyncedAt).toBeGreaterThanOrEqual(before);
  });

  it('overwrites existing Dexie data when run again (safe to re-run)', async () => {
    const { userId, db } = makeUser();

    mockUtils.seed('logged_sets', [
      { id: 'set-1', user_id: userId, session_id: 's', exercise_id: 'bench', set_number: 1, weight_kg: 80, reps: 8, rir: 2, is_warmup: false, is_pr: false, completed_at: NOW },
    ]);
    await initialSync(userId);
    expect(await db.sets.count()).toBe(1);

    // Update mock and re-run — should add the new row
    mockUtils.seed('logged_sets', [
      { id: 'set-1', user_id: userId, session_id: 's', exercise_id: 'bench', set_number: 1, weight_kg: 85, reps: 8, rir: 1, is_warmup: false, is_pr: true, completed_at: NOW },
      { id: 'set-2', user_id: userId, session_id: 's', exercise_id: 'bench', set_number: 2, weight_kg: 85, reps: 7, rir: 0, is_warmup: false, is_pr: false, completed_at: NOW + 100 },
    ]);
    await initialSync(userId);

    expect(await db.sets.count()).toBe(2);
    const set1 = await db.sets.get('set-1');
    expect(set1!.weightKg).toBe(85); // updated value
  });

  it('throws when Supabase returns an error', async () => {
    const { userId } = makeUser();
    mockUtils.setError('workout_sessions', 'Connection refused');
    await expect(initialSync(userId)).rejects.toThrow('Connection refused');
  });
});

// ─── deltaSync ───────────────────────────────────────────────────

describe('deltaSync', () => {
  beforeEach(() => mockUtils.reset());

  it('upserts new rows from Supabase into Dexie', async () => {
    const { userId, db } = makeUser();

    // Start with one set already synced
    await db.sets.put({ id: 'old-set', userId, sessionId: 's', exerciseId: 'squat', setNumber: 1, weightKg: 100, reps: 5, rir: 2, isWarmup: false, isPR: false, completedAt: NOW - 1000 });
    await db.syncMeta.put({ userId, initialSyncComplete: true, lastSyncedAt: NOW - 1000 });

    // Mock returns a new set from another device
    mockUtils.seed('logged_sets', [
      { id: 'new-set', user_id: userId, session_id: 's', exercise_id: 'squat', set_number: 2, weight_kg: 100, reps: 4, rir: 1, is_warmup: false, is_pr: false, completed_at: NOW },
    ]);

    await deltaSync(userId);

    expect(await db.sets.count()).toBe(2);
    expect(await db.sets.get('new-set')).toBeDefined();
    // Original row untouched
    expect(await db.sets.get('old-set')).toBeDefined();
  });

  it('updates lastSyncedAt in syncMeta after successful sync', async () => {
    const { userId, db } = makeUser();
    await db.syncMeta.put({ userId, initialSyncComplete: true, lastSyncedAt: NOW - 5000 });

    const before = Date.now();
    await deltaSync(userId);
    const after = Date.now();

    const meta = await db.syncMeta.get(userId);
    expect(meta?.lastSyncedAt).toBeGreaterThanOrEqual(before);
    expect(meta?.lastSyncedAt).toBeLessThanOrEqual(after);
  });

  it('does not throw when Supabase fails — non-fatal', async () => {
    const { userId } = makeUser();
    mockUtils.setError('logged_sets', 'Network timeout');

    // Should resolve without throwing (errors are swallowed)
    await expect(deltaSync(userId)).resolves.toBeDefined();
  });

  it('returns the count of rows received from Supabase', async () => {
    const { userId } = makeUser();
    mockUtils.seed('logged_sets', [
      { id: 's1', user_id: userId, session_id: 'x', exercise_id: 'bench', set_number: 1, weight_kg: 80, reps: 8, rir: 2, is_warmup: false, is_pr: false, completed_at: NOW },
      { id: 's2', user_id: userId, session_id: 'x', exercise_id: 'bench', set_number: 2, weight_kg: 80, reps: 7, rir: 1, is_warmup: false, is_pr: false, completed_at: NOW + 60 },
    ]);

    const count = await deltaSync(userId);
    // Count includes rows from all 7 tables; at minimum the 2 sets we seeded
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

// ─── pushQueue ───────────────────────────────────────────────────

describe('pushQueue', () => {
  beforeEach(() => mockUtils.reset());

  it('applies a queued upsert to Supabase and removes it from the queue', async () => {
    const { userId, db } = makeUser();

    await enqueueSync(userId, 'exercise_prefs', 'upsert', {
      user_id: userId,
      exercise_id: 'bench',
      starting_weight_kg: 90,
      starting_reps: null,
    });

    expect(await db.syncQueue.count()).toBe(1);

    const result = await pushQueue(userId);

    expect(result.success).toBe(1);
    expect(result.failed).toBe(0);
    expect(await db.syncQueue.count()).toBe(0);

    // Verify the row was written to the mock Supabase store
    const prefs = mockUtils.getRows('exercise_prefs');
    expect(prefs).toHaveLength(1);
    expect(prefs[0].starting_weight_kg).toBe(90);
  });

  it('applies a queued delete to Supabase and removes it from the queue', async () => {
    const { userId, db } = makeUser();

    // Seed the mock store so there is something to delete
    mockUtils.seed('custom_exercises', [
      { id: 'ce-1', user_id: userId, name: 'Old Exercise' },
    ]);

    await enqueueSync(userId, 'custom_exercises', 'delete', { id: 'ce-1' });
    await pushQueue(userId);

    expect(await db.syncQueue.count()).toBe(0);
    expect(mockUtils.getRows('custom_exercises')).toHaveLength(0);
  });

  it('increments attempts and stores error when Supabase fails', async () => {
    const { userId, db } = makeUser();
    mockUtils.setError('exercise_prefs', 'Simulated failure');

    await enqueueSync(userId, 'exercise_prefs', 'upsert', { user_id: userId, exercise_id: 'bench', starting_weight_kg: 80 });

    const result = await pushQueue(userId);

    expect(result.success).toBe(0);
    expect(result.failed).toBe(1);

    // Operation stays in queue with incremented attempts
    const ops = await db.syncQueue.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0].attempts).toBe(1);
    expect(ops[0].error).toContain('Simulated failure');
  });

  it('applies a replaceAll operation with a higher version', async () => {
    const { userId, db } = makeUser();
    const templateId = 'push';

    // Seed existing template rows in mock Supabase
    mockUtils.seed('template_exercises', [
      { id: 'old-1', user_id: userId, template_id: templateId, position: 0 },
    ]);

    const newRows = [
      { id: 'new-1', user_id: userId, template_id: templateId, exercise_id: 'bench', position: 0, sets: 4, rep_range_min: 6, rep_range_max: 8 },
      { id: 'new-2', user_id: userId, template_id: templateId, exercise_id: 'ohp', position: 1, sets: 3, rep_range_min: 8, rep_range_max: 10 },
    ];

    await enqueueSync(userId, 'template_exercises', 'replaceAll', {
      templateId,
      userId,
      rows: newRows,
      version: 2,
    });

    await pushQueue(userId);

    const rows = mockUtils.getRows('template_exercises');
    // Old row deleted, new rows inserted
    expect(rows.find((r) => r.id === 'old-1')).toBeUndefined();
    expect(rows.find((r) => r.id === 'new-1')).toBeDefined();
    expect(rows.find((r) => r.id === 'new-2')).toBeDefined();

    // Version stored in Dexie
    const versionKey = `${userId}_${templateId}`;
    const storedVersion = await db.templateVersions.get(versionKey);
    expect(storedVersion?.version).toBe(2);
  });

  it('skips a replaceAll operation whose version is lower than the stored version (conflict resolution)', async () => {
    const { userId, db } = makeUser();
    const templateId = 'push';

    // Pre-seed a higher version in Dexie — simulates Device B already synced version 5
    await db.templateVersions.put({ key: `${userId}_${templateId}`, version: 5 });

    // Seed existing rows that should NOT be replaced
    mockUtils.seed('template_exercises', [
      { id: 'device-b-row', user_id: userId, template_id: templateId, position: 0 },
    ]);

    // Device A's stale version 3 queued operation
    await enqueueSync(userId, 'template_exercises', 'replaceAll', {
      templateId,
      userId,
      rows: [{ id: 'device-a-row', user_id: userId, template_id: templateId, position: 0 }],
      version: 3,
    });

    await pushQueue(userId);

    // Device B's rows are preserved — stale operation was skipped
    const rows = mockUtils.getRows('template_exercises');
    expect(rows.find((r) => r.id === 'device-b-row')).toBeDefined();
    expect(rows.find((r) => r.id === 'device-a-row')).toBeUndefined();
  });

  it('processes multiple queued operations and returns correct counts', async () => {
    const { userId } = makeUser();

    await enqueueSync(userId, 'exercise_prefs', 'upsert', { user_id: userId, exercise_id: 'squat', starting_weight_kg: 100 });
    await enqueueSync(userId, 'exercise_prefs', 'upsert', { user_id: userId, exercise_id: 'bench', starting_weight_kg: 80 });
    await enqueueSync(userId, 'exercise_prefs', 'upsert', { user_id: userId, exercise_id: 'deadlift', starting_weight_kg: 120 });

    const result = await pushQueue(userId);

    expect(result.success).toBe(3);
    expect(result.failed).toBe(0);
    expect(mockUtils.getRows('exercise_prefs')).toHaveLength(3);
  });
});

// ─── syncAll ─────────────────────────────────────────────────────

describe('syncAll', () => {
  beforeEach(() => mockUtils.reset());

  it('pushes the queue then runs a delta sync', async () => {
    const { userId, db } = makeUser();

    // Queue an offline write
    await enqueueSync(userId, 'exercise_prefs', 'upsert', {
      user_id: userId,
      exercise_id: 'bench',
      starting_weight_kg: 85,
    });

    // Seed Supabase with data for delta sync to pull
    mockUtils.seed('logged_sets', [
      { id: 'remote-set', user_id: userId, session_id: 's', exercise_id: 'squat', set_number: 1, weight_kg: 120, reps: 5, rir: 1, is_warmup: false, is_pr: false, completed_at: NOW },
    ]);

    await syncAll(userId);

    // Queue should be empty (push succeeded)
    expect(await db.syncQueue.count()).toBe(0);
    // Supabase should have the upserted pref
    expect(mockUtils.getRows('exercise_prefs')).toHaveLength(1);
    // Delta sync should have pulled the remote set into Dexie
    expect(await db.sets.get('remote-set')).toBeDefined();
  });

  it('runs deltaSync even if pushQueue throws', async () => {
    const { userId, db } = makeUser();

    // Queue an op that will fail
    await enqueueSync(userId, 'exercise_prefs', 'upsert', {
      user_id: userId,
      exercise_id: 'bench',
      starting_weight_kg: 85,
    });
    mockUtils.setError('exercise_prefs', 'Hard failure');

    // Seed data for delta sync
    mockUtils.seed('logged_sets', [
      { id: 'remote-set', user_id: userId, session_id: 's', exercise_id: 'squat', set_number: 1, weight_kg: 120, reps: 5, rir: 1, is_warmup: false, is_pr: false, completed_at: NOW },
    ]);

    // syncAll should not throw even though pushQueue had failures
    await expect(syncAll(userId)).resolves.toBeUndefined();

    // Delta sync still ran — remote set was pulled in
    expect(await db.sets.get('remote-set')).toBeDefined();
  });
});

// ─── enqueueSync ─────────────────────────────────────────────────

describe('enqueueSync', () => {
  beforeEach(() => mockUtils.reset());

  it('adds an operation to the syncQueue with correct fields', async () => {
    const { userId, db } = makeUser();
    const before = Date.now();

    await enqueueSync(userId, 'body_stats', 'upsert', { id: 'stat-1', user_id: userId, date: NOW, weight_kg: 80 });

    const ops = await db.syncQueue.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0].userId).toBe(userId);
    expect(ops[0].table).toBe('body_stats');
    expect(ops[0].operation).toBe('upsert');
    expect(ops[0].attempts).toBe(0);
    expect(ops[0].createdAt).toBeGreaterThanOrEqual(before);
  });
});
