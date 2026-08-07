import { nanoid } from 'nanoid';
import { useLiveQuery } from 'dexie-react-hooks';
import { getLocalSession } from '@/lib/auth';
import { getDB, type DexieTemplateStretch } from '@/data/db';
import { enqueueSync, syncNow } from '@/lib/sync';
import type { DayStretch } from '@/types';

type DayStretchData = { pre: DayStretch[]; post: DayStretch[] };

function dexieToDayStretch(row: DexieTemplateStretch): DayStretch {
  return {
    id:               row.id,
    exerciseId:       row.exerciseId,
    sets:             row.sets,
    repRange:         [row.repRangeMin, row.repRangeMax],
    startingWeightKg: row.startingWeightKg,
    restSeconds:      row.restSeconds,
    isBodyweight:     row.isBodyweight,
    isTimed:          row.isTimed,
    isPerSide:        row.isPerSide,
  };
}

export function useDayStretches(templateId: string): [DayStretchData, () => void] {
  const user = getLocalSession();

  const data = useLiveQuery(async (): Promise<DayStretchData> => {
    if (!templateId || !user) return { pre: [], post: [] };

    const db = getDB(user.id);
    const rows = await db.templateStretches
      .where('[userId+templateId]')
      .equals([user.id, templateId])
      .toArray();

    rows.sort((a, b) => a.position - b.position);

    return {
      pre:  rows.filter((r) => r.phase === 'pre').map(dexieToDayStretch),
      post: rows.filter((r) => r.phase === 'post').map(dexieToDayStretch),
    };
  }, [templateId, user?.id]) ?? { pre: [], post: [] };

  // reload is a no-op — useLiveQuery reacts automatically
  const reload = () => {};

  return [data, reload];
}

export async function saveDayStretches(
  templateId: string,
  pre: DayStretch[],
  post: DayStretch[],
): Promise<void> {
  const user = getLocalSession();
  if (!user) return;

  const db = getDB(user.id);

  const buildRows = (stretches: DayStretch[], phase: 'pre' | 'post') =>
    stretches.map((s, i) => {
      const id = s.id || nanoid();
      const dexie: DexieTemplateStretch = {
        id,
        userId:          user.id,
        templateId,
        exerciseId:      s.exerciseId,
        phase,
        position:        i,
        sets:            s.sets,
        repRangeMin:     s.repRange[0],
        repRangeMax:     s.repRange[1],
        startingWeightKg:s.startingWeightKg,
        restSeconds:     s.restSeconds,
        isBodyweight:    s.isBodyweight,
        isTimed:         s.isTimed,
        isPerSide:       s.isPerSide,
      };
      const snake = {
        id,
        user_id:            user.id,
        template_id:        templateId,
        exercise_id:        s.exerciseId,
        phase,
        position:           i,
        sets:               s.sets,
        rep_range_min:      s.repRange[0],
        rep_range_max:      s.repRange[1],
        starting_weight_kg: s.startingWeightKg,
        rest_seconds:       s.restSeconds,
        is_bodyweight:      s.isBodyweight,
        is_timed:           s.isTimed,
        is_per_side:        s.isPerSide,
      };
      return { dexie, snake };
    });

  const preRows  = buildRows(pre,  'pre');
  const postRows = buildRows(post, 'post');
  const allDexie = [...preRows, ...postRows].map((r) => r.dexie);

  // Version for conflict resolution
  const versionKeyPre  = `${user.id}_${templateId}_pre`;
  const versionKeyPost = `${user.id}_${templateId}_post`;
  const [storedPre, storedPost] = await Promise.all([
    db.templateVersions.get(versionKeyPre),
    db.templateVersions.get(versionKeyPost),
  ]);
  const newVersionPre  = (storedPre?.version  ?? 0) + 1;
  const newVersionPost = (storedPost?.version ?? 0) + 1;

  await db.transaction('rw', [db.templateStretches, db.templateVersions], async () => {
    await db.templateStretches
      .where('[userId+templateId]')
      .equals([user.id, templateId])
      .delete();
    await db.templateStretches.bulkPut(allDexie);
    await db.templateVersions.bulkPut([
      { key: versionKeyPre,  version: newVersionPre  },
      { key: versionKeyPost, version: newVersionPost },
    ]);
  });

  // Enqueue separately per phase so conflict resolution can be per-phase
  await Promise.all([
    enqueueSync(user.id, 'template_stretches', 'replaceAll', {
      templateId, phase: 'pre', userId: user.id,
      rows: preRows.map((r) => r.snake), version: newVersionPre,
    }),
    enqueueSync(user.id, 'template_stretches', 'replaceAll', {
      templateId, phase: 'post', userId: user.id,
      rows: postRows.map((r) => r.snake), version: newVersionPost,
    }),
  ]);

  await syncNow(user.id);
}
