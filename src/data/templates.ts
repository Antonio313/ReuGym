import type { ExerciseCategory, WorkoutTemplate } from '../types';

const DAYS: { category: ExerciseCategory; name: string; shortLabel: string }[] = [
  { category: 'push',   name: 'Push Day',  shortLabel: 'PUSH'  },
  { category: 'pull',   name: 'Pull Day',  shortLabel: 'PULL'  },
  { category: 'legs',   name: 'Leg Day',   shortLabel: 'LEGS'  },
  { category: 'core',   name: 'Core Day',  shortLabel: 'CORE'  },
  { category: 'glutes', name: 'Glute Day', shortLabel: 'GLUTE' },
  { category: 'back',   name: 'Back Day',  shortLabel: 'BACK'  },
];

// Each day has 3 loadouts — independent exercise/stretch lists (e.g. a normal
// gym version vs a no-equipment home version). Loadout 1's id is the bare
// category string (unchanged from before loadouts existed, so existing user
// data keeps working with zero migration); loadouts 2/3 are new ids that
// start empty for the user to fill in themselves.
export const templates: WorkoutTemplate[] = DAYS.flatMap((d) => [
  { id: d.category,         name: d.name,      category: d.category, shortLabel: d.shortLabel, loadoutSlot: 1 as const, exercises: [] },
  { id: `${d.category}-l2`, name: 'Loadout 2', category: d.category, shortLabel: d.shortLabel, loadoutSlot: 2 as const, exercises: [] },
  { id: `${d.category}-l3`, name: 'Loadout 3', category: d.category, shortLabel: d.shortLabel, loadoutSlot: 3 as const, exercises: [] },
]);

export const templateMap = new Map(templates.map((t) => [t.id, t]));

export const DAY_CATEGORIES = DAYS.map((d) => d.category);

// Loadout 1's id is always just the category string, by construction above.
export function defaultLoadoutId(category: string): string {
  return category;
}

export function loadoutsForCategory(category: string): WorkoutTemplate[] {
  return templates
    .filter((t) => t.category === category)
    .sort((a, b) => a.loadoutSlot - b.loadoutSlot);
}
