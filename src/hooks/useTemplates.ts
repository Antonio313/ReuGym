import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { supabase } from '@/lib/supabase';
import { getLocalSession } from '@/lib/auth';
import { templates as staticTemplates, templateMap as defaultTemplateMap } from '@/data/templates';
import type { WorkoutTemplate, TemplateExercise } from '@/types';

export { staticTemplates as defaultTemplates };

function rowToTemplateExercise(row: Record<string, unknown>): TemplateExercise {
  return {
    exerciseId:       row.exercise_id as string,
    sets:             row.sets as number,
    repRange:         [row.rep_range_min as number, row.rep_range_max as number],
    isSuperset:       row.is_superset as boolean,
    supersetGroupId:  row.superset_group_id as string | undefined,
  };
}

export function useTemplate(templateId: string): WorkoutTemplate | undefined {
  const [template, setTemplate] = useState<WorkoutTemplate | undefined>(undefined);

  const load = useCallback(async () => {
    if (!templateId) return;
    const user = getLocalSession();
    if (!user) return;
    const meta = defaultTemplateMap.get(templateId);
    if (!meta) return;

    const { data } = await supabase
      .from('template_exercises')
      .select('*')
      .eq('user_id', user.id)
      .eq('template_id', templateId)
      .order('position');

    setTemplate({ ...meta, exercises: data ? data.map(rowToTemplateExercise) : [] });
  }, [templateId]);

  useEffect(() => { void load(); }, [load]);

  return template;
}

export async function saveTemplate(template: WorkoutTemplate): Promise<void> {
  const user = getLocalSession();
  if (!user) return;

  await supabase
    .from('template_exercises')
    .delete()
    .eq('user_id', user.id)
    .eq('template_id', template.id);

  if (template.exercises.length > 0) {
    await supabase.from('template_exercises').insert(
      template.exercises.map((te, i) => ({
        id:                nanoid(),
        user_id:           user.id,
        template_id:       template.id,
        exercise_id:       te.exerciseId,
        position:          i,
        sets:              te.sets,
        rep_range_min:     te.repRange[0],
        rep_range_max:     te.repRange[1],
        is_superset:       te.isSuperset,
        superset_group_id: te.supersetGroupId ?? null,
      })),
    );
  }
}

// useTemplates is kept for WorkoutHistory — returns all static templates
export function useTemplates(): WorkoutTemplate[] {
  return staticTemplates;
}

// No longer needed but kept as no-op to avoid breaking any stale imports
export async function resetTemplate(_id: string): Promise<void> {
  // Templates start empty per user; "reset" just clears all exercises
  const user = getLocalSession();
  if (!user) return;
  await supabase
    .from('template_exercises')
    .delete()
    .eq('user_id', user.id)
    .eq('template_id', _id);
}
