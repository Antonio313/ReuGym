import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { DayStretch } from '@/types';

export function useStretchLibrary(): DayStretch[] {
  return useLiveQuery(() => db.stretchLibrary.toArray(), [], []);
}

export async function saveStretchToLibrary(stretch: DayStretch): Promise<void> {
  await db.stretchLibrary.put(stretch);
}

export async function deleteStretchFromLibrary(id: string): Promise<void> {
  await db.stretchLibrary.delete(id);
}
