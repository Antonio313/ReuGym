import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { useLiveQuery } from 'dexie-react-hooks';
import { getLocalSession } from '@/lib/auth';
import { getDB, type DexieTemplateExercise } from '@/data/db';
import { enqueueSync, syncNow } from '@/lib/sync';
import { templates as staticTemplates, templateMap as defaultTemplateMap } from '@/data/templates';
import type { WorkoutTemplate, TemplateExercise, SubstituteConfig } from '@/types';

export { staticTemplates as defaultTemplates };

function dexieToTemplateExercise(row: DexieTemplateExercise): TemplateExercise {
  return {
    exerciseId:        row.exerciseId,
    sets:              row.sets,
    repRange:          [row.repRangeMin, row.repRangeMax],
    startingWeightKg:  row.startingWeightKg,
    restSeconds:       row.restSeconds,
    isBodyweight:      row.isBodyweight,
    isTimed:           row.isTimed,
    isSuperset:        row.isSuperset,
    supersetGroupId:   row.supersetGroupId,
    substitutes:       row.substitutes ?? [],
  };
}

export function useTemplate(templateId: string): [WorkoutTemplate | undefined, () => void] {
  const user = getLocalSession();
  const [refreshToken, setRefreshToken] = useState(0);

  const template = useLiveQuery(async () => {
    if (!templateId || !user) return undefined;

    const meta = defaultTemplateMap.get(templateId);
    if (!meta) return undefined;

    const db = getDB(user.id);
    const versionKey = `${user.id}_${templateId}`;
    const [rows, version] = await Promise.all([
      db.templateExercises.where('[userId+templateId]').equals([user.id, templateId]).toArray(),
      db.templateVersions.get(versionKey),
    ]);

    rows.sort((a, b) => a.position - b.position);

    // saveTemplate always writes a templateVersions row, even when the
    // resulting exercise list is empty — its presence is what actually
    // means "the user has explicitly saved this template," as opposed to
    // "never customized." Using rows.length alone couldn't tell those apart,
    // so deleting every exercise silently brought the static defaults back.
    const exercises = version ? rows.map(dexieToTemplateExercise) : meta.exercises;
    return { ...meta, exercises };
  }, [templateId, user?.id, refreshToken]);

  const reload = () => setRefreshToken((t) => t + 1);
  return [template, reload];
}

export async function saveTemplate(template: WorkoutTemplate): Promise<void> {
  const user = getLocalSession();
  if (!user) return;

  const db = getDB(user.id);
  const versionKey = `${user.id}_${template.id}`;

  // Build rows with stable IDs shared between Dexie and the sync queue payload
  const rows = template.exercises.map((te, i) => {
    const id = nanoid();
    const dexie: DexieTemplateExercise = {
      id,
      userId:          user.id,
      templateId:      template.id,
      exerciseId:      te.exerciseId,
      position:        i,
      sets:            te.sets,
      repRangeMin:     te.repRange[0],
      repRangeMax:     te.repRange[1],
      startingWeightKg:te.startingWeightKg,
      restSeconds:     te.restSeconds,
      isBodyweight:    te.isBodyweight,
      isTimed:         te.isTimed,
      isSuperset:      te.isSuperset,
      supersetGroupId: te.supersetGroupId,
      substitutes:     te.substitutes ?? [],
    };
    const snake = {
      id,
      user_id:            user.id,
      template_id:        template.id,
      exercise_id:        te.exerciseId,
      position:           i,
      sets:               te.sets,
      rep_range_min:      te.repRange[0],
      rep_range_max:      te.repRange[1],
      starting_weight_kg: te.startingWeightKg,
      rest_seconds:       te.restSeconds,
      is_bodyweight:      te.isBodyweight,
      is_timed:           te.isTimed,
      is_superset:        te.isSuperset,
      superset_group_id:  te.supersetGroupId ?? null,
      substitutes:        (te.substitutes ?? []) as SubstituteConfig[],
    };
    return { dexie, snake };
  });

  // Increment version for conflict resolution
  const stored = await db.templateVersions.get(versionKey);
  const newVersion = (stored?.version ?? 0) + 1;

  // Write to Dexie atomically
  await db.transaction('rw', [db.templateExercises, db.templateVersions], async () => {
    await db.templateExercises
      .where('[userId+templateId]')
      .equals([user.id, template.id])
      .delete();
    await db.templateExercises.bulkPut(rows.map((r) => r.dexie));
    await db.templateVersions.put({ key: versionKey, version: newVersion });
  });

  await enqueueSync(user.id, 'template_exercises', 'replaceAll', {
    templateId: template.id,
    userId:     user.id,
    rows:       rows.map((r) => r.snake),
    version:    newVersion,
  });
  // Editing a template often happens outside a workout session (no later
  // rest-timer/set-logging moment to catch a background push) — confirm it
  // actually reached Supabase now. Callers that already fire this off in
  // the background (e.g. drag-reorder) aren't slowed down by this; nothing
  // here blocks the local Dexie write or the live-query UI update above.
  await syncNow(user.id);
}

// useTemplates returns all static templates — used by WorkoutHistory for display names
export function useTemplates(): WorkoutTemplate[] {
  return staticTemplates;
}

export async function resetTemplate(_id: string): Promise<void> {
  const user = getLocalSession();
  if (!user) return;

  const db = getDB(user.id);
  await db.templateExercises
    .where('[userId+templateId]')
    .equals([user.id, _id])
    .delete();

  await enqueueSync(user.id, 'template_exercises', 'replaceAll', {
    templateId: _id,
    userId:     user.id,
    rows:       [],
    version:    0,
  });
  await syncNow(user.id);
}

// useEffect-based variant for components that can't use useLiveQuery directly
export function useTemplateOnce(templateId: string): WorkoutTemplate | undefined {
  const [template, setTemplate] = useState<WorkoutTemplate | undefined>(undefined);
  const user = getLocalSession();

  useEffect(() => {
    if (!templateId || !user) return;
    const meta = defaultTemplateMap.get(templateId);
    if (!meta) return;

    const db = getDB(user.id);
    db.templateExercises
      .where('[userId+templateId]')
      .equals([user.id, templateId])
      .toArray()
      .then((rows) => {
        rows.sort((a, b) => a.position - b.position);
        const exercises = rows.length > 0 ? rows.map(dexieToTemplateExercise) : meta.exercises;
        setTemplate({ ...meta, exercises });
      });
  }, [templateId, user?.id]);

  return template;
}
