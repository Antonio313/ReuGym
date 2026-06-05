import { useLiveQuery } from 'dexie-react-hooks';
import { getLocalSession } from '@/lib/auth';
import { getDB } from '@/data/db';
import { enqueueSync } from '@/lib/sync';
import type { ExercisePref } from '@/types';

export function useExercisePref(exerciseId: string): ExercisePref | undefined {
  const user = getLocalSession();

  return useLiveQuery(async () => {
    if (!exerciseId || !user) return undefined;

    const db = getDB(user.id);
    const row = await db.exercisePrefs.get([user.id, exerciseId]);
    if (!row) return undefined;

    return {
      exerciseId:       row.exerciseId,
      startingWeightKg: row.startingWeightKg,
      startingReps:     row.startingReps,
    };
  }, [exerciseId, user?.id]);
}

export async function saveExercisePref(pref: ExercisePref): Promise<void> {
  const user = getLocalSession();
  if (!user) return;

  const db = getDB(user.id);
  await db.exercisePrefs.put({
    userId:           user.id,
    exerciseId:       pref.exerciseId,
    startingWeightKg: pref.startingWeightKg,
    startingReps:     pref.startingReps,
  });

  await enqueueSync(user.id, 'exercise_prefs', 'upsert', {
    user_id:            user.id,
    exercise_id:        pref.exerciseId,
    starting_weight_kg: pref.startingWeightKg,
    starting_reps:      pref.startingReps ?? null,
  });
}

export async function loadAllPrefs(): Promise<Map<string, ExercisePref>> {
  const user = getLocalSession();
  if (!user) return new Map();

  const db = getDB(user.id);
  const rows = await db.exercisePrefs
    .where('[userId+exerciseId]')
    .between([user.id, ''], [user.id, '￿'])
    .toArray();

  return new Map(
    rows.map((r) => [
      r.exerciseId,
      {
        exerciseId:       r.exerciseId,
        startingWeightKg: r.startingWeightKg,
        startingReps:     r.startingReps,
      },
    ]),
  );
}
