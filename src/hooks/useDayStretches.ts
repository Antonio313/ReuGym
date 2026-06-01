import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { supabase } from '@/lib/supabase';
import { getLocalSession } from '@/lib/auth';
import type { DayStretch } from '@/types';

type DayStretchData = { pre: DayStretch[]; post: DayStretch[] };

function rowToDayStretch(row: Record<string, unknown>): DayStretch {
  return {
    id:               row.id as string,
    exerciseId:       row.exercise_id as string,
    sets:             (row.sets as number) ?? 1,
    repRange:         [(row.rep_range_min as number) ?? 1, (row.rep_range_max as number) ?? 1],
    startingWeightKg: (row.starting_weight_kg as number) ?? 0,
    restSeconds:      (row.rest_seconds as number) ?? 30,
    isBodyweight:     (row.is_bodyweight as boolean) ?? false,
    isTimed:          (row.is_timed as boolean) ?? false,
  };
}

export function useDayStretches(templateId: string): [DayStretchData, () => void] {
  const [data, setData] = useState<DayStretchData>({ pre: [], post: [] });

  const load = useCallback(async () => {
    if (!templateId) return;
    const user = getLocalSession();
    if (!user) return;

    const { data: rows } = await supabase
      .from('template_stretches')
      .select('*')
      .eq('user_id', user.id)
      .eq('template_id', templateId)
      .order('position');

    if (!rows) return;
    setData({
      pre:  rows.filter((r) => r.phase === 'pre').map(rowToDayStretch),
      post: rows.filter((r) => r.phase === 'post').map(rowToDayStretch),
    });
  }, [templateId]);

  useEffect(() => { void load(); }, [load]);

  return [data, load];
}

export async function saveDayStretches(
  templateId: string,
  pre: DayStretch[],
  post: DayStretch[],
): Promise<void> {
  const user = getLocalSession();
  if (!user) return;

  await supabase
    .from('template_stretches')
    .delete()
    .eq('user_id', user.id)
    .eq('template_id', templateId);

  const toInsert = [
    ...pre.map((s, i) => stretchToRow(s, user.id, templateId, 'pre', i)),
    ...post.map((s, i) => stretchToRow(s, user.id, templateId, 'post', i)),
  ];

  if (toInsert.length > 0) {
    await supabase.from('template_stretches').insert(toInsert);
  }
}

function stretchToRow(
  s: DayStretch,
  userId: string,
  templateId: string,
  phase: 'pre' | 'post',
  position: number,
) {
  return {
    id:                s.id || nanoid(),
    user_id:           userId,
    template_id:       templateId,
    exercise_id:       s.exerciseId,
    phase,
    position,
    sets:              s.sets,
    rep_range_min:     s.repRange[0],
    rep_range_max:     s.repRange[1],
    starting_weight_kg: s.startingWeightKg,
    rest_seconds:      s.restSeconds,
    is_bodyweight:     s.isBodyweight,
    is_timed:          s.isTimed,
  };
}
