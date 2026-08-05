import { supabase } from '@/lib/supabase';
import { getDB } from '@/data/db';
import { getLocalSession } from '@/lib/auth';

export type ImportResult = {
  sessions: number;
  sets: number;
  bodyStats: number;
  exercisePrefs: number;
};

// ─── Export ──────────────────────────────────────────────────────

export async function exportData(userId: string): Promise<void> {
  // Read from Dexie — works offline, faster than network
  const user = getLocalSession();
  const db = user ? getDB(user.id) : null;

  const [sessions, sets, bodyStats, exercisePrefs, templateExercises, templateStretches, customExercises] =
    db
      ? await Promise.all([
          db.sessions.where('userId').equals(userId).toArray(),
          db.sets.where('userId').equals(userId).toArray(),
          db.bodyStats.where('userId').equals(userId).toArray(),
          db.exercisePrefs.where('[userId+exerciseId]').between([userId, ''], [userId, '￿']).toArray(),
          db.templateExercises.where('[userId+templateId]').between([userId, ''], [userId, '￿']).toArray(),
          db.templateStretches.where('[userId+templateId]').between([userId, ''], [userId, '￿']).toArray(),
          db.customExercises.where('userId').equals(userId).toArray(),
        ])
      : [[], [], [], [], [], [], []];

  const payload = {
    version: 2,
    exportedAt: Date.now(),
    sessions: sessions.map((r) => ({
      id:              r.id,
      templateId:      r.templateId,
      startedAt:       r.startedAt,
      completedAt:     r.completedAt,
      durationSeconds: r.durationSeconds,
      notes:           r.notes,
    })),
    sets: sets.map((r) => ({
      id:          r.id,
      sessionId:   r.sessionId,
      exerciseId:  r.exerciseId,
      setNumber:   r.setNumber,
      weightKg:    r.weightKg,
      reps:        r.reps,
      rir:         r.rir,
      isWarmup:    r.isWarmup,
      isPR:        r.isPR,
      completedAt: r.completedAt,
    })),
    bodyStats: bodyStats.map((r) => ({
      id:         r.id,
      date:       r.date,
      weightKg:   r.weightKg,
      waistCm:    r.waistCm,
      chestCm:    r.chestCm,
      notes:      r.notes,
      photoPaths: r.photoPaths,
    })),
    exercisePrefs: exercisePrefs.map((r) => ({
      exerciseId:       r.exerciseId,
      startingWeightKg: r.startingWeightKg,
      startingReps:     r.startingReps,
    })),
    templateExercises: templateExercises.map((r) => ({
      id:              r.id,
      templateId:      r.templateId,
      exerciseId:      r.exerciseId,
      position:        r.position,
      sets:            r.sets,
      repRangeMin:     r.repRangeMin,
      repRangeMax:     r.repRangeMax,
      isSuperset:      r.isSuperset,
      supersetGroupId: r.supersetGroupId,
    })),
    templateStretches: templateStretches.map((r) => ({
      id:          r.id,
      templateId:  r.templateId,
      exerciseId:  r.exerciseId,
      phase:       r.phase,
      position:    r.position,
      restSeconds: r.restSeconds,
    })),
    customExercises: customExercises.map((r) => ({
      id:               r.id,
      name:             r.name,
      category:         r.category,
      type:             r.type,
      muscles:          r.muscles,
      defaultRepRange:  r.defaultRepRange,
      startingWeightKg: r.startingWeightKg,
      restSeconds:      r.restSeconds,
      isBodyweight:     r.isBodyweight,
      isCable:          r.isCable,
      isTimed:          r.isTimed,
      isStretch:        r.isStretch,
      videoUrl:         r.videoUrl,
      notes:            r.notes,
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reugym-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Import from JSON file ────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

export async function importFromJson(raw: unknown, userId: string): Promise<ImportResult> {
  const data = raw as AnyRecord;
  return upsertAll(
    (data.sessions as AnyRecord[] | undefined) ?? [],
    (data.sets as AnyRecord[] | undefined) ?? [],
    (data.bodyStats as AnyRecord[] | undefined) ?? [],
    (data.exercisePrefs as AnyRecord[] | undefined) ?? [],
    userId,
  );
}

// ─── Migrate from IndexedDB (old Dexie app) ──────────────────────

function readIDBStore(db: IDBDatabase, storeName: string): Promise<AnyRecord[]> {
  if (!db.objectStoreNames.contains(storeName)) return Promise.resolve([]);
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as AnyRecord[]);
    req.onerror = () => resolve([]);
  });
}

export async function migrateFromIndexedDB(userId: string): Promise<ImportResult> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('ReuGymDB');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Could not open ReuGymDB. The old app may not have been used on this browser.'));
  });

  const [sessions, sets, bodyStats, exercisePrefs] = await Promise.all([
    readIDBStore(db, 'sessions'),
    readIDBStore(db, 'sets'),
    readIDBStore(db, 'bodyStats'),
    readIDBStore(db, 'exercisePrefs'),
  ]);
  db.close();

  return upsertAll(sessions, sets, bodyStats, exercisePrefs, userId);
}

// ─── Shared upsert logic ─────────────────────────────────────────

async function upsertAll(
  sessions: AnyRecord[],
  sets: AnyRecord[],
  bodyStats: AnyRecord[],
  exercisePrefs: AnyRecord[],
  userId: string,
): Promise<ImportResult> {
  const batchUpsert = async (table: string, rows: AnyRecord[]) => {
    if (rows.length === 0) return;
    // Supabase upsert in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      await supabase.from(table).upsert(rows.slice(i, i + 500));
    }
  };

  await batchUpsert('workout_sessions', sessions.map((s) => ({
    id:              s.id,
    user_id:         userId,
    template_id:     s.templateId,
    started_at:      s.startedAt,
    completed_at:    s.completedAt ?? null,
    duration_seconds:s.durationSeconds ?? null,
    notes:           s.notes ?? null,
  })));

  await batchUpsert('logged_sets', sets.map((s) => ({
    id:          s.id,
    user_id:     userId,
    session_id:  s.sessionId,
    exercise_id: s.exerciseId,
    set_number:  s.setNumber,
    weight_kg:   s.weightKg,
    reps:        s.reps,
    rir:         (s.rir as number) ?? 2,
    is_warmup:   s.isWarmup ?? false,
    is_pr:       s.isPR ?? false,
    completed_at:s.completedAt,
  })));

  await batchUpsert('body_stats', bodyStats.map((s) => ({
    id:          s.id,
    user_id:     userId,
    date:        s.date,
    weight_kg:   s.weightKg ?? null,
    waist_cm:    s.waistCm ?? null,
    chest_cm:    s.chestCm ?? null,
    notes:       s.notes ?? null,
    photo_paths: s.photoPaths ?? [],
  })));

  await batchUpsert('exercise_prefs', exercisePrefs.map((p) => ({
    user_id:           userId,
    exercise_id:       p.exerciseId,
    starting_weight_kg:p.startingWeightKg,
    starting_reps:     p.startingReps ?? null,
  })));

  return {
    sessions:      sessions.length,
    sets:          sets.length,
    bodyStats:     bodyStats.length,
    exercisePrefs: exercisePrefs.length,
  };
}
