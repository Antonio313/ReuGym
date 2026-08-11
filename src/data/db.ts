import Dexie, { type Table } from 'dexie';
import type { SubstituteConfig } from '@/types';

// ─── Dexie Row Types (camelCase, mirrors Supabase tables) ─────────

export type DexieSet = {
  id: string;
  userId: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rir: number;
  isWarmup: boolean;
  isPR: boolean;
  completedAt: number;
  side?: 'left' | 'right';
};

export type DexieSession = {
  id: string;
  userId: string;
  templateId: string;
  startedAt: number;
  completedAt?: number;
  durationSeconds?: number;
  notes?: string;
};

export type DexieBodyStat = {
  id: string;
  userId: string;
  date: number;
  weightKg?: number;
  waistCm?: number;
  chestCm?: number;
  notes?: string;
  photoPaths: string[];
};

// exercise_prefs has no id — compound PK [userId+exerciseId]
export type DexieExercisePref = {
  userId: string;
  exerciseId: string;
  startingWeightKg: number;
  startingReps?: number;
};

// loadout_names has no id — compound PK [userId+templateId]. Only exists for
// a loadout the user has renamed away from its static default.
export type DexieLoadoutName = {
  userId: string;
  templateId: string;
  name: string;
};

// active_loadouts has no id — compound PK [userId+category]. One row per
// day/category once the user has ever switched away from Loadout 1.
export type DexieActiveLoadout = {
  userId: string;
  category: string;
  templateId: string;
};

export type DexieTemplateExercise = {
  id: string;
  userId: string;
  templateId: string;
  exerciseId: string;
  position: number;
  sets: number;
  repRangeMin: number;
  repRangeMax: number;
  startingWeightKg: number;
  restSeconds: number;
  isBodyweight: boolean;
  isTimed: boolean;
  isPerSide: boolean;
  isSuperset: boolean;
  supersetGroupId?: string;
  substitutes?: SubstituteConfig[];
};

export type DexieTemplateStretch = {
  id: string;
  userId: string;
  templateId: string;
  exerciseId: string;
  phase: 'pre' | 'post';
  position: number;
  sets: number;
  repRangeMin: number;
  repRangeMax: number;
  startingWeightKg: number;
  restSeconds: number;
  isBodyweight: boolean;
  isTimed: boolean;
  isPerSide: boolean;
};

export type DexieCustomExercise = {
  id: string;
  userId: string;
  name: string;
  category: string;
  type: string;
  muscles: string[];
  defaultRepRange?: [number, number];
  startingWeightKg?: number;
  restSeconds?: number;
  isBodyweight?: boolean;
  isCable?: boolean;
  isTimed?: boolean;
  isStretch?: boolean;
  videoUrl?: string;
  notes?: string;
};

// Shared library, not user-scoped — one copy synced into every user's local
// DB, overridden per-id by a matching customExercises row exactly like the
// static file it replaced. See migration 011_default_exercises.sql.
export type DexieDefaultExercise = {
  id: string;
  name: string;
  category: string;
  type: string;
  muscles: string[];
  defaultRepRange?: [number, number];
  restSeconds?: number;
  isBodyweight?: boolean;
  isCable?: boolean;
  isTimed?: boolean;
  isStretch?: boolean;
  videoUrl?: string;
};

// ─── Sync Infrastructure Types ────────────────────────────────────

export type SupabaseTableName =
  | 'logged_sets'
  | 'workout_sessions'
  | 'body_stats'
  | 'exercise_prefs'
  | 'template_exercises'
  | 'template_stretches'
  | 'custom_exercises'
  | 'loadout_names'
  | 'active_loadouts'
  | 'users';

export type ReplaceAllPayload = {
  templateId: string;
  phase?: 'pre' | 'post';
  userId: string;
  rows: Record<string, unknown>[];
  version: number;
};

export type SyncOperation = {
  id: string;
  userId: string;
  table: SupabaseTableName;
  operation: 'upsert' | 'delete' | 'replaceAll';
  // upsert: snake_case row ready for Supabase
  // delete: { id: string }
  // replaceAll: ReplaceAllPayload
  payload: unknown;
  createdAt: number;
  attempts: number;
  error?: string;
};

export type SyncMeta = {
  userId: string;
  initialSyncComplete: boolean;
  lastSyncedAt: number;
};

// Tracks template versions for conflict resolution (higher version wins)
export type TemplateVersion = {
  key: string;   // `${userId}_${templateId}` or `${userId}_${templateId}_${phase}`
  version: number;
};

// ─── Dexie Database Class ─────────────────────────────────────────

class WorkoutDB extends Dexie {
  sets!: Table<DexieSet, string>;
  sessions!: Table<DexieSession, string>;
  bodyStats!: Table<DexieBodyStat, string>;
  exercisePrefs!: Table<DexieExercisePref, [string, string]>;
  templateExercises!: Table<DexieTemplateExercise, string>;
  templateStretches!: Table<DexieTemplateStretch, string>;
  customExercises!: Table<DexieCustomExercise, string>;
  defaultExercises!: Table<DexieDefaultExercise, string>;
  loadoutNames!: Table<DexieLoadoutName, [string, string]>;
  activeLoadouts!: Table<DexieActiveLoadout, [string, string]>;
  syncQueue!: Table<SyncOperation, string>;
  syncMeta!: Table<SyncMeta, string>;
  templateVersions!: Table<TemplateVersion, string>;

  constructor(dbName: string) {
    super(dbName);
    this.version(1).stores({
      sets:              'id, userId, [userId+exerciseId], [userId+sessionId], completedAt',
      sessions:          'id, userId, completedAt, startedAt',
      bodyStats:         'id, userId, date',
      exercisePrefs:     '[userId+exerciseId]',
      templateExercises: 'id, [userId+templateId]',
      templateStretches: 'id, [userId+templateId]',
      customExercises:   'id, userId',
      syncQueue:         'id, userId, createdAt',
      syncMeta:          'userId',
      templateVersions:  'key',
    });
    this.version(2).stores({
      loadoutNames:    '[userId+templateId]',
      activeLoadouts:  '[userId+category]',
    });
    this.version(3).stores({
      defaultExercises: 'id',
    });
  }
}

// ─── Per-user DB Factory ──────────────────────────────────────────

const dbCache = new Map<string, WorkoutDB>();

export function getDB(userId: string): WorkoutDB {
  if (!dbCache.has(userId)) {
    dbCache.set(userId, new WorkoutDB(`ReuGymDB_${userId}`));
  }
  return dbCache.get(userId)!;
}

// ─── Row Converters: Supabase snake_case → Dexie camelCase ────────

type Row = Record<string, unknown>;

export function rowToSet(r: Row, userId: string): DexieSet {
  return {
    id:          r.id as string,
    userId,
    sessionId:   r.session_id as string,
    exerciseId:  r.exercise_id as string,
    setNumber:   r.set_number as number,
    weightKg:    r.weight_kg as number,
    reps:        r.reps as number,
    rir:         (r.rir as number) ?? 0,
    isWarmup:    (r.is_warmup as boolean) ?? false,
    isPR:        (r.is_pr as boolean) ?? false,
    completedAt: r.completed_at as number,
    side:        r.side as 'left' | 'right' | undefined,
  };
}

export function rowToSession(r: Row, userId: string): DexieSession {
  return {
    id:              r.id as string,
    userId,
    templateId:      r.template_id as string,
    startedAt:       r.started_at as number,
    completedAt:     r.completed_at as number | undefined,
    durationSeconds: r.duration_seconds as number | undefined,
    notes:           r.notes as string | undefined,
  };
}

export function rowToBodyStat(r: Row, userId: string): DexieBodyStat {
  return {
    id:         r.id as string,
    userId,
    date:       r.date as number,
    weightKg:   r.weight_kg as number | undefined,
    waistCm:    r.waist_cm as number | undefined,
    chestCm:    r.chest_cm as number | undefined,
    notes:      r.notes as string | undefined,
    photoPaths: (r.photo_paths as string[] | null) ?? [],
  };
}

export function rowToExercisePref(r: Row, userId: string): DexieExercisePref {
  return {
    userId,
    exerciseId:       r.exercise_id as string,
    startingWeightKg: r.starting_weight_kg as number,
    startingReps:     r.starting_reps as number | undefined,
  };
}

export function rowToLoadoutName(r: Row, userId: string): DexieLoadoutName {
  return {
    userId,
    templateId: r.template_id as string,
    name:       r.name as string,
  };
}

export function rowToActiveLoadout(r: Row, userId: string): DexieActiveLoadout {
  return {
    userId,
    category:   r.category as string,
    templateId: r.template_id as string,
  };
}

export function rowToTemplateExercise(r: Row, userId: string): DexieTemplateExercise {
  return {
    id:              r.id as string,
    userId,
    templateId:      r.template_id as string,
    exerciseId:      r.exercise_id as string,
    position:        r.position as number,
    sets:            r.sets as number,
    repRangeMin:     r.rep_range_min as number,
    repRangeMax:     r.rep_range_max as number,
    startingWeightKg:(r.starting_weight_kg as number) ?? 0,
    restSeconds:     (r.rest_seconds as number) ?? 60,
    isBodyweight:    (r.is_bodyweight as boolean) ?? false,
    isTimed:         (r.is_timed as boolean) ?? false,
    isPerSide:       (r.is_per_side as boolean) ?? false,
    isSuperset:      (r.is_superset as boolean) ?? false,
    supersetGroupId: r.superset_group_id as string | undefined,
    substitutes:     (r.substitutes as SubstituteConfig[] | null) ?? [],
  };
}

export function rowToTemplateStretch(r: Row, userId: string): DexieTemplateStretch {
  return {
    id:              r.id as string,
    userId,
    templateId:      r.template_id as string,
    exerciseId:      r.exercise_id as string,
    phase:           r.phase as 'pre' | 'post',
    position:        r.position as number,
    sets:            (r.sets as number) ?? 1,
    repRangeMin:     (r.rep_range_min as number) ?? 1,
    repRangeMax:     (r.rep_range_max as number) ?? 1,
    startingWeightKg:(r.starting_weight_kg as number) ?? 0,
    restSeconds:     (r.rest_seconds as number) ?? 30,
    isBodyweight:    (r.is_bodyweight as boolean) ?? false,
    isTimed:         (r.is_timed as boolean) ?? false,
    isPerSide:       (r.is_per_side as boolean) ?? false,
  };
}

export function rowToCustomExercise(r: Row, userId: string): DexieCustomExercise {
  return {
    id:               r.id as string,
    userId,
    name:             r.name as string,
    category:         r.category as string,
    type:             r.type as string,
    muscles:          r.muscles as string[],
    defaultRepRange:  r.default_rep_range as [number, number] | undefined,
    startingWeightKg: r.starting_weight_kg as number | undefined,
    restSeconds:      r.rest_seconds as number | undefined,
    isBodyweight:     r.is_bodyweight as boolean | undefined,
    isCable:          r.is_cable as boolean | undefined,
    isTimed:          r.is_timed as boolean | undefined,
    isStretch:        r.is_stretch as boolean | undefined,
    videoUrl:         r.video_url as string | undefined,
    notes:            r.notes as string | undefined,
  };
}

export function rowToDefaultExercise(r: Row): DexieDefaultExercise {
  return {
    id:              r.id as string,
    name:            r.name as string,
    category:        r.category as string,
    type:            r.type as string,
    muscles:         r.muscles as string[],
    defaultRepRange: r.default_rep_range as [number, number] | undefined,
    restSeconds:     r.rest_seconds as number | undefined,
    isBodyweight:    r.is_bodyweight as boolean | undefined,
    isCable:         r.is_cable as boolean | undefined,
    isTimed:         r.is_timed as boolean | undefined,
    isStretch:       r.is_stretch as boolean | undefined,
    videoUrl:        r.video_url as string | undefined,
  };
}
