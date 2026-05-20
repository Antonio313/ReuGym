import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { exercises as staticExercises } from '@/data/exercises';
import type { Exercise } from '@/types';

export function useExercises(): Exercise[] {
  const custom = useLiveQuery(() => db.customExercises.toArray()) ?? [];
  // Custom entries with the same ID as a static exercise act as overrides
  const overriddenIds = new Set(custom.map((e) => e.id));
  return [...staticExercises.filter((s) => !overriddenIds.has(s.id)), ...custom];
}

export async function createExercise(exercise: Exercise): Promise<void> {
  await db.customExercises.add(exercise);
}

// Works for both custom exercises and static-exercise overrides (same ID)
export async function updateExercise(exercise: Exercise): Promise<void> {
  await db.customExercises.put(exercise);
}

// Deletes a custom exercise OR removes a static-exercise override (restoring defaults)
export async function deleteCustomExercise(id: string): Promise<void> {
  await db.customExercises.delete(id);
}

export function isStaticExercise(id: string): boolean {
  return staticExercises.some((e) => e.id === id);
}
