import { useLiveQuery } from 'dexie-react-hooks';
import { getLocalSession } from '@/lib/auth';
import { getDB } from '@/data/db';

export function useLastSetData(
  exerciseId: string,
  setNumber: number,
  currentSessionId: string | null,
): { weightKg: number; reps: number } | null | undefined {
  const user = getLocalSession();

  return useLiveQuery(async () => {
    if (!exerciseId || !user) return null;

    const db = getDB(user.id);

    const candidates = await db.sets
      .where('[userId+exerciseId]')
      .equals([user.id, exerciseId])
      .filter(
        (s) =>
          s.setNumber === setNumber &&
          !s.isWarmup &&
          s.sessionId !== (currentSessionId ?? ''),
      )
      .toArray();

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.completedAt - a.completedAt);
    const latest = candidates[0];
    return { weightKg: latest.weightKg, reps: latest.reps };
  }, [exerciseId, setNumber, currentSessionId, user?.id]);
}
