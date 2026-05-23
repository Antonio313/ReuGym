import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Shared types ─────────────────────────────────────────────────

interface ExerciseRef   { id: string; name: string; category: string; isTimed: boolean; isBodyweight: boolean }
interface StretchRef    { id: string; name: string; category: string }
interface TemplateExRef { exerciseId: string; sets: number; repRangeMin: number; repRangeMax: number }
interface TemplateRef   { id: string; name: string; exercises: TemplateExRef[] }
interface StretchAssign { exerciseId: string; restSeconds: number }
interface TemplateSt    { templateId: string; pre: StretchAssign[]; post: StretchAssign[] }
interface HistoryEntry  { exerciseId: string; recentSets: Array<{ weightKg: number; reps: number }> }
interface BodyStatEntry { date: number; weightKg?: number; waistCm?: number; chestCm?: number }

// ProposedAction is a generic bag — specific fields depend on kind
interface ProposedAction { kind: string; label: string; [key: string]: unknown }

interface RequestBody {
  userId:            string;
  mode?:             'plan' | 'execute';
  // plan mode fields
  message?:          string;
  exerciseLibrary?:  ExerciseRef[];
  stretchLibrary?:   StretchRef[];
  currentTemplates?: TemplateRef[];
  templateStretches?:TemplateSt[];
  recentHistory?:    HistoryEntry[];
  bodyStats?:        BodyStatEntry[];
  // execute mode fields
  proposedActions?:  ProposedAction[];
}

type ContentBlock = { type: string; [key: string]: unknown };
interface AnthropicResponse { stop_reason: string; content: ContentBlock[] }

// ─── Tool definitions ─────────────────────────────────────────────

const TOOLS = [
  {
    name: 'add_exercise_to_template',
    description: 'Add an existing exercise from the library to a workout template.',
    input_schema: {
      type: 'object',
      properties: {
        templateId:  { type: 'string', description: 'push, pull, legs, core, glutes, or back' },
        exerciseId:  { type: 'string', description: 'Exact exercise ID from the library or a just-created exercise ID' },
        sets:        { type: 'number', description: 'Number of sets' },
        repRangeMin: { type: 'number', description: 'Min reps, or min seconds for timed exercises' },
        repRangeMax: { type: 'number', description: 'Max reps, or max seconds for timed exercises' },
      },
      required: ['templateId', 'exerciseId', 'sets', 'repRangeMin', 'repRangeMax'],
    },
  },
  {
    name: 'add_stretch_to_template',
    description: 'Add a stretch to a workout template pre or post routine.',
    input_schema: {
      type: 'object',
      properties: {
        templateId:  { type: 'string', description: 'push, pull, legs, core, glutes, or back' },
        stretchId:   { type: 'string', description: 'Exact stretch ID from the library or a just-created stretch ID' },
        phase:       { type: 'string', enum: ['pre', 'post'], description: 'Pre-workout or post-workout' },
        restSeconds: { type: 'number', description: 'Hold duration in seconds, typically 20–60' },
      },
      required: ['templateId', 'stretchId', 'phase', 'restSeconds'],
    },
  },
  {
    name: 'create_custom_exercise',
    description: 'Create a new exercise or stretch not in the library. Returns an ID you can use with add_exercise_to_template or add_stretch_to_template.',
    input_schema: {
      type: 'object',
      properties: {
        name:               { type: 'string' },
        category:           { type: 'string', enum: ['push', 'pull', 'legs', 'core', 'glutes', 'back'] },
        type:               { type: 'string', enum: ['compound', 'accessory', 'plyo', 'isometric'] },
        muscles:            { type: 'array', items: { type: 'string' }, description: 'e.g. ["chest","triceps"]' },
        defaultRepRangeMin: { type: 'number', description: 'For timed: seconds (e.g. 20)' },
        defaultRepRangeMax: { type: 'number', description: 'For timed: seconds (e.g. 45)' },
        startingWeightKg:   { type: 'number', description: '0 for bodyweight / timed / cable exercises' },
        restSeconds:        { type: 'number', description: 'Rest between sets in seconds' },
        isBodyweight:       { type: 'boolean' },
        isTimed:            { type: 'boolean', description: 'True if effort is measured in seconds (plank, dead hang, etc.)' },
        isStretch:          { type: 'boolean', description: 'True if this is a stretch, not a strength exercise' },
      },
      required: ['name', 'category', 'type', 'muscles', 'defaultRepRangeMin', 'defaultRepRangeMax', 'startingWeightKg', 'restSeconds', 'isBodyweight', 'isTimed', 'isStretch'],
    },
  },
  {
    name: 'remove_exercise_from_template',
    description: 'Remove an exercise from a workout template.',
    input_schema: {
      type: 'object',
      properties: {
        templateId: { type: 'string', description: 'push, pull, legs, core, glutes, or back' },
        exerciseId: { type: 'string', description: 'Exact exercise ID to remove' },
      },
      required: ['templateId', 'exerciseId'],
    },
  },
  {
    name: 'remove_stretch_from_template',
    description: 'Remove a stretch from a workout template pre or post routine.',
    input_schema: {
      type: 'object',
      properties: {
        templateId: { type: 'string', description: 'push, pull, legs, core, glutes, or back' },
        stretchId:  { type: 'string', description: 'Exact stretch ID to remove' },
        phase:      { type: 'string', enum: ['pre', 'post'], description: 'Pre-workout or post-workout' },
      },
      required: ['templateId', 'stretchId', 'phase'],
    },
  },
  {
    name: 'set_starting_weight',
    description: 'Set the suggested starting weight and reps/duration for an exercise for this user. Call this for every exercise you add.',
    input_schema: {
      type: 'object',
      properties: {
        exerciseId:       { type: 'string', description: 'Exercise ID (from library or just created)' },
        startingWeightKg: { type: 'number', description: '0 for bodyweight / timed / cable exercises' },
        startingReps:     { type: 'number', description: 'Starting rep count, or starting duration in seconds for timed exercises' },
      },
      required: ['exerciseId', 'startingWeightKg', 'startingReps'],
    },
  },
];

// ─── System prompt ────────────────────────────────────────────────

function buildSystemPrompt(body: RequestBody): string {
  const {
    exerciseLibrary = [], stretchLibrary = [],
    currentTemplates = [], templateStretches = [],
    recentHistory = [], bodyStats = [],
  } = body;

  const exLines = exerciseLibrary.map(e => {
    const flags = [e.isTimed ? 'timed' : '', e.isBodyweight ? 'bodyweight' : ''].filter(Boolean).join(', ');
    return `- ${e.id}: ${e.name} (${e.category}${flags ? ', ' + flags : ''})`;
  }).join('\n');

  const stLines = stretchLibrary.map(s => `- ${s.id}: ${s.name} (${s.category})`).join('\n');

  const templateLines = currentTemplates.map(t => {
    const exList = t.exercises.length === 0 ? 'empty'
      : t.exercises.map(e => {
          const ex = exerciseLibrary.find(x => x.id === e.exerciseId);
          const isTimed = ex?.isTimed;
          return `${ex?.name ?? e.exerciseId} (${e.sets}×${e.repRangeMin}–${e.repRangeMax}${isTimed ? 's' : ''})`;
        }).join(', ');
    return `${t.name}: ${exList}`;
  }).join('\n');

  const stretchLines = templateStretches
    .filter(ts => ts.pre.length > 0 || ts.post.length > 0)
    .map(ts => {
      const fmt = (list: StretchAssign[]) => list.map(s => {
        const st = stretchLibrary.find(x => x.id === s.exerciseId);
        return `${st?.name ?? s.exerciseId} (${s.restSeconds}s)`;
      }).join(', ');
      return `${ts.templateId}: pre=[${ts.pre.length ? fmt(ts.pre) : 'none'}] post=[${ts.post.length ? fmt(ts.post) : 'none'}]`;
    }).join('\n') || 'None assigned yet';

  const historyLines = recentHistory.length === 0 ? 'No history yet'
    : recentHistory.map(h => {
        const ex = exerciseLibrary.find(x => x.id === h.exerciseId);
        const sets = h.recentSets.map(s =>
          ex?.isTimed ? `${s.reps}s` : `${s.weightKg}kg×${s.reps}`
        ).join(', ');
        return `- ${ex?.name ?? h.exerciseId}: ${sets}`;
      }).join('\n');

  const statsLines = bodyStats.length === 0 ? 'No entries yet'
    : bodyStats.map(s => {
        const date = new Date(s.date).toISOString().slice(0, 10);
        const parts: string[] = [];
        if (s.weightKg != null) parts.push(`${s.weightKg}kg`);
        if (s.waistCm  != null) parts.push(`waist ${s.waistCm}cm`);
        if (s.chestCm  != null) parts.push(`chest ${s.chestCm}cm`);
        return `- ${date}: ${parts.join(', ')}`;
      }).join('\n');

  return `You are a workout planning assistant for ReuGym. You plan and modify the user's workout program by calling tools.

## RULES — READ CAREFULLY
- When asked to add or create anything, call the relevant tool immediately. Do not describe what you will do first.
- ALWAYS use exact ID strings from the exercise/stretch library. Never invent IDs.
- If an exercise or stretch is not in the library, use create_custom_exercise to create it, then use the returned ID.
- For TIMED exercises (marked "timed" in library): rep range = seconds (e.g. 20–45), startingWeightKg = 0, startingReps = starting duration in seconds.
- Call set_starting_weight for EVERY exercise/stretch you add so the user starts at an appropriate level.
- After all tool calls, give a brief 1–2 sentence summary of what was planned.
- You can suggest exercises and stretches that are not in the library — use your own knowledge to create them.
- Never use emojis in your responses.

## EXERCISE LIBRARY
${exLines}

## STRETCH LIBRARY
${stLines}

## CURRENT WORKOUT TEMPLATES
${templateLines}

## CURRENT STRETCH ASSIGNMENTS
${stretchLines}

## RECENT PERFORMANCE (last 5 work sets, most recent first)
${historyLines}

## BODY STATS
${statsLines}`;
}

// ─── Claude API ───────────────────────────────────────────────────

async function callClaude(messages: unknown[], system: string, apiKey: string): Promise<AnthropicResponse> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system,
      tools: TOOLS,
      messages,
    }),
  });
  return res.json();
}

// ─── Execute confirmed actions ─────────────────────────────────────

async function executeActions(
  actions: ProposedAction[],
  userId: string,
  db: ReturnType<typeof createClient>,
): Promise<string[]> {
  const applied: string[] = [];

  for (const action of actions) {
    try {
      if (action.kind === 'create_exercise') {
        const { error } = await db.from('custom_exercises').insert({
          id:                action.id,
          user_id:           userId,
          name:              action.name,
          category:          action.category,
          type:              action.exerciseType,
          muscles:           action.muscles,
          default_rep_range: [action.defaultRepRangeMin, action.defaultRepRangeMax],
          starting_weight_kg: action.startingWeightKg,
          rest_seconds:      action.restSeconds,
          is_bodyweight:     action.isBodyweight,
          is_cable:          false,
          is_timed:          action.isTimed ?? false,
          is_stretch:        action.isStretch ?? false,
          video_url:         null,
          notes:             null,
        });
        if (!error) applied.push(action.label as string);

      } else if (action.kind === 'add_to_template') {
        const { data: ex } = await db.from('template_exercises')
          .select('position').eq('user_id', userId).eq('template_id', action.templateId as string)
          .order('position', { ascending: false }).limit(1);
        const pos = ((ex?.[0]?.position as number | undefined) ?? -1) + 1;
        const { error } = await db.from('template_exercises').insert({
          id: crypto.randomUUID().replace(/-/g, '').slice(0, 21),
          user_id: userId, template_id: action.templateId,
          exercise_id: action.exerciseId, position: pos,
          sets: action.sets, rep_range_min: action.repRangeMin, rep_range_max: action.repRangeMax,
          is_superset: false, superset_group_id: null,
        });
        if (!error) applied.push(action.label as string);

      } else if (action.kind === 'add_stretch') {
        const { data: ex } = await db.from('template_stretches')
          .select('position').eq('user_id', userId).eq('template_id', action.templateId as string).eq('phase', action.phase as string)
          .order('position', { ascending: false }).limit(1);
        const pos = ((ex?.[0]?.position as number | undefined) ?? -1) + 1;
        const { error } = await db.from('template_stretches').insert({
          id: crypto.randomUUID().replace(/-/g, '').slice(0, 21),
          user_id: userId, template_id: action.templateId,
          exercise_id: action.stretchId, phase: action.phase,
          position: pos, rest_seconds: action.restSeconds,
        });
        if (!error) applied.push(action.label as string);

      } else if (action.kind === 'remove_exercise') {
        const { error } = await db.from('template_exercises')
          .delete()
          .eq('user_id', userId)
          .eq('template_id', action.templateId as string)
          .eq('exercise_id', action.exerciseId as string);
        if (!error) applied.push(action.label as string);

      } else if (action.kind === 'remove_stretch') {
        const { error } = await db.from('template_stretches')
          .delete()
          .eq('user_id', userId)
          .eq('template_id', action.templateId as string)
          .eq('exercise_id', action.stretchId as string)
          .eq('phase', action.phase as string);
        if (!error) applied.push(action.label as string);

      } else if (action.kind === 'set_weight') {
        const { error } = await db.from('exercise_prefs').upsert({
          user_id: userId, exercise_id: action.exerciseId,
          starting_weight_kg: action.startingWeightKg,
          starting_reps: action.startingReps ?? null,
        });
        if (!error) applied.push(action.label as string);
      }
    } catch {
      // continue on individual action failure
    }
  }

  return applied;
}

// ─── Plan mode — collect tool calls without writing to DB ──────────

async function planMode(
  body: RequestBody,
  apiKey: string,
): Promise<{ reply: string; proposedActions: ProposedAction[] }> {
  const system = buildSystemPrompt(body);
  const exerciseLibrary = body.exerciseLibrary ?? [];
  const stretchLibrary  = body.stretchLibrary ?? [];

  type Msg = { role: string; content: unknown };
  const messages: Msg[] = [{ role: 'user', content: body.message ?? '' }];
  const proposedActions: ProposedAction[] = [];
  let finalReply = '';

  // Track newly created exercises/stretches so add calls can resolve names
  const createdItems: Array<{ id: string; name: string }> = [];

  for (let round = 0; round < 6; round++) {
    const apiResp = await callClaude(messages, system, apiKey);

    if (apiResp.stop_reason !== 'tool_use') {
      const textBlock = apiResp.content.find(b => b.type === 'text');
      if (textBlock) finalReply = textBlock.text as string;
      break;
    }

    messages.push({ role: 'assistant', content: apiResp.content });

    const toolResults: unknown[] = [];
    for (const block of apiResp.content) {
      if (block.type !== 'tool_use') continue;
      const inp = block.input as Record<string, unknown>;

      if (block.name === 'create_custom_exercise') {
        const id = crypto.randomUUID().replace(/-/g, '').slice(0, 21);
        const isStretch = (inp.isStretch as boolean) ?? false;
        createdItems.push({ id, name: inp.name as string });
        proposedActions.push({
          kind: 'create_exercise', id, label: `Create ${isStretch ? 'stretch' : 'exercise'}: ${inp.name as string} (${inp.category as string})`,
          name: inp.name, category: inp.category, exerciseType: inp.type, muscles: inp.muscles,
          defaultRepRangeMin: inp.defaultRepRangeMin, defaultRepRangeMax: inp.defaultRepRangeMax,
          startingWeightKg: inp.startingWeightKg, restSeconds: inp.restSeconds,
          isBodyweight: inp.isBodyweight, isTimed: inp.isTimed ?? false, isStretch,
        });
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ success: true, exerciseId: id, name: inp.name }) });

      } else if (block.name === 'add_exercise_to_template') {
        const exId   = inp.exerciseId as string;
        const exName = exerciseLibrary.find(e => e.id === exId)?.name ?? createdItems.find(c => c.id === exId)?.name ?? exId;
        const isTimed = exerciseLibrary.find(e => e.id === exId)?.isTimed ?? false;
        const unit    = isTimed ? 's' : '';
        proposedActions.push({
          kind: 'add_to_template', templateId: inp.templateId, exerciseId: exId,
          sets: inp.sets, repRangeMin: inp.repRangeMin, repRangeMax: inp.repRangeMax,
          label: `Add ${exName} to ${inp.templateId as string} day — ${inp.sets as number}×${inp.repRangeMin as number}–${inp.repRangeMax as number}${unit}`,
        });
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ success: true }) });

      } else if (block.name === 'add_stretch_to_template') {
        const stId   = inp.stretchId as string;
        const stName = stretchLibrary.find(s => s.id === stId)?.name ?? createdItems.find(c => c.id === stId)?.name ?? stId;
        proposedActions.push({
          kind: 'add_stretch', templateId: inp.templateId, stretchId: stId,
          phase: inp.phase, restSeconds: inp.restSeconds,
          label: `Add ${stName} to ${inp.templateId as string} ${inp.phase as string}-workout (${inp.restSeconds as number}s)`,
        });
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ success: true }) });

      } else if (block.name === 'remove_exercise_from_template') {
        const exId   = inp.exerciseId as string;
        const exName = exerciseLibrary.find(e => e.id === exId)?.name ?? createdItems.find(c => c.id === exId)?.name ?? exId;
        proposedActions.push({
          kind: 'remove_exercise', templateId: inp.templateId, exerciseId: exId,
          label: `Remove ${exName} from ${inp.templateId as string} day`,
        });
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ success: true }) });

      } else if (block.name === 'remove_stretch_from_template') {
        const stId   = inp.stretchId as string;
        const stName = stretchLibrary.find(s => s.id === stId)?.name ?? createdItems.find(c => c.id === stId)?.name ?? stId;
        proposedActions.push({
          kind: 'remove_stretch', templateId: inp.templateId, stretchId: stId, phase: inp.phase,
          label: `Remove ${stName} from ${inp.templateId as string} ${inp.phase as string}-workout`,
        });
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ success: true }) });

      } else if (block.name === 'set_starting_weight') {
        const exId   = inp.exerciseId as string;
        const exName = exerciseLibrary.find(e => e.id === exId)?.name ?? createdItems.find(c => c.id === exId)?.name ?? exId;
        const isTimed = exerciseLibrary.find(e => e.id === exId)?.isTimed ?? false;
        const weightLabel = isTimed
          ? `start at ${inp.startingReps as number}s`
          : (inp.startingWeightKg as number) === 0
            ? `bodyweight, start at ${inp.startingReps as number} reps`
            : `start at ${inp.startingWeightKg as number}kg × ${inp.startingReps as number}`;
        proposedActions.push({
          kind: 'set_weight', exerciseId: exId,
          startingWeightKg: inp.startingWeightKg, startingReps: inp.startingReps,
          label: `${exName} — ${weightLabel}`,
        });
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ success: true }) });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return { reply: finalReply, proposedActions };
}

// ─── Main handler ─────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANTHROPIC_API_KEY         = Deno.env.get('ANTHROPIC_API_KEY')!;

    const db   = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json() as RequestBody;
    const { userId, mode = 'plan' } = body;

    if (mode === 'execute') {
      const applied = await executeActions(body.proposedActions ?? [], userId, db);
      return new Response(
        JSON.stringify({ reply: `Applied ${applied.length} change${applied.length === 1 ? '' : 's'}.`, actionsApplied: applied }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { reply, proposedActions } = await planMode(body, ANTHROPIC_API_KEY);
    return new Response(
      JSON.stringify({ reply, proposedActions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
