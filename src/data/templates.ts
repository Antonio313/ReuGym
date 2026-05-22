import type { WorkoutTemplate } from '../types';

export const templates: WorkoutTemplate[] = [
  { id: 'push',   name: 'Push Day',   category: 'push',   shortLabel: 'PUSH',  exercises: [] },
  { id: 'pull',   name: 'Pull Day',   category: 'pull',   shortLabel: 'PULL',  exercises: [] },
  { id: 'legs',   name: 'Leg Day',    category: 'legs',   shortLabel: 'LEGS',  exercises: [] },
  { id: 'core',   name: 'Core Day',   category: 'core',   shortLabel: 'CORE',  exercises: [] },
  { id: 'glutes', name: 'Glute Day',  category: 'glutes', shortLabel: 'GLUTE', exercises: [] },
  { id: 'back',   name: 'Back Day',   category: 'back',   shortLabel: 'BACK',  exercises: [] },
];

export const templateMap = new Map(templates.map((t) => [t.id, t]));
