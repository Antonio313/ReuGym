import { supabase } from './supabase';
import { getLocalSession } from './auth';

export async function checkIsPR(
  exerciseId: string,
  weightKg: number,
  reps: number,
  currentSessionId: string,
): Promise<boolean> {
  if (weightKg === 0) return false;

  const user = getLocalSession();
  if (!user) return false;

  const { data } = await supabase
    .from('logged_sets')
    .select('weight_kg, reps')
    .eq('user_id', user.id)
    .eq('exercise_id', exerciseId)
    .eq('is_warmup', false)
    .neq('session_id', currentSessionId);

  if (!data || data.length === 0) return false;

  const maxVolume = Math.max(...data.map((s) => (s.weight_kg as number) * (s.reps as number)));
  return weightKg * reps > maxVolume;
}
