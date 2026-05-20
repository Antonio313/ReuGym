import { db } from '@/data/db';

export async function checkIsPR(
  exerciseId: string,
  weightKg: number,
  reps: number,
  currentSessionId: string,
): Promise<boolean> {
  if (weightKg === 0) return false;

  const prevSets = await db.sets
    .where('exerciseId')
    .equals(exerciseId)
    .filter((s) => s.sessionId !== currentSessionId && !s.isWarmup)
    .toArray();

  if (prevSets.length === 0) return false;

  const maxVolume = Math.max(...prevSets.map((s) => s.weightKg * s.reps));
  return weightKg * reps > maxVolume;
}
