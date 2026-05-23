import { supabase } from '@/lib/supabase';

export type ImportResult = {
  sessions: number;
  sets: number;
  bodyStats: number;
  exercisePrefs: number;
};

// ─── Export ──────────────────────────────────────────────────────

export async function exportData(userId: string): Promise<void> {
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

  const payload = {
    version: 2,
    exportedAt: Date.now(),
    sessions: (sessions.data ?? []).map((r) => ({
      id:              r.id,
      templateId:      r.template_id,
      startedAt:       r.started_at,
      completedAt:     r.completed_at,
      durationSeconds: r.duration_seconds,
      notes:           r.notes,
    })),
    sets: (sets.data ?? []).map((r) => ({
      id:          r.id,
      sessionId:   r.session_id,
      exerciseId:  r.exercise_id,
      setNumber:   r.set_number,
      weightKg:    r.weight_kg,
      reps:        r.reps,
      rir:         r.rir,
      isWarmup:    r.is_warmup,
      isPR:        r.is_pr,
      completedAt: r.completed_at,
    })),
    bodyStats: (bodyStats.data ?? []).map((r) => ({
      id:       r.id,
      date:     r.date,
      weightKg: r.weight_kg,
      waistCm:  r.waist_cm,
      chestCm:  r.chest_cm,
      notes:    r.notes,
    })),
    exercisePrefs: (exercisePrefs.data ?? []).map((r) => ({
      exerciseId:       r.exercise_id,
      startingWeightKg: r.starting_weight_kg,
      startingReps:     r.starting_reps,
    })),
    templateExercises: (templateExercises.data ?? []).map((r) => ({
      id:             r.id,
      templateId:     r.template_id,
      exerciseId:     r.exercise_id,
      position:       r.position,
      sets:           r.sets,
      repRangeMin:    r.rep_range_min,
      repRangeMax:    r.rep_range_max,
      isSuperset:     r.is_superset,
      supersetGroupId:r.superset_group_id,
    })),
    templateStretches: (templateStretches.data ?? []).map((r) => ({
      id:          r.id,
      templateId:  r.template_id,
      exerciseId:  r.exercise_id,
      phase:       r.phase,
      position:    r.position,
      restSeconds: r.rest_seconds,
    })),
    customExercises: (customExercises.data ?? []).map((r) => ({
      id:               r.id,
      name:             r.name,
      category:         r.category,
      type:             r.type,
      muscles:          r.muscles,
      defaultRepRange:  r.default_rep_range,
      startingWeightKg: r.starting_weight_kg,
      restSeconds:      r.rest_seconds,
      isBodyweight:     r.is_bodyweight,
      isCable:          r.is_cable,
      isTimed:          r.is_timed,
      isStretch:        r.is_stretch,
      videoUrl:         r.video_url,
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
    id:        s.id,
    user_id:   userId,
    date:      s.date,
    weight_kg: s.weightKg ?? null,
    waist_cm:  s.waistCm ?? null,
    chest_cm:  s.chestCm ?? null,
    notes:     s.notes ?? null,
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
