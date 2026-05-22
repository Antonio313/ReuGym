import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalSession } from '@/lib/auth';
import type { ExercisePref } from '@/types';

export function useExercisePref(exerciseId: string): ExercisePref | undefined {
  const [pref, setPref] = useState<ExercisePref | undefined>(undefined);

  const load = useCallback(async () => {
    if (!exerciseId) return;
    const user = getLocalSession();
    if (!user) return;
    const { data } = await supabase
      .from('exercise_prefs')
      .select('*')
      .eq('user_id', user.id)
      .eq('exercise_id', exerciseId)
      .maybeSingle();
    if (data) {
      setPref({
        exerciseId:       data.exercise_id as string,
        startingWeightKg: data.starting_weight_kg as number,
        startingReps:     data.starting_reps as number | undefined,
      });
    }
  }, [exerciseId]);

  useEffect(() => { void load(); }, [load]);

  return pref;
}

export async function saveExercisePref(pref: ExercisePref): Promise<void> {
  const user = getLocalSession();
  if (!user) return;
  await supabase.from('exercise_prefs').upsert({
    user_id:           user.id,
    exercise_id:       pref.exerciseId,
    starting_weight_kg: pref.startingWeightKg,
    starting_reps:     pref.startingReps ?? null,
  });
}

export async function loadAllPrefs(): Promise<Map<string, ExercisePref>> {
  const user = getLocalSession();
  if (!user) return new Map();
  const { data } = await supabase
    .from('exercise_prefs')
    .select('*')
    .eq('user_id', user.id);
  if (!data) return new Map();
  return new Map(
    data.map((r) => [
      r.exercise_id as string,
      {
        exerciseId:       r.exercise_id as string,
        startingWeightKg: r.starting_weight_kg as number,
        startingReps:     r.starting_reps as number | undefined,
      },
    ]),
  );
}
