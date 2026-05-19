import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { exercises as staticExercises } from '@/data/exercises';
import type { Exercise } from '@/types';

export function useExercises(): Exercise[] {
  const custom = useLiveQuery(() => db.customExercises.toArray()) ?? [];
  return [...staticExercises, ...custom];
}

export async function createExercise(exercise: Exercise): Promise<void> {
  await db.customExercises.add(exercise);
}

export async function deleteCustomExercise(id: string): Promise<void> {
  await db.customExercises.delete(id);
}
