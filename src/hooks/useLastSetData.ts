import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';

export function useLastSetData(
  exerciseId: string,
  setNumber: number,
  currentSessionId: string | null,
): { weightKg: number; reps: number } | null | undefined {
  return useLiveQuery(async () => {
    const sets = await db.sets
      .where('exerciseId')
      .equals(exerciseId)
      .filter(
        (s) =>
          s.setNumber === setNumber &&
          !s.isWarmup &&
          s.sessionId !== currentSessionId,
      )
      .sortBy('completedAt');

    const last = sets[sets.length - 1];
    if (!last) return null;
    return { weightKg: last.weightKg, reps: last.reps };
  }, [exerciseId, setNumber, currentSessionId]);
}
