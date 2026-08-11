import { supabase } from './supabase';
import type { Exercise } from '@/types';

// Upserts the admin's current effective exercise/stretch list (defaults +
// their own custom overrides/additions) into the shared default_exercises
// table, keyed by id. Every other user picks it up on their next sync —
// see migration 011_default_exercises.sql for why this table has no
// user_id, and useExercises.ts for how per-user overrides keep winning.
function toDefaultRow(exercise: Exercise) {
  return {
    id:                 exercise.id,
    name:               exercise.name,
    category:           exercise.category,
    type:               exercise.type,
    muscles:            exercise.muscles,
    default_rep_range:  exercise.defaultRepRange ?? null,
    rest_seconds:       exercise.restSeconds ?? null,
    is_bodyweight:      exercise.isBodyweight ?? false,
    is_cable:           exercise.isCable ?? false,
    is_timed:           exercise.isTimed ?? false,
    is_stretch:         exercise.isStretch ?? false,
    video_url:          exercise.videoUrl ?? null,
  };
}

export async function syncLibraryToDefaults(exercises: Exercise[], stretches: Exercise[]): Promise<number> {
  const rows = [...exercises, ...stretches].map(toDefaultRow);
  const { error } = await supabase.from('default_exercises').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  return rows.length;
}
