import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { ExercisePref } from '@/types';

export function useExercisePref(exerciseId: string): ExercisePref | undefined {
  return useLiveQuery(
    () => db.exercisePrefs.get(exerciseId),
    [exerciseId],
  );
}
