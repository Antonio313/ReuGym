import Dexie, { type Table } from 'dexie';
import type { WorkoutSession, LoggedSet, BodyStat, WorkoutTemplate, Exercise, ExercisePref } from '../types';
import { templates as defaultTemplates } from './templates';

class WorkoutDB extends Dexie {
  sessions!:        Table<WorkoutSession, string>;
  sets!:            Table<LoggedSet, string>;
  bodyStats!:       Table<BodyStat, string>;
  customTemplates!: Table<WorkoutTemplate, string>;
  customExercises!: Table<Exercise, string>;
  exercisePrefs!:   Table<ExercisePref, string>;

  constructor() {
    super('ReuGymDB');

    this.version(1).stores({
      sessions:  'id, templateId, startedAt, completedAt',
      sets:      'id, sessionId, exerciseId, completedAt, isPR, [exerciseId+completedAt]',
      bodyStats: 'id, date',
    });

    this.version(2).stores({
      sessions:        'id, templateId, startedAt, completedAt',
      sets:            'id, sessionId, exerciseId, completedAt, isPR, [exerciseId+completedAt]',
      bodyStats:       'id, date',
      customTemplates: 'id, category',
    }).upgrade(async (tx) => {
      await tx.table('customTemplates').bulkAdd(defaultTemplates);
    });

    this.version(3).stores({
      sessions:        'id, templateId, startedAt, completedAt',
      sets:            'id, sessionId, exerciseId, completedAt, isPR, [exerciseId+completedAt]',
      bodyStats:       'id, date',
      customTemplates: 'id, category',
      customExercises: 'id, category',
    });

    this.version(4).stores({
      sessions:        'id, templateId, startedAt, completedAt',
      sets:            'id, sessionId, exerciseId, completedAt, isPR, [exerciseId+completedAt]',
      bodyStats:       'id, date',
      customTemplates: 'id, category',
      customExercises: 'id, category',
      exercisePrefs:   'exerciseId',
    });

    // Seed templates for fresh installs (DB created directly at v4)
    this.on('populate', () => {
      this.customTemplates.bulkAdd(defaultTemplates);
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
