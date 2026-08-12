import { DAY_CATEGORIES, defaultLoadoutId, templateMap as defaultTemplateMap } from '@/data/templates';
import type { Exercise } from '@/types';

// ─── Form shape ─────────────────────────────────────────────────

export type Experience = 'new' | 'under1' | '1to3' | '3plus';
export type BodyComp = 'lean' | 'average' | 'some' | 'significant';
export type Location = 'gym' | 'home' | 'bodyweight';

export type SetupForm = {
  goals: string;
  weightKg: number | null;
  heightFeet: number | null;
  heightInches: number | null;
  age: number | null;
  experience: Experience | null;
  bodyComp: BodyComp | null;
  currentLifts: string;
  safetyFlags: string[];
  location: Location | null;
  dayCategories: string[];
};

export const EMPTY_FORM: SetupForm = {
  goals: '',
  weightKg: null,
  heightFeet: null,
  heightInches: null,
  age: null,
  experience: null,
  bodyComp: null,
  currentLifts: '',
  safetyFlags: [],
  location: null,
  dayCategories: [],
};

// Hand-written — DAY_CATEGORIES only carries id/name/shortLabel, not a
// muscle-focus summary, and this is genuinely new copy, not something the
// app already had lying around. "Back" and "Glutes" are specialization
// days (extra volume on top of what Pull/Legs already cover), not
// standalone body parts of their own.
const DAY_FOCUS: Record<string, string> = {
  push: 'Chest, shoulders, triceps',
  pull: 'Back, biceps',
  legs: 'Quads, hamstrings, glutes, calves',
  core: 'Abs, obliques, stability',
  back: 'Extra back volume — rows, pulldowns, shrugs',
  glutes: 'Extra glute volume — bridges, hip thrusts, kickbacks',
};

export const DAY_CATEGORY_OPTIONS = DAY_CATEGORIES.map((category) => ({
  category,
  label: defaultTemplateMap.get(category)?.shortLabel ?? category.toUpperCase(),
  focus: DAY_FOCUS[category] ?? '',
}));

export const SAFETY_FLAG_OPTIONS = [
  'Chest pain during physical activity',
  'Dizziness or loss of balance/consciousness',
  'A bone or joint problem that could worsen with exercise',
  'Currently prescribed medication for blood pressure or a heart condition',
  'A diagnosed heart condition',
  'Any other reason a doctor has advised against exercise',
];

const EXPERIENCE_LABEL: Record<Experience, string> = {
  new: 'brand new to lifting',
  under1: 'under 1 year of training experience',
  '1to3': '1–3 years of training experience',
  '3plus': '3+ years of training experience',
};

const BODY_COMP_LABEL: Record<BodyComp, string> = {
  lean: 'lean/athletic build already',
  average: 'an average build',
  some: 'some extra weight to lose',
  significant: 'a significant amount of weight to lose',
};

// ─── Target template ids ────────────────────────────────────────

// "gym" gets a real gym day (loadout 1) + a home/no-equipment backup
// (loadout 2) for every selected day; "home"/"bodyweight" only ever train
// in one context, so they just get loadout 1 built with whatever they have
// access to. Only the categories the user actually picked — no more
// implicitly offering all 6 and trusting the AI to guess which to skip.
export function targetTemplateIds(categories: string[], location: Location | null): string[] {
  const base = categories.map((c) => defaultLoadoutId(c));
  if (location !== 'gym') return base;
  return [...base, ...base.map((id) => `${id}-l2`)];
}

function templateName(id: string): string {
  return defaultTemplateMap.get(id)?.name ?? id;
}

// ─── Message synthesis ──────────────────────────────────────────

export function buildSetupMessage(form: SetupForm, templateIds: string[]): string {
  const lines: string[] = [];
  lines.push('This is a brand new account with no workout history — build a complete program from scratch.');
  lines.push('');
  lines.push(`Goals: ${form.goals.trim() || 'general fitness'}`);
  if (form.weightKg != null) lines.push(`Current weight: ${form.weightKg}kg`);
  if (form.heightFeet != null) lines.push(`Height: ${form.heightFeet}'${form.heightInches ?? 0}"`);
  if (form.age != null) lines.push(`Age: ${form.age}`);
  if (form.experience) lines.push(`Training experience: ${EXPERIENCE_LABEL[form.experience]}`);
  if (form.bodyComp) lines.push(`Body composition: ${BODY_COMP_LABEL[form.bodyComp]}`);
  if (form.currentLifts.trim()) lines.push(`Known current lifts: ${form.currentLifts.trim()}`);

  if (form.location === 'gym') {
    lines.push('Trains at a gym with full equipment access, and wants a home/no-equipment backup version of each day too.');
  } else if (form.location === 'home') {
    lines.push('Trains at home with some equipment (dumbbells, bands, etc.) — no gym access.');
  } else {
    lines.push('Bodyweight only — no equipment access at all.');
  }

  if (form.safetyFlags.length > 0) {
    lines.push('');
    lines.push(`Flagged safety concerns (keep intensity conservative, avoid high-impact/plyometric work where relevant, and note in your summary that they should consult a doctor before starting): ${form.safetyFlags.join('; ')}`);
  }

  lines.push('');
  const idsForDays = form.location === 'gym'
    ? templateIds.filter((id) => !id.endsWith('-l2'))
    : templateIds;
  lines.push(`Build these training days — the user chose them directly, so build all of them, nothing more: ${idsForDays.map(templateName).join(', ')}.`);
  if (form.location === 'gym') {
    lines.push('For every one of those days, also build its home/no-equipment backup at the matching "-l2" template id (e.g. push → push-l2), substituting equipment-free or dumbbell/band alternatives.');
  }

  return lines.join('\n');
}

// ─── Edge function calls (same request shape as the old chat drawer) ────

export type ProposedAction = { kind: string; label: string; [key: string]: unknown };

type PlanResponse = { reply?: string; proposedActions?: ProposedAction[]; warnings?: string[]; error?: string };
type ExecuteResponse = { reply?: string; actionsApplied?: string[]; error?: string };

function exerciseRef(e: Exercise) {
  return { id: e.id, name: e.name, category: e.category, isTimed: e.isTimed ?? false, isBodyweight: e.isBodyweight ?? false };
}

export async function generatePlan(
  userId: string,
  form: SetupForm,
  exercises: Exercise[],
  stretches: Exercise[],
): Promise<{ reply: string; proposedActions: ProposedAction[]; warnings: string[] }> {
  const templateIds = targetTemplateIds(form.dayCategories, form.location);
  const message = buildSetupMessage(form, templateIds);

  const currentTemplates = templateIds.map((id) => ({ id, name: templateName(id), exercises: [] }));
  const templateStretches = templateIds.map((id) => ({ templateId: id, pre: [], post: [] }));
  const bodyStats = form.weightKg != null ? [{ date: Date.now(), weightKg: form.weightKg }] : [];

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({
        userId,
        mode: 'plan',
        message,
        exerciseLibrary: exercises.map(exerciseRef),
        stretchLibrary: stretches.map((s) => ({ id: s.id, name: s.name, category: s.category })),
        currentTemplates,
        templateStretches,
        recentHistory: [],
        bodyStats,
      }),
    },
  );

  const data = await res.json() as PlanResponse;
  if (!res.ok) throw new Error(data.error ?? 'Failed to generate a plan');
  return { reply: data.reply ?? '', proposedActions: data.proposedActions ?? [], warnings: data.warnings ?? [] };
}

export async function applyPlan(userId: string, proposedActions: ProposedAction[]): Promise<string[]> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ userId, mode: 'execute', proposedActions }),
    },
  );
  const data = await res.json() as ExecuteResponse;
  if (!res.ok) throw new Error(data.error ?? 'Failed to apply the plan');
  return data.actionsApplied ?? [];
}
