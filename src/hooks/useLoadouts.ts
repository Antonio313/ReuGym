import { useLiveQuery } from 'dexie-react-hooks';
import { getLocalSession } from '@/lib/auth';
import { getDB } from '@/data/db';
import { enqueueSync, syncNow } from '@/lib/sync';
import { templateMap as defaultTemplateMap, loadoutsForCategory, defaultLoadoutId } from '@/data/templates';
import type { LoadoutInfo } from '@/types';

// ─── Loadout display names — override ?? static default ("Loadout 2") ────

export function useLoadoutName(templateId: string): string {
  const user = getLocalSession();

  const override = useLiveQuery(async () => {
    if (!user || !templateId) return undefined;
    const db = getDB(user.id);
    const row = await db.loadoutNames.get([user.id, templateId]);
    return row?.name;
  }, [templateId, user?.id]);

  return override ?? defaultTemplateMap.get(templateId)?.name ?? templateId;
}

export function useLoadoutNameOverrides(): Map<string, string> {
  const user = getLocalSession();

  return useLiveQuery(async () => {
    if (!user) return new Map<string, string>();
    const db = getDB(user.id);
    const rows = await db.loadoutNames.where('userId').equals(user.id).toArray();
    return new Map(rows.map((r) => [r.templateId, r.name]));
  }, [user?.id]) ?? new Map();
}

export async function renameLoadout(templateId: string, name: string): Promise<void> {
  const user = getLocalSession();
  if (!user) return;

  const db = getDB(user.id);
  await db.loadoutNames.put({ userId: user.id, templateId, name });

  await enqueueSync(user.id, 'loadout_names', 'upsert', {
    user_id:     user.id,
    template_id: templateId,
    name,
  });
  // Renaming happens on the edit page, outside a workout session — confirm
  // it actually reached Supabase now (mirrors createExercise/saveTemplate).
  await syncNow(user.id);
}

// ─── Active loadout per day/category ──────────────────────────────────────

export function useActiveLoadoutId(category: string): string {
  const user = getLocalSession();

  const active = useLiveQuery(async () => {
    if (!user || !category) return undefined;
    const db = getDB(user.id);
    const row = await db.activeLoadouts.get([user.id, category]);
    return row?.templateId;
  }, [category, user?.id]);

  return active ?? defaultLoadoutId(category);
}

export function useActiveLoadoutMap(): Record<string, string> {
  const user = getLocalSession();

  return useLiveQuery(async () => {
    if (!user) return {};
    const db = getDB(user.id);
    const rows = await db.activeLoadouts.where('userId').equals(user.id).toArray();
    const map: Record<string, string> = {};
    for (const row of rows) map[row.category] = row.templateId;
    return map;
  }, [user?.id]) ?? {};
}

export async function setActiveLoadout(category: string, templateId: string): Promise<void> {
  const user = getLocalSession();
  if (!user) return;

  const db = getDB(user.id);
  await db.activeLoadouts.put({ userId: user.id, category, templateId });

  await enqueueSync(user.id, 'active_loadouts', 'upsert', {
    user_id:     user.id,
    category,
    template_id: templateId,
  });
  await syncNow(user.id);
}

// ─── Combined shape for the edit page's loadout switcher ──────────────────

export function useDayLoadouts(category: string): LoadoutInfo[] {
  const overrides = useLoadoutNameOverrides();
  const activeId = useActiveLoadoutId(category);

  if (!category) return [];
  return loadoutsForCategory(category).map((t) => ({
    templateId: t.id,
    slot:       t.loadoutSlot,
    name:       overrides.get(t.id) ?? t.name,
    shortLabel: t.shortLabel,
    isActive:   t.id === activeId,
  }));
}
