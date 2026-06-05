import { getLocalSession } from './auth';
import { getDB } from '@/data/db';

export async function checkIsPR(
  exerciseId: string,
  weightKg: number,
  reps: number,
  currentSessionId: string,
): Promise<boolean> {
  if (weightKg === 0) return false;

  const user = getLocalSession();
  if (!user) return false;

  const db = getDB(user.id);

  const previousSets = await db.sets
    .where('[userId+exerciseId]')
    .equals([user.id, exerciseId])
    .filter((s) => !s.isWarmup && s.sessionId !== currentSessionId)
    .toArray();

  if (previousSets.length === 0) return false;

  const maxVolume = Math.max(...previousSets.map((s) => s.weightKg * s.reps));
  return weightKg * reps > maxVolume;
}
