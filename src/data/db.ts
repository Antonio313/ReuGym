import Dexie, { type Table } from 'dexie';
import type { WorkoutSession, LoggedSet, BodyStat, WorkoutTemplate, Exercise, ExercisePref, ExerciseCategory, DayStretch } from '../types';
import { templates as defaultTemplates, glutesTemplate, backTemplate } from './templates';
import { dayStretches as staticDayStretches } from './stretches';

type DayStretchRecord = { category: ExerciseCategory; pre: DayStretch[]; post: DayStretch[] };

function getAllLibraryStretches(): DayStretch[] {
  const all: DayStretch[] = [];
  for (const data of Object.values(staticDayStretches)) {
    all.push(...data.pre, ...data.post);
  }
  return all;
}

class WorkoutDB extends Dexie {
  sessions!:        Table<WorkoutSession, string>;
  sets!:            Table<LoggedSet, string>;
  bodyStats!:       Table<BodyStat, string>;
  customTemplates!: Table<WorkoutTemplate, string>;
  customExercises!: Table<Exercise, string>;
  exercisePrefs!:   Table<ExercisePref, string>;
  dayStretches!:    Table<DayStretchRecord, string>;
  stretchLibrary!:  Table<DayStretch, string>;

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

    this.version(5).stores({
      sessions:        'id, templateId, startedAt, completedAt',
      sets:            'id, sessionId, exerciseId, completedAt, isPR, [exerciseId+completedAt]',
      bodyStats:       'id, date',
      customTemplates: 'id, category',
      customExercises: 'id, category',
      exercisePrefs:   'exerciseId',
    }).upgrade(async (tx) => {
      const existing = await tx.table('customTemplates').bulkGet(['glutes', 'back']);
      const toAdd = [];
      if (!existing[0]) toAdd.push(glutesTemplate);
      if (!existing[1]) toAdd.push(backTemplate);
      if (toAdd.length) await tx.table('customTemplates').bulkAdd(toAdd);
    });

    this.version(6).stores({
      sessions:        'id, templateId, startedAt, completedAt',
      sets:            'id, sessionId, exerciseId, completedAt, isPR, [exerciseId+completedAt]',
      bodyStats:       'id, date',
      customTemplates: 'id, category',
      customExercises: 'id, category',
      exercisePrefs:   'exerciseId',
      dayStretches:    'category',
    }).upgrade(async (tx) => {
      const categories = Object.keys(staticDayStretches) as Array<keyof typeof staticDayStretches>;
      const existing = await tx.table('dayStretches').bulkGet(categories);
      const toAdd: DayStretchRecord[] = [];
      categories.forEach((cat, i) => {
        if (!existing[i]) toAdd.push({ category: cat, ...staticDayStretches[cat] });
      });
      if (toAdd.length) await tx.table('dayStretches').bulkAdd(toAdd);
    });

    this.version(7).stores({
      sessions:        'id, templateId, startedAt, completedAt',
      sets:            'id, sessionId, exerciseId, completedAt, isPR, [exerciseId+completedAt]',
      bodyStats:       'id, date',
      customTemplates: 'id, category',
      customExercises: 'id, category',
      exercisePrefs:   'exerciseId',
      dayStretches:    'category',
      stretchLibrary:  'id, name',
    }).upgrade(async (tx) => {
      const all = getAllLibraryStretches();
      const existing = await tx.table('stretchLibrary').bulkGet(all.map(s => s.id));
      const toAdd = all.filter((_, i) => !existing[i]);
      if (toAdd.length) await tx.table('stretchLibrary').bulkAdd(toAdd);
    });

    // Seed all data for fresh installs (DB created directly at v7)
    this.on('populate', () => {
      this.customTemplates.bulkAdd(defaultTemplates);
      const stretchRecords = (Object.keys(staticDayStretches) as Array<keyof typeof staticDayStretches>)
        .map(cat => ({ category: cat, ...staticDayStretches[cat] }));
      this.dayStretches.bulkAdd(stretchRecords);
      this.stretchLibrary.bulkAdd(getAllLibraryStretches());
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
