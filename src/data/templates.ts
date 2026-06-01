import type { WorkoutTemplate } from '../types';

const PUSH_SS_A = 'push-a';
const PULL_SS_A = 'pull-a';
const CORE_SS_A = 'core-a';

export const templates: WorkoutTemplate[] = [
  {
    id: 'push', name: 'Push Day', category: 'push', shortLabel: 'PUSH',
    exercises: [
      { exerciseId: 'barbell-bench-press',      sets: 4, repRange: [6, 8],   startingWeightKg: 40,   restSeconds: 120, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'seated-db-shoulder-press', sets: 3, repRange: [8, 10],  startingWeightKg: 15,   restSeconds: 90,  isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'incline-db-press',         sets: 3, repRange: [8, 10],  startingWeightKg: 12.5, restSeconds: 60,  isBodyweight: false, isTimed: false, isSuperset: true, supersetGroupId: PUSH_SS_A },
      { exerciseId: 'cable-triceps-pushdown',   sets: 3, repRange: [10, 12], startingWeightKg: 8,    restSeconds: 60,  isBodyweight: false, isTimed: false, isSuperset: true, supersetGroupId: PUSH_SS_A },
      { exerciseId: 'db-lateral-raise',         sets: 3, repRange: [12, 15], startingWeightKg: 5,    restSeconds: 60,  isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'push-up',                  sets: 1, repRange: [10, 20], startingWeightKg: 0,    restSeconds: 60,  isBodyweight: true,  isTimed: false, isSuperset: false },
    ],
  },
  {
    id: 'pull', name: 'Pull Day', category: 'pull', shortLabel: 'PULL',
    exercises: [
      { exerciseId: 'deadlift',              sets: 4, repRange: [4, 6],   startingWeightKg: 70, restSeconds: 120, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'lat-pulldown',          sets: 3, repRange: [8, 10],  startingWeightKg: 50, restSeconds: 90,  isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'bent-over-barbell-row', sets: 3, repRange: [8, 10],  startingWeightKg: 35, restSeconds: 90,  isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'face-pull',             sets: 3, repRange: [12, 15], startingWeightKg: 5,  restSeconds: 60,  isBodyweight: false, isTimed: false, isSuperset: true, supersetGroupId: PULL_SS_A },
      { exerciseId: 'barbell-curl',          sets: 3, repRange: [8, 10],  startingWeightKg: 15, restSeconds: 60,  isBodyweight: false, isTimed: false, isSuperset: true, supersetGroupId: PULL_SS_A },
      { exerciseId: 'hammer-curl',           sets: 2, repRange: [10, 12], startingWeightKg: 10, restSeconds: 60,  isBodyweight: false, isTimed: false, isSuperset: false },
    ],
  },
  {
    id: 'legs', name: 'Leg Day', category: 'legs', shortLabel: 'LEGS',
    exercises: [
      { exerciseId: 'box-jump',               sets: 3, repRange: [3, 5],   startingWeightKg: 0,  restSeconds: 120, isBodyweight: true,  isTimed: false, isSuperset: false },
      { exerciseId: 'back-squat',             sets: 4, repRange: [6, 8],   startingWeightKg: 45, restSeconds: 120, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'romanian-deadlift',      sets: 3, repRange: [6, 8],   startingWeightKg: 60, restSeconds: 120, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'bulgarian-split-squat',  sets: 3, repRange: [8, 10],  startingWeightKg: 15, restSeconds: 90,  isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'standing-calf-raise',    sets: 3, repRange: [12, 15], startingWeightKg: 50, restSeconds: 60,  isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'tibialis-raise',         sets: 2, repRange: [15, 20], startingWeightKg: 0,  restSeconds: 45,  isBodyweight: true,  isTimed: false, isSuperset: false },
      { exerciseId: 'terminal-knee-extension',sets: 2, repRange: [12, 15], startingWeightKg: 0,  restSeconds: 45,  isBodyweight: true,  isTimed: false, isSuperset: false },
    ],
  },
  {
    id: 'core', name: 'Core Day', category: 'core', shortLabel: 'CORE',
    exercises: [
      { exerciseId: 'hanging-leg-raise',    sets: 3, repRange: [8, 12],  startingWeightKg: 0, restSeconds: 60, isBodyweight: true,  isTimed: false, isSuperset: false },
      { exerciseId: 'cable-woodchopper',    sets: 3, repRange: [10, 12], startingWeightKg: 6, restSeconds: 60, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'weighted-sit-up',      sets: 3, repRange: [8, 12],  startingWeightKg: 8, restSeconds: 60, isBodyweight: false, isTimed: false, isSuperset: true, supersetGroupId: CORE_SS_A },
      { exerciseId: 'pallof-press',         sets: 3, repRange: [10, 12], startingWeightKg: 5, restSeconds: 60, isBodyweight: false, isTimed: false, isSuperset: true, supersetGroupId: CORE_SS_A },
      { exerciseId: 'plank',                sets: 3, repRange: [30, 60], startingWeightKg: 0, restSeconds: 60, isBodyweight: true,  isTimed: true,  isSuperset: false },
      { exerciseId: 'farmers-carry',        sets: 3, repRange: [3, 3],   startingWeightKg: 25, restSeconds: 90, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'tennis-ball-wall-toss',sets: 2, repRange: [30, 30], startingWeightKg: 0, restSeconds: 45, isBodyweight: true,  isTimed: false, isSuperset: false },
      { exerciseId: 'single-leg-balance',   sets: 2, repRange: [30, 30], startingWeightKg: 0, restSeconds: 45, isBodyweight: true,  isTimed: true,  isSuperset: false },
    ],
  },
  {
    id: 'glutes', name: 'Glute Day', category: 'glutes', shortLabel: 'GLUTE',
    exercises: [
      { exerciseId: 'barbell-hip-thrust', sets: 4, repRange: [8, 10],  startingWeightKg: 60, restSeconds: 90, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'sumo-deadlift',      sets: 3, repRange: [5, 7],   startingWeightKg: 60, restSeconds: 120, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'step-up',            sets: 3, repRange: [10, 12], startingWeightKg: 20, restSeconds: 60, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'cable-kickback',     sets: 3, repRange: [12, 15], startingWeightKg: 6,  restSeconds: 60, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'good-morning',       sets: 3, repRange: [10, 12], startingWeightKg: 30, restSeconds: 60, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'glute-bridge',       sets: 2, repRange: [12, 15], startingWeightKg: 0,  restSeconds: 45, isBodyweight: true,  isTimed: false, isSuperset: false },
    ],
  },
  {
    id: 'back', name: 'Back Day', category: 'back', shortLabel: 'BACK',
    exercises: [
      { exerciseId: 'pull-up',               sets: 4, repRange: [6, 10],  startingWeightKg: 0,  restSeconds: 90, isBodyweight: true,  isTimed: false, isSuperset: false },
      { exerciseId: 't-bar-row',             sets: 3, repRange: [8, 10],  startingWeightKg: 40, restSeconds: 90, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'seated-cable-row',      sets: 3, repRange: [8, 10],  startingWeightKg: 10, restSeconds: 90, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'single-arm-db-row',     sets: 3, repRange: [8, 10],  startingWeightKg: 25, restSeconds: 90, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'straight-arm-pulldown', sets: 3, repRange: [12, 15], startingWeightKg: 8,  restSeconds: 60, isBodyweight: false, isTimed: false, isSuperset: false },
      { exerciseId: 'barbell-shrug',         sets: 3, repRange: [12, 15], startingWeightKg: 60, restSeconds: 60, isBodyweight: false, isTimed: false, isSuperset: false },
    ],
  },
];

export const templateMap = new Map(templates.map((t) => [t.id, t]));
