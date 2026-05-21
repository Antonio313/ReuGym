import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { dayStretches as staticDayStretches } from '@/data/stretches';
import type { ExerciseCategory, DayStretch } from '@/types';

type DayStretchData = { pre: DayStretch[]; post: DayStretch[] };

export function useDayStretches(category: ExerciseCategory): DayStretchData {
  const custom = useLiveQuery(
    () => db.dayStretches.get(category),
    [category],
  );
  return custom ?? staticDayStretches[category];
}

export async function saveDayStretches(
  category: ExerciseCategory,
  pre: DayStretch[],
  post: DayStretch[],
): Promise<void> {
  await db.dayStretches.put({ category, pre, post });
}
