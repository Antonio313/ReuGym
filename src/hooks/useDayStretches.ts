import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { supabase } from '@/lib/supabase';
import { getLocalSession } from '@/lib/auth';
import type { DayStretch } from '@/types';

type DayStretchData = { pre: DayStretch[]; post: DayStretch[] };

function rowToDayStretch(row: Record<string, unknown>): DayStretch {
  return {
    id:          row.id as string,
    exerciseId:  row.exercise_id as string,
    restSeconds: row.rest_seconds as number,
  };
}

export function useDayStretches(templateId: string): DayStretchData {
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

  return data;
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
    ...pre.map((s, i) => ({
      id:          s.id || nanoid(),
      user_id:     user.id,
      template_id: templateId,
      exercise_id: s.exerciseId,
      phase:       'pre',
      position:    i,
      rest_seconds: s.restSeconds,
    })),
    ...post.map((s, i) => ({
      id:          s.id || nanoid(),
      user_id:     user.id,
      template_id: templateId,
      exercise_id: s.exerciseId,
      phase:       'post',
      position:    i,
      rest_seconds: s.restSeconds,
    })),
  ];

  if (toInsert.length > 0) {
    await supabase.from('template_stretches').insert(toInsert);
  }
}
