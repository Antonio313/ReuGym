import { useLiveQuery } from 'dexie-react-hooks';
import { getLocalSession } from '@/lib/auth';
import { getDB } from '@/data/db';

// Shared with WorkoutActive's rest-screen preview so the two can never
// disagree about "what did I do for this exact set number last time" —
// previously WorkoutActive computed its own answer without this history
// lookup at all, so the preview could promise a stale template/pref weight
// that didn't match what SetLogger actually defaulted to once you arrived.
export async function fetchLastSetData(
  userId: string,
  exerciseId: string,
  setNumber: number,
  currentSessionId: string | null,
  side?: 'left' | 'right',
): Promise<{ weightKg: number; reps: number } | null> {
  if (!exerciseId) return null;

  const db = getDB(userId);

  const candidates = await db.sets
    .where('[userId+exerciseId]')
    .equals([userId, exerciseId])
    .filter(
      (s) =>
        s.setNumber === setNumber &&
        !s.isWarmup &&
        s.sessionId !== (currentSessionId ?? '') &&
        // Per-side exercises keep left/right history independent — a
        // right-hand PR shouldn't silently seed the left side's default.
        (side == null || s.side === side),
    )
    .toArray();

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.completedAt - a.completedAt);
  const latest = candidates[0];
  return { weightKg: latest.weightKg, reps: latest.reps };
}

export function useLastSetData(
  exerciseId: string,
  setNumber: number,
  currentSessionId: string | null,
  side?: 'left' | 'right',
): { weightKg: number; reps: number } | null | undefined {
  const user = getLocalSession();

  return useLiveQuery(async () => {
    if (!exerciseId || !user) return null;
    return fetchLastSetData(user.id, exerciseId, setNumber, currentSessionId, side);
  }, [exerciseId, setNumber, currentSessionId, user?.id, side]);
}
