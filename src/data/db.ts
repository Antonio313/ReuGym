import Dexie, { type Table } from 'dexie';
import type { WorkoutSession, LoggedSet, BodyStat } from '../types';

class WorkoutDB extends Dexie {
  sessions!: Table<WorkoutSession, string>;
  sets!:     Table<LoggedSet, string>;
  bodyStats!:Table<BodyStat, string>;

  constructor() {
    super('ReuGymDB');

    this.version(1).stores({
      sessions:  'id, templateId, startedAt, completedAt',
      sets:      'id, sessionId, exerciseId, completedAt, isPR, [exerciseId+completedAt]',
      bodyStats: 'id, date',
    });
  }
}

export const db = new WorkoutDB();

export async function requestPersistentStorage(): Promise<void> {
  if (navigator.storage?.persist) {
    const granted = await navigator.storage.persist();
    if (!granted) {
      console.warn('ReuGym: Persistent storage not granted. Data may be evicted by browser.');
    }
  }
}
