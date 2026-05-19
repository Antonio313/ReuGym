import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { templates as defaultTemplates, templateMap as defaultTemplateMap } from '@/data/templates';
import type { WorkoutTemplate } from '@/types';

export function useTemplates(): WorkoutTemplate[] | undefined {
  return useLiveQuery(() => db.customTemplates.toArray());
}

export function useTemplate(id: string): WorkoutTemplate | undefined {
  return useLiveQuery(() => db.customTemplates.get(id));
}

export async function saveTemplate(template: WorkoutTemplate): Promise<void> {
  await db.customTemplates.put(template);
}

export async function resetTemplate(id: string): Promise<void> {
  const original = defaultTemplateMap.get(id);
  if (original) {
    await db.customTemplates.put(original);
  }
}

// Returns the default static list as fallback (used when Dexie hasn't loaded yet)
export { defaultTemplates };
