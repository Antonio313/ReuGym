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

// NOTE on architecture: weight/rest/bodyweight/timed/per-side are NOT
// exercise-level properties in this schema (see custom_exercises /
// default_exercises) — they're configured per template-assignment, on
// template_exercises / template_stretches (migrations 002, 003, 007),
// exactly mirroring what a human sets in the Template Editor when adding an
// exercise to a day. create_custom_exercise below only captures identity
// (name/category/muscles/etc.), matching CreateExercise.tsx's own form —
// add_exercise_to_template / add_stretch_to_template are where the AI must
// decide sets/rep-range/rest/bodyweight/timed/per-side for THIS assignment.
const TOOLS = [
  {
    name: 'add_exercise_to_template',
    description: 'Add an existing (or just-created) exercise to a workout template, configuring how it runs for that day — mirrors the Template Editor.',
    input_schema: {
      type: 'object',
      properties: {
        templateId:       { type: 'string', description: 'push, pull, legs, core, glutes, or back for the gym version; push-l2, pull-l2, etc. for the home/no-equipment version (loadout 2)' },
        exerciseId:       { type: 'string', description: 'Exact exercise ID from the library or a just-created exercise ID' },
        sets:             { type: 'number', description: 'Number of sets' },
        repRangeMin:      { type: 'number', description: 'Min reps, or min seconds if isTimed' },
        repRangeMax:      { type: 'number', description: 'Max reps, or max seconds if isTimed' },
        isBodyweight:     { type: 'boolean', description: 'True if no external weight is used for this assignment' },
        isTimed:          { type: 'boolean', description: 'True if effort is measured in seconds, not reps (plank, dead hang, etc.)' },
        isPerSide:        { type: 'boolean', description: 'True if it alternates left/right with no rest between sides (e.g. cable woodchopper), logged as independent sides' },
        startingWeightKg: { type: 'number', description: 'Starting weight in kg. 0 for bodyweight/timed/cable exercises. Omit to default to 0.' },
        restSeconds:      { type: 'number', description: 'Rest between sets in seconds. Omit to default to 60.' },
      },
      required: ['templateId', 'exerciseId', 'sets', 'repRangeMin', 'repRangeMax', 'isBodyweight', 'isTimed', 'isPerSide'],
    },
  },
  {
    name: 'add_stretch_to_template',
    description: 'Add a stretch to a workout template pre or post routine, configuring how it runs for that day — mirrors the Template Editor.',
    input_schema: {
      type: 'object',
      properties: {
        templateId:       { type: 'string', description: 'push, pull, legs, core, glutes, or back for the gym version; push-l2, pull-l2, etc. for the home/no-equipment version (loadout 2)' },
        stretchId:        { type: 'string', description: 'Exact stretch ID from the library or a just-created stretch ID' },
        phase:            { type: 'string', enum: ['pre', 'post'], description: 'Pre-workout or post-workout' },
        sets:             { type: 'number', description: 'Number of sets/rounds. Usually 1.' },
        repRangeMin:      { type: 'number', description: 'Min reps, or min seconds if isTimed' },
        repRangeMax:      { type: 'number', description: 'Max reps, or max seconds if isTimed' },
        isBodyweight:     { type: 'boolean' },
        isTimed:          { type: 'boolean', description: 'True if held for a duration (most stretches), false if counted in reps' },
        restSeconds:      { type: 'number', description: 'Rest between sets in seconds, typically 10–30' },
        startingWeightKg: { type: 'number', description: 'Almost always 0 for stretches. Omit to default to 0.' },
      },
      required: ['templateId', 'stretchId', 'phase', 'sets', 'repRangeMin', 'repRangeMax', 'isBodyweight', 'isTimed', 'restSeconds'],
    },
  },
  {
    name: 'create_custom_exercise',
    description: 'Create a new exercise or stretch not in the library — identity only (matches the app\'s own "new exercise" form). Returns an ID; configure how it\'s used (sets/weight/rest/timed/etc.) via add_exercise_to_template or add_stretch_to_template.',
    input_schema: {
      type: 'object',
      properties: {
        name:      { type: 'string' },
        category:  { type: 'string', enum: ['push', 'pull', 'legs', 'core', 'glutes', 'back', 'general'], description: '"general" is for stretches not tied to one day' },
        type:      { type: 'string', enum: ['compound', 'accessory', 'plyo', 'isometric'] },
        muscles:   { type: 'array', items: { type: 'string' }, description: 'e.g. ["chest","triceps"]' },
        isStretch: { type: 'boolean', description: 'True if this is a stretch, not a strength exercise' },
        videoUrl:  { type: 'string', description: 'Optional reference video URL' },
        notes:     { type: 'string', description: 'Optional short form/technique note' },
      },
      required: ['name', 'category', 'type', 'muscles', 'isStretch'],
    },
  },
  {
    name: 'set_starting_weight',
    description: "Set this user's actual starting weight/reps for an exercise — takes precedence over the template's fallback and is what actually progresses over time. Call this for every weighted exercise you add.",
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
  {
    name: 'finish_planning',
    description: 'Call this LAST, once and only once, after every add_exercise_to_template / add_stretch_to_template / set_starting_weight call is done — signals that the program is complete and ends the session.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'A brief 1-2 sentence summary of what you built, for the user to read.' },
      },
      required: ['summary'],
    },
    // Marks the cache breakpoint for the whole (static, identical-every-
    // round) tools array — see callClaude for why this matters here.
    cache_control: { type: 'ephemeral' },
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
- Every response must be one or more tool calls — you cannot respond with plain text alone, so don't preface a tool
  call by describing what you're about to do first; just call it.
- Batch aggressively: call every tool you can in a single turn rather than one at a time across many turns. You do
  NOT need to wait for a tool result before making the next call — only sequence two calls when the second truly
  needs something the first one returns (e.g. create_custom_exercise's id before add_exercise_to_template can use
  it). Everything else you need to add has no such dependency, so put as many calls as possible in one turn. Each
  turn is a slow, costly round trip; a plan built in 3 large turns is exactly as correct as one built in 20 small
  ones, just much faster.
- ALWAYS use exact ID strings from the exercise/stretch library. Never invent IDs.
- Before creating anything new, check whether the library already has the same movement under a different name
  (e.g. "Diamond Push-Up" and "Close-Grip Push-Up" are the same exercise) — reuse that exact ID rather than
  creating a near-duplicate. New exercises get promoted into this shared library for every future user, so a
  duplicate here isn't just wasted effort, it pollutes the library everyone else sees too.
- If an exercise or stretch is not in the library, use create_custom_exercise to create it, then use the returned ID.
  create_custom_exercise only captures identity (name/category/type/muscles) — it does NOT set weight, rest,
  bodyweight, or timed. Those are configured per assignment when you call add_exercise_to_template /
  add_stretch_to_template, exactly like a human would in the Template Editor: the same exercise can be
  bodyweight in one template and weighted in another, so decide isBodyweight/isTimed/isPerSide fresh each time
  based on what you know about the exercise, not from a stored default.
- For TIMED assignments (isTimed: true): rep range = seconds (e.g. 20–45), startingWeightKg = 0, and if calling
  set_starting_weight, startingReps = starting duration in seconds.
- Call set_starting_weight for EVERY weighted exercise you add so the user starts at an appropriate level — this
  is the user's actual working weight and takes precedence over add_exercise_to_template's startingWeightKg,
  which is only a fallback.
- To build both a gym and a home/no-equipment version of a day, call add_exercise_to_template twice with the
  base templateId (gym) and the -l2 templateId (home) — they're independent exercise lists.
- When everything requested is built, call finish_planning exactly once with a brief 1–2 sentence summary — this is
  the only way to end the session, so nothing is complete until you've called it.
- You can suggest exercises and stretches that are not in the library — use your own knowledge to create them.

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

type MsgBlock = { type: string; cache_control?: { type: 'ephemeral' }; [key: string]: unknown };
type Msg = { role: string; content: unknown };

// Marks a cache breakpoint on the last content block of the last message —
// NOT by mutating the caller's `messages` array, only on a clone used for
// this one request. planMode's conversation grows every round (each round
// resends the full history so far plus whatever's new), so without this,
// the growing prefix gets fully re-processed and re-billed as fresh input
// on every one of up to 20 rounds. Cloning matters because Anthropic caps a
// request at 4 cache breakpoints total — mutating the shared array would
// leave last round's breakpoint sitting on an earlier message and add a new
// one every round, blowing past that limit well before round 4.
function cacheLastBlock(messages: unknown[]): unknown[] {
  if (messages.length === 0) return messages;
  const clone = [...messages];
  const last = clone[clone.length - 1] as Msg;
  const content = typeof last.content === 'string'
    ? [{ type: 'text', text: last.content }]
    : [...(last.content as MsgBlock[])];
  content[content.length - 1] = { ...content[content.length - 1], cache_control: { type: 'ephemeral' } };
  clone[clone.length - 1] = { ...last, content };
  return clone;
}

async function callClaude(
  messages: unknown[],
  system: string,
  apiKey: string,
  tools: unknown[] = TOOLS,
  toolChoice: unknown = { type: 'any' },
): Promise<AnthropicResponse> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      // Sized for building a day's worth of a multi-loadout program from
      // scratch (the setup wizard's per-day planning calls, or the small
      // select_days call) — this is now the only caller, so it's safe to
      // size for the heavier case.
      max_tokens: 8000,
      // Cached: the exercise/stretch library + current templates make this
      // several thousand tokens, and it's byte-identical across every round
      // of a single day's loop AND across every day's concurrent call (all
      // built from the same body), so it can share one cache entry across
      // all of them. Ephemeral cache = ~5min TTL, comfortably longer than a
      // single planning session takes.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools,
      // Forces every turn to be a tool call — with tool_choice left at the
      // default 'auto', the model would sometimes stop after a plain-text
      // "here's what I'll do" preamble on the very first turn, ending the
      // whole session with zero actions and no error (observed live: a
      // real, successful API response that just... didn't call anything).
      // finish_planning (or select_days, for that call) is what lets it end
      // intentionally now instead.
      tool_choice: toolChoice,
      messages: cacheLastBlock(messages),
    }),
  });
  const data = await res.json();
  // Anthropic error responses ({"type":"error","error":{...}}) have no
  // stop_reason/content — without this check they were silently treated as
  // a completion with zero tool calls, surfacing to the user as a
  // misleading "no exercises came back" instead of the real failure
  // (bad/missing API key, unknown model, rate limit, etc.).
  if (!res.ok) {
    const message = (data as { error?: { message?: string } })?.error?.message;
    throw new Error(message ? `Anthropic API error: ${message}` : `Anthropic API error (HTTP ${res.status})`);
  }
  return data as AnthropicResponse;
}

// ─── Execute confirmed actions ─────────────────────────────────────

// Collapses whitespace/punctuation/case so "Diamond Push-Up", "diamond
// push up", and "Diamond  Push-Ups" all compare equal. Doesn't (and isn't
// meant to) catch a same-movement exercise under a genuinely different
// name — that's the AI's own job, per the RULES in buildSystemPrompt. A
// real semantic-similarity pipeline (embeddings + vector search) isn't
// worth the added infrastructure at this library's scale (~100s of rows,
// a handful of creations per wizard run) when the model already reasons
// about exercise equivalence better than a similarity threshold would.
function normalizeExerciseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function executeActions(
  actions: ProposedAction[],
  userId: string,
  db: ReturnType<typeof createClient>,
): Promise<string[]> {
  const applied: string[] = [];

  // Clears whichever templates/phases this plan actually touches before
  // inserting the new set — otherwise re-running setup (e.g. "Redo
  // AI-assisted setup" in Settings) would append on top of whatever's
  // already there instead of replacing it, doubling up every exercise.
  // Scoped tightly to exactly what this batch of actions is about to
  // (re)build: a day outside this plan, or one whose planning failed and
  // so contributed zero actions, is left completely untouched — nothing
  // gets wiped for a day that didn't successfully regenerate.
  const templateIdsToClear = new Set(
    actions.filter(a => a.kind === 'add_to_template').map(a => a.templateId as string),
  );
  for (const templateId of templateIdsToClear) {
    await db.from('template_exercises').delete().eq('user_id', userId).eq('template_id', templateId);
  }
  const stretchScopesToClear = new Set(
    actions.filter(a => a.kind === 'add_stretch').map(a => `${a.templateId as string} ${a.phase as string}`),
  );
  for (const scope of stretchScopesToClear) {
    const [templateId, phase] = scope.split(' ');
    await db.from('template_stretches').delete().eq('user_id', userId).eq('template_id', templateId).eq('phase', phase);
  }

  // Fetched once, not per action — a single wizard run can create a couple
  // dozen exercises across concurrently-planned days that can't see each
  // other's work (e.g. Pull and Back both inventing "Assisted Pull-Up"
  // independently), so this also catches duplicates *within* one batch as
  // knownNames grows through the loop below.
  const { data: existingDefaults } = await db.from('default_exercises').select('name');
  const knownNames = new Set((existingDefaults ?? []).map((e: { name: string }) => normalizeExerciseName(e.name)));

  for (const action of actions) {
    try {
      if (action.kind === 'create_exercise') {
        const { error } = await db.from('custom_exercises').insert({
          id:                 action.id,
          user_id:            userId,
          name:               action.name,
          category:           action.category,
          type:               action.exerciseType,
          muscles:            action.muscles,
          default_rep_range:  null,
          starting_weight_kg: 0,
          rest_seconds:       60,
          is_bodyweight:      false,
          is_cable:           false,
          is_timed:           false,
          is_stretch:         action.isStretch ?? false,
          video_url:          action.videoUrl ?? null,
          notes:              action.notes ?? null,
        });
        if (!error) {
          applied.push(action.label as string);

          // Promotes straight to the shared library — no admin review
          // step. That's a deliberate choice to keep this simple; if the
          // library starts accumulating messy entries, service-role
          // cleanup (or dialing this back to a review queue) is still an
          // option later.
          const normalized = normalizeExerciseName(action.name as string);
          if (!knownNames.has(normalized)) {
            knownNames.add(normalized);
            await db.from('default_exercises').upsert({
              id:                action.id,
              name:              action.name,
              category:          action.category,
              type:              action.exerciseType,
              muscles:           action.muscles,
              default_rep_range: null,
              rest_seconds:      null,
              is_bodyweight:     false,
              is_cable:          false,
              is_timed:          false,
              is_stretch:        action.isStretch ?? false,
              video_url:         action.videoUrl ?? null,
            }, { onConflict: 'id' });
          }
        }

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
          starting_weight_kg: action.startingWeightKg ?? 0,
          rest_seconds: action.restSeconds ?? 60,
          is_bodyweight: action.isBodyweight ?? false,
          is_timed: action.isTimed ?? false,
          is_per_side: action.isPerSide ?? false,
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
          position: pos, rest_seconds: action.restSeconds ?? 30,
          sets: action.sets ?? 1,
          rep_range_min: action.repRangeMin ?? 1,
          rep_range_max: action.repRangeMax ?? 1,
          starting_weight_kg: action.startingWeightKg ?? 0,
          is_bodyweight: action.isBodyweight ?? false,
          is_timed: action.isTimed ?? false,
        });
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

// ─── Planning loop — collect tool calls without writing to DB ──────

// Runs one Claude tool-call conversation to completion (or until maxRounds
// / an abnormal stop). Scoped to whatever `initialMessage` asks for — used
// both for a single day's worth of planning (small, bounded) and, for the
// select_days call, effectively a single round.
async function runPlanningLoop(
  initialMessage: string,
  system: string,
  apiKey: string,
  exerciseLibrary: ExerciseRef[],
  stretchLibrary: StretchRef[],
  maxRounds: number,
): Promise<{ proposedActions: ProposedAction[]; reply: string; done: boolean; debug?: unknown }> {
  const messages: Msg[] = [{ role: 'user', content: initialMessage }];
  const proposedActions: ProposedAction[] = [];
  let finalReply = '';
  let debugInfo: unknown;

  // Track newly created exercises/stretches so add calls can resolve names.
  // Scoped to this one call — if two concurrent day-calls both want the
  // "same" ad-hoc exercise, each creates its own copy rather than sharing
  // one. A known trade-off of planning days independently, not fixed here.
  const createdItems: Array<{ id: string; name: string }> = [];

  let done = false;
  for (let round = 0; round < maxRounds && !done; round++) {
    const apiResp = await callClaude(messages, system, apiKey);

    // tool_choice: 'any' means every turn is guaranteed to be a tool call,
    // but keep this as a safety net for the truly unexpected (e.g. a
    // max_tokens cutoff mid-response) rather than trusting that guarantee
    // blindly.
    if (apiResp.stop_reason !== 'tool_use') {
      const textBlock = apiResp.content.find(b => b.type === 'text');
      if (textBlock) finalReply = textBlock.text as string;
      debugInfo = {
        round,
        stopReason: apiResp.stop_reason,
        contentBlockCount: apiResp.content?.length ?? null,
        contentTypes: apiResp.content?.map(b => b.type) ?? null,
        textBlockText: textBlock?.text ?? null,
      };
      break;
    }

    messages.push({ role: 'assistant', content: apiResp.content });

    const toolResults: unknown[] = [];
    for (const block of apiResp.content) {
      if (block.type !== 'tool_use') continue;
      const inp = block.input as Record<string, unknown>;

      if (block.name === 'finish_planning') {
        finalReply = (inp.summary as string) ?? finalReply;
        done = true;
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ success: true }) });

      } else if (block.name === 'create_custom_exercise') {
        const id = crypto.randomUUID().replace(/-/g, '').slice(0, 21);
        const isStretch = (inp.isStretch as boolean) ?? false;
        createdItems.push({ id, name: inp.name as string });
        proposedActions.push({
          kind: 'create_exercise', id, label: `Create ${isStretch ? 'stretch' : 'exercise'}: ${inp.name as string} (${inp.category as string})`,
          name: inp.name, category: inp.category, exerciseType: inp.type, muscles: inp.muscles,
          isStretch, videoUrl: inp.videoUrl, notes: inp.notes,
        });
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ success: true, exerciseId: id, name: inp.name }) });

      } else if (block.name === 'add_exercise_to_template') {
        const exId   = inp.exerciseId as string;
        const exName = exerciseLibrary.find(e => e.id === exId)?.name ?? createdItems.find(c => c.id === exId)?.name ?? exId;
        const isTimed = (inp.isTimed as boolean) ?? false;
        const unit    = isTimed ? 's' : '';
        proposedActions.push({
          kind: 'add_to_template', templateId: inp.templateId, exerciseId: exId,
          sets: inp.sets, repRangeMin: inp.repRangeMin, repRangeMax: inp.repRangeMax,
          isBodyweight: inp.isBodyweight, isTimed, isPerSide: inp.isPerSide,
          startingWeightKg: inp.startingWeightKg, restSeconds: inp.restSeconds,
          label: `Add ${exName} to ${inp.templateId as string} day — ${inp.sets as number}×${inp.repRangeMin as number}–${inp.repRangeMax as number}${unit}`,
        });
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ success: true }) });

      } else if (block.name === 'add_stretch_to_template') {
        const stId   = inp.stretchId as string;
        const stName = stretchLibrary.find(s => s.id === stId)?.name ?? createdItems.find(c => c.id === stId)?.name ?? stId;
        proposedActions.push({
          kind: 'add_stretch', templateId: inp.templateId, stretchId: stId,
          phase: inp.phase, restSeconds: inp.restSeconds,
          sets: inp.sets, repRangeMin: inp.repRangeMin, repRangeMax: inp.repRangeMax,
          isBodyweight: inp.isBodyweight, isTimed: inp.isTimed, startingWeightKg: inp.startingWeightKg,
          label: `Add ${stName} to ${inp.templateId as string} ${inp.phase as string}-workout (${inp.restSeconds as number}s)`,
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

  return { proposedActions, reply: finalReply, done, debug: debugInfo };
}

// ─── Per-day planning, with retry ──────────────────────────────────

function dayHasRealContent(actions: ProposedAction[]): boolean {
  return actions.some(a => a.kind === 'add_to_template');
}

async function planDay(
  category: string,
  isGym: boolean,
  body: RequestBody,
  system: string,
  apiKey: string,
): Promise<{ proposedActions: ProposedAction[]; reply: string; done: boolean; debug?: unknown }> {
  const templateIds = isGym ? [category, `${category}-l2`] : [category];
  const dayMessage = `${body.message ?? ''}\n\nFor THIS call, build only: ${templateIds.join(', ')}. The other `
    + 'requested days are being planned separately in parallel calls just like this one — do not build or '
    + 'reference any template id outside this list.';

  // A single day (plus its home/no-equipment backup) is a fraction of what
  // the old single-conversation approach needed up to 20 rounds for —
  // observed live at roughly 10-25 actions per day within a 92-106 action
  // full plan. This cap is headroom over that, not a tight fit, so a day's
  // call finishes in well under the 150s Free-tier execution limit even if
  // the batching guidance underperforms on a given run.
  return runPlanningLoop(dayMessage, system, apiKey, body.exerciseLibrary ?? [], body.stretchLibrary ?? [], 10);
}

async function planDayWithRetry(
  category: string,
  isGym: boolean,
  body: RequestBody,
  system: string,
  apiKey: string,
): Promise<{ category: string; proposedActions: ProposedAction[]; reply: string; failed: boolean; attempts: number; lastDebug?: unknown }> {
  // Retrying is cheap here specifically because each attempt only redoes
  // one day's work (a handful of rounds), not the whole program — this is
  // the "catch a bad/empty result and reprompt" the flaky single-call
  // approach couldn't afford without redoing everything.
  const MAX_ATTEMPTS = 3;
  let lastDebug: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await planDay(category, isGym, body, system, apiKey);
    lastDebug = result.debug;
    if (result.done && dayHasRealContent(result.proposedActions)) {
      return { category, proposedActions: result.proposedActions, reply: result.reply, failed: false, attempts: attempt };
    }
  }
  return { category, proposedActions: [], reply: '', failed: true, attempts: MAX_ATTEMPTS, lastDebug };
}

// ─── Plan mode — orchestrates parallel per-day calls ───────────────

async function planMode(
  body: RequestBody,
  apiKey: string,
): Promise<{ reply: string; proposedActions: ProposedAction[]; warnings?: string[]; debug?: unknown }> {
  const system = buildSystemPrompt(body);

  // Which days to build is now the client's decision, not the AI's — the
  // setup wizard has the user pick day categories directly (with muscle-
  // focus copy for each), so body.currentTemplates already contains
  // exactly the templates they chose. No day-selection call needed.
  const isGym = (body.currentTemplates ?? []).some(t => t.id.endsWith('-l2'));
  const chosenDays = [...new Set(
    (body.currentTemplates ?? []).map(t => t.id.endsWith('-l2') ? t.id.slice(0, -3) : t.id),
  )];

  // The whole point: each day's conversation is independent, so they run
  // concurrently. Wall-clock for the group is roughly the slowest single
  // day, not the sum of all of them — this is what actually gets the
  // Edge Function invocation comfortably under the 150s Free-tier limit,
  // where one long serial conversation covering every day kept bumping
  // into it (observed live: 150.2s timeout, 144.4s success — right at the
  // ceiling either way).
  const results = await Promise.all(
    chosenDays.map(category => planDayWithRetry(category, isGym, body, system, apiKey)),
  );

  const proposedActions = results.flatMap(r => r.proposedActions);
  const replies = results.filter(r => !r.failed && r.reply).map(r => r.reply);
  const failed = results.filter(r => r.failed);

  return {
    reply: replies.join(' '),
    proposedActions,
    warnings: failed.length > 0
      ? [`Couldn't finish: ${failed.map(f => f.category).join(', ')}. Try running setup again, or add these day(s) manually afterward.`]
      : undefined,
    debug: failed.length > 0 ? failed.map(f => ({ category: f.category, attempts: f.attempts, lastDebug: f.lastDebug })) : undefined,
  };
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

    const { reply, proposedActions, warnings, debug } = await planMode(body, ANTHROPIC_API_KEY);
    return new Response(
      JSON.stringify({ reply, proposedActions, warnings, debug }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
