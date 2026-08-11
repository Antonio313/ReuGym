import { useLiveQuery } from 'dexie-react-hooks';
import { getLocalSession } from '@/lib/auth';
import { getDB } from '@/data/db';
import { enqueueSync, syncNow } from '@/lib/sync';
import type { Exercise, ExerciseCategory, ExerciseType, MuscleGroup } from '@/types';

export function dexieToExercise(row: {
  id: string; name: string; category: string; type: string; muscles: string[];
  defaultRepRange?: [number, number]; startingWeightKg?: number; restSeconds?: number;
  isBodyweight?: boolean; isCable?: boolean; isTimed?: boolean; isStretch?: boolean;
  videoUrl?: string; notes?: string;
}): Exercise {
  return {
    id:               row.id,
    name:             row.name,
    category:         row.category as ExerciseCategory,
    type:             row.type as ExerciseType,
    muscles:          row.muscles as MuscleGroup[],
    defaultRepRange:  row.defaultRepRange,
    startingWeightKg: row.startingWeightKg,
    restSeconds:      row.restSeconds,
    isBodyweight:     row.isBodyweight,
    isCable:          row.isCable,
    isTimed:          row.isTimed,
    isStretch:        row.isStretch,
    videoUrl:         row.videoUrl,
    notes:            row.notes,
  };
}

function exerciseToSnakeRow(exercise: Exercise, userId: string) {
  return {
    id:                 exercise.id,
    user_id:            userId,
    name:               exercise.name,
    category:           exercise.category,
    type:               exercise.type,
    muscles:            exercise.muscles,
    default_rep_range:  exercise.defaultRepRange ?? null,
    starting_weight_kg: exercise.startingWeightKg ?? 0,
    rest_seconds:       exercise.restSeconds ?? 60,
    is_bodyweight:      exercise.isBodyweight ?? false,
    is_cable:           exercise.isCable ?? false,
    is_timed:           exercise.isTimed ?? false,
    is_stretch:         exercise.isStretch ?? false,
    video_url:          exercise.videoUrl ?? null,
    notes:              exercise.notes ?? null,
  };
}

export function useExercises(): Exercise[] {
  const user = getLocalSession();

  const defaults = useLiveQuery(async () => {
    if (!user) return [];
    const db = getDB(user.id);
    const rows = await db.defaultExercises.filter((r) => !r.isStretch).toArray();
    return rows.map(dexieToExercise);
  }, [user?.id]) ?? [];

  const custom = useLiveQuery(async () => {
    if (!user) return [];
    const db = getDB(user.id);
    const rows = await db.customExercises
      .where('userId').equals(user.id)
      .filter((r) => !r.isStretch)
      .toArray();
    return rows.map(dexieToExercise);
  }, [user?.id]) ?? [];

  const overriddenIds = new Set(custom.map((e) => e.id));
  return [...defaults.filter((s) => !overriddenIds.has(s.id)), ...custom];
}

export function useStretches(): Exercise[] {
  const user = getLocalSession();

  const defaults = useLiveQuery(async () => {
    if (!user) return [];
    const db = getDB(user.id);
    const rows = await db.defaultExercises.filter((r) => !!r.isStretch).toArray();
    return rows.map(dexieToExercise);
  }, [user?.id]) ?? [];

  const custom = useLiveQuery(async () => {
    if (!user) return [];
    const db = getDB(user.id);
    const rows = await db.customExercises
      .where('userId').equals(user.id)
      .filter((r) => !!r.isStretch)
      .toArray();
    return rows.map(dexieToExercise);
  }, [user?.id]) ?? [];

  const overriddenIds = new Set(custom.map((s) => s.id));
  return [...defaults.filter((s) => !overriddenIds.has(s.id)), ...custom];
}

export async function createExercise(exercise: Exercise): Promise<void> {
  const user = getLocalSession();
  if (!user) return;

  const db = getDB(user.id);
  await db.customExercises.put({
    id:               exercise.id,
    userId:           user.id,
    name:             exercise.name,
    category:         exercise.category,
    type:             exercise.type,
    muscles:          exercise.muscles,
    defaultRepRange:  exercise.defaultRepRange,
    startingWeightKg: exercise.startingWeightKg,
    restSeconds:      exercise.restSeconds,
    isBodyweight:     exercise.isBodyweight,
    isCable:          exercise.isCable,
    isTimed:          exercise.isTimed,
    isStretch:        exercise.isStretch,
    videoUrl:         exercise.videoUrl,
    notes:            exercise.notes,
  });

  await enqueueSync(user.id, 'custom_exercises', 'upsert', exerciseToSnakeRow(exercise, user.id));
  // Confirm it actually reached Supabase before the save flow reports done —
  // these edits happen outside a workout session, sometimes right before
  // closing the app, so there's no later opportunity (rest timer, next set)
  // for a background push to catch up.
  await syncNow(user.id);
}

export async function updateExercise(exercise: Exercise): Promise<void> {
  // Same as create — both are upserts
  return createExercise(exercise);
}

export async function deleteCustomExercise(id: string): Promise<void> {
  const user = getLocalSession();
  if (!user) return;

  const db = getDB(user.id);
  await db.customExercises.delete(id);
  await enqueueSync(user.id, 'custom_exercises', 'delete', { id });
  await syncNow(user.id);
}

// True iff `id` exists in the shared default library, regardless of whether
// the current user has also forked it into their own custom_exercises — same
// semantics as the old static-array check it replaces (see CreateExercise's
// "Built-in exercise — edits create a custom override" messaging).
export function useIsDefaultExercise(id: string | undefined): boolean {
  const user = getLocalSession();

  return useLiveQuery(async () => {
    if (!user || !id) return false;
    const db = getDB(user.id);
    const row = await db.defaultExercises.get(id);
    return !!row;
  }, [user?.id, id]) ?? false;
}
