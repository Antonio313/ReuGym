import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalSession } from '@/lib/auth';

export function useLastSetData(
  exerciseId: string,
  setNumber: number,
  currentSessionId: string | null,
): { weightKg: number; reps: number } | null | undefined {
  const [data, setData] = useState<{ weightKg: number; reps: number } | null | undefined>(undefined);

  const load = useCallback(async () => {
    if (!exerciseId) return;
    const user = getLocalSession();
    if (!user) { setData(null); return; }

    let query = supabase
      .from('logged_sets')
      .select('weight_kg, reps')
      .eq('user_id', user.id)
      .eq('exercise_id', exerciseId)
      .eq('set_number', setNumber)
      .eq('is_warmup', false)
      .order('completed_at', { ascending: false })
      .limit(1);

    if (currentSessionId) {
      query = query.neq('session_id', currentSessionId);
    }

    const { data: rows } = await query;
    if (!rows || rows.length === 0) {
      setData(null);
    } else {
      setData({ weightKg: rows[0].weight_kg as number, reps: rows[0].reps as number });
    }
  }, [exerciseId, setNumber, currentSessionId]);

  useEffect(() => { void load(); }, [load]);

  return data;
}
