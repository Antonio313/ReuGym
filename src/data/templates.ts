import type { WorkoutTemplate } from '../types';

export const templates: WorkoutTemplate[] = [
  {
    id: 'push',
    name: 'Push Day',
    category: 'push',
    shortLabel: 'PUSH',
    exercises: [
      { exerciseId: 'barbell-bench-press',     sets: 4, repRange: [6, 8],   isSuperset: false },
      { exerciseId: 'seated-db-shoulder-press', sets: 3, repRange: [8, 10],  isSuperset: false },
      { exerciseId: 'incline-db-press',         sets: 3, repRange: [8, 10],  isSuperset: true,  supersetGroupId: 'push-A' },
      { exerciseId: 'cable-triceps-pushdown',   sets: 3, repRange: [10, 12], isSuperset: true,  supersetGroupId: 'push-A' },
      { exerciseId: 'db-lateral-raise',         sets: 3, repRange: [12, 15], isSuperset: false },
      { exerciseId: 'push-up',                  sets: 1, repRange: [10, 20], isSuperset: false },
    ],
  },
  {
    id: 'pull',
    name: 'Pull Day',
    category: 'pull',
    shortLabel: 'PULL',
    exercises: [
      { exerciseId: 'deadlift',              sets: 4, repRange: [4, 6],   isSuperset: false },
      { exerciseId: 'lat-pulldown',          sets: 3, repRange: [8, 10],  isSuperset: false },
      { exerciseId: 'bent-over-barbell-row', sets: 3, repRange: [8, 10],  isSuperset: false },
      { exerciseId: 'face-pull',             sets: 3, repRange: [12, 15], isSuperset: true,  supersetGroupId: 'pull-A' },
      { exerciseId: 'barbell-curl',          sets: 3, repRange: [8, 10],  isSuperset: true,  supersetGroupId: 'pull-A' },
      { exerciseId: 'hammer-curl',           sets: 2, repRange: [10, 12], isSuperset: false },
    ],
  },
  {
    id: 'legs',
    name: 'Leg Day',
    category: 'legs',
    shortLabel: 'LEGS',
    exercises: [
      { exerciseId: 'box-jump',               sets: 3, repRange: [3, 5],   isSuperset: false },
      { exerciseId: 'back-squat',             sets: 4, repRange: [6, 8],   isSuperset: false },
      { exerciseId: 'romanian-deadlift',      sets: 3, repRange: [6, 8],   isSuperset: false },
      { exerciseId: 'bulgarian-split-squat',  sets: 3, repRange: [8, 10],  isSuperset: false },
      { exerciseId: 'standing-calf-raise',    sets: 3, repRange: [12, 15], isSuperset: false },
      { exerciseId: 'tibialis-raise',         sets: 2, repRange: [15, 20], isSuperset: false },
      { exerciseId: 'terminal-knee-extension',sets: 2, repRange: [12, 15], isSuperset: false },
    ],
  },
  {
    id: 'core',
    name: 'Core Day',
    category: 'core',
    shortLabel: 'CORE',
    exercises: [
      { exerciseId: 'hanging-leg-raise',    sets: 3, repRange: [8, 12],  isSuperset: false },
      { exerciseId: 'cable-woodchopper',    sets: 3, repRange: [10, 12], isSuperset: false },
      { exerciseId: 'weighted-sit-up',      sets: 3, repRange: [8, 12],  isSuperset: true,  supersetGroupId: 'core-A' },
      { exerciseId: 'pallof-press',         sets: 3, repRange: [10, 12], isSuperset: true,  supersetGroupId: 'core-A' },
      { exerciseId: 'plank',                sets: 3, repRange: [1, 1],   isSuperset: false },
      { exerciseId: 'farmers-carry',        sets: 3, repRange: [3, 3],   isSuperset: false },
      { exerciseId: 'tennis-ball-wall-toss',sets: 2, repRange: [30, 30], isSuperset: false },
      { exerciseId: 'single-leg-balance',   sets: 2, repRange: [2, 2],   isSuperset: false },
    ],
  },
];

export const templateMap = new Map(templates.map((t) => [t.id, t]));
