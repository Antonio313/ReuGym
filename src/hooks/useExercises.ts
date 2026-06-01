import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalSession } from '@/lib/auth';
import { exercises as staticExercises } from '@/data/exercises';
import { stretches as staticStretches } from '@/data/stretches';
import type { Exercise, ExerciseCategory, ExerciseType, MuscleGroup } from '@/types';

function rowToExercise(row: Record<string, unknown>): Exercise {
  return {
    id:               row.id as string,
    name:             row.name as string,
    category:         row.category as ExerciseCategory,
    type:             row.type as ExerciseType,
    muscles:          row.muscles as MuscleGroup[],
    defaultRepRange:  row.default_rep_range as [number, number],
    startingWeightKg: row.starting_weight_kg as number,
    restSeconds:      row.rest_seconds as number,
    isBodyweight:     row.is_bodyweight as boolean,
    isCable:          row.is_cable as boolean || undefined,
    isTimed:          row.is_timed as boolean || undefined,
    isStretch:        row.is_stretch as boolean || undefined,
    videoUrl:         row.video_url as string | undefined,
    notes:            row.notes as string | undefined,
  };
}

function exerciseToRow(exercise: Exercise, userId: string) {
  return {
    id:                 exercise.id,
    user_id:            userId,
    name:               exercise.name,
    category:           exercise.category,
    type:               exercise.type,
    muscles:            exercise.muscles,
    default_rep_range:  exercise.defaultRepRange ?? null,
    starting_weight_kg: exercise.startingWeightKg ?? 0,
    rest_seconds:       exercise.restSeconds ?? 60,
    is_bodyweight:      exercise.isBodyweight ?? false,
    is_cable:           exercise.isCable ?? false,
    is_timed:           exercise.isTimed ?? false,
    is_stretch:         exercise.isStretch ?? false,
    video_url:          exercise.videoUrl ?? null,
    notes:              exercise.notes ?? null,
  };
}

// Module-level caches survive component unmount/remount, eliminating
// the flash where the list briefly reverts to static-only on navigation.
let _exercisesCache: Exercise[] | null = null;
let _stretchesCache: Exercise[] | null = null;

export function useExercises(): Exercise[] {
  const [custom, setCustom] = useState<Exercise[]>(_exercisesCache ?? []);

  const load = useCallback(async () => {
    const user = getLocalSession();
    if (!user) return;
    const { data } = await supabase
      .from('custom_exercises')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_stretch', false)
      .order('name', { ascending: true });
    if (data) {
      const mapped = data.map(rowToExercise);
      _exercisesCache = mapped;
      setCustom(mapped);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const overriddenIds = new Set(custom.map((e) => e.id));
  return [...staticExercises.filter((s) => !overriddenIds.has(s.id)), ...custom];
}

export function useStretches(): Exercise[] {
  const [custom, setCustom] = useState<Exercise[]>(_stretchesCache ?? []);

  const load = useCallback(async () => {
    const user = getLocalSession();
    if (!user) return;
    const { data } = await supabase
      .from('custom_exercises')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_stretch', true)
      .order('name', { ascending: true });
    if (data) {
      const mapped = data.map(rowToExercise);
      _stretchesCache = mapped;
      setCustom(mapped);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const overriddenIds = new Set(custom.map((s) => s.id));
  return [...staticStretches.filter((s) => !overriddenIds.has(s.id)), ...custom];
}

export async function createExercise(exercise: Exercise): Promise<void> {
  const user = getLocalSession();
  if (!user) return;
  await supabase.from('custom_exercises').insert(exerciseToRow(exercise, user.id));
}

export async function updateExercise(exercise: Exercise): Promise<void> {
  const user = getLocalSession();
  if (!user) return;
  await supabase
    .from('custom_exercises')
    .upsert(exerciseToRow(exercise, user.id));
}

export async function deleteCustomExercise(id: string): Promise<void> {
  const user = getLocalSession();
  if (!user) return;
  await supabase
    .from('custom_exercises')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
}

export function isStaticExercise(id: string): boolean {
  return staticExercises.some((e) => e.id === id);
}
