import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { PaperPlaneTilt, X, Check } from '@phosphor-icons/react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useExercises, useStretches } from '@/hooks/useExercises';
import { getLocalSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────

type ProposedAction = {
  kind: string;
  label: string;
  [key: string]: unknown;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  proposedActions?: ProposedAction[];
  planApplied?: boolean;
  planDiscarded?: boolean;
  fresh?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onActionsApplied: () => void;
};

// ─── Constants ────────────────────────────────────────────────────

const GREETING = "Hi! I can help you plan your workouts. When I suggest changes, I'll show you a plan to review before anything is applied. Try asking me to set up a full day, add stretches, or create new exercises.";

const LOADING_STATUSES = [
  'Reading your data…',
  'Planning your workout…',
  'Finalising plan…',
];

const TEMPLATE_IDS = ['push', 'pull', 'legs', 'core', 'glutes', 'back'] as const;
const TEMPLATE_NAMES: Record<string, string> = {
  push: 'Push Day', pull: 'Pull Day', legs: 'Leg Day',
  core: 'Core Day', glutes: 'Glute Day', back: 'Back Day',
};

// ─── Typewriter ───────────────────────────────────────────────────

const CHARS_PER_SEC = 40;

function TypewriterText({ text, onDone }: { text: string; onDone: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed('');
    const interval = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        clearInterval(interval);
        onDoneRef.current();
      }
    }, 1000 / CHARS_PER_SEC);
    return () => clearInterval(interval);
  }, [text]);

  return <>{displayed}</>;
}

// ─── Plan card ────────────────────────────────────────────────────

function PlanCard({
  actions,
  applied,
  discarded,
  onAccept,
  onDiscard,
  disabled,
}: {
  actions: ProposedAction[];
  applied: boolean;
  discarded: boolean;
  onAccept: () => void;
  onDiscard: () => void;
  disabled: boolean;
}) {
  if (discarded) return null;

  return (
    <div
      style={{
        marginTop: '0.5rem',
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
      >
        <span
          className="font-body"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-accent)', letterSpacing: '0.08em', fontWeight: 500 }}
        >
          PROPOSED CHANGES — {actions.length}
        </span>
      </div>

      <ul className="px-3 py-2 flex flex-col gap-1.5">
        {actions.map((action, i) => (
          <li
            key={i}
            className="flex items-start gap-2 font-body"
            style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', lineHeight: 1.4 }}
          >
            <span style={{ color: 'var(--color-text-faint)', marginTop: '0.05em', flexShrink: 0 }}>·</span>
            {action.label as string}
          </li>
        ))}
      </ul>

      <div
        className="flex gap-2 px-3 py-3"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        {applied ? (
          <span
            className="flex items-center gap-1.5 font-body"
            style={{ fontSize: 'var(--text-meta)', color: 'var(--color-success)' }}
          >
            <Check size={14} weight="bold" />
            Applied
          </span>
        ) : (
          <>
            <button
              onClick={onAccept}
              disabled={disabled}
              className="flex-1 font-body font-medium"
              style={{
                padding: '0.5rem',
                background: disabled ? 'var(--color-surface-2)' : 'var(--color-accent)',
                color: disabled ? 'var(--color-text-faint)' : '#fff',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-meta)',
                transition: 'opacity 150ms',
              }}
            >
              {disabled ? 'Applying…' : 'Apply all'}
            </button>
            <button
              onClick={onDiscard}
              disabled={disabled}
              className="font-body"
              style={{
                padding: '0.5rem 1rem',
                border: 'var(--border-thin)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-meta)',
              }}
            >
              Discard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────

export function AIChatDrawer({ open, onClose, onActionsApplied }: Props) {
  const [messages, setMessages]   = useState<Message[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [applying, setApplying]   = useState<number | null>(null);
  const [statusIdx, setStatusIdx] = useState(0);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const allExercises = useExercises();
  const allStretches = useStretches();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Cycle loading status messages every 2.5s while waiting
  useEffect(() => {
    if (!loading) { setStatusIdx(0); return; }
    const id = setInterval(() => setStatusIdx(i => Math.min(i + 1, LOADING_STATUSES.length - 1)), 2500);
    return () => clearInterval(id);
  }, [loading]);

  const loadingStatus = useMemo(() => LOADING_STATUSES[statusIdx], [statusIdx]);

  const clearFresh = useCallback((index: number) => {
    setMessages(prev => prev.map((m, i) => i === index ? { ...m, fresh: false } : m));
  }, []);

  // ── Accept a plan ───────────────────────────────────────────────

  const handleAccept = async (messageIndex: number) => {
    const msg = messages[messageIndex];
    if (!msg.proposedActions) return;
    const user = getLocalSession();
    if (!user) return;

    setApplying(messageIndex);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ userId: user.id, mode: 'execute', proposedActions: msg.proposedActions }),
        },
      );
      const data = await res.json() as { reply?: string; actionsApplied?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to apply');

      setMessages(prev => prev.map((m, i) => i === messageIndex ? { ...m, planApplied: true } : m));
      onActionsApplied();
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Failed to apply: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }]);
    } finally {
      setApplying(null);
    }
  };

  // ── Discard a plan ──────────────────────────────────────────────

  const handleDiscard = (messageIndex: number) => {
    setMessages(prev => prev.map((m, i) => i === messageIndex ? { ...m, planDiscarded: true } : m));
  };

  // ── Send a message ──────────────────────────────────────────────

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const user = getLocalSession();
    if (!user) return;

    if (!navigator.onLine) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: 'The AI assistant requires an internet connection. Please try again when you\'re online.' },
      ]);
      setInput('');
      return;
    }

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const [
        { data: templateExRows },
        { data: templateStretchRows },
        { data: recentSetRows },
        { data: bodyStatRows },
      ] = await Promise.all([
        supabase.from('template_exercises').select('template_id, exercise_id, sets, rep_range_min, rep_range_max').eq('user_id', user.id),
        supabase.from('template_stretches').select('template_id, exercise_id, phase, position, rest_seconds').eq('user_id', user.id).order('position'),
        supabase.from('logged_sets').select('exercise_id, weight_kg, reps, completed_at').eq('user_id', user.id).eq('is_warmup', false).order('completed_at', { ascending: false }).limit(200),
        supabase.from('body_stats').select('date, weight_kg, waist_cm, chest_cm').eq('user_id', user.id).order('date', { ascending: false }).limit(6),
      ]);

      const exerciseLibrary = allExercises.map(e => ({
        id: e.id, name: e.name, category: e.category,
        isTimed: e.isTimed ?? false, isBodyweight: e.isBodyweight,
      }));
      const stretchLibrary = allStretches.map(s => ({ id: s.id, name: s.name, category: s.category }));

      const templateMap: Record<string, { id: string; name: string; exercises: Array<{ exerciseId: string; sets: number; repRangeMin: number; repRangeMax: number }> }> = {};
      for (const tid of TEMPLATE_IDS) templateMap[tid] = { id: tid, name: TEMPLATE_NAMES[tid], exercises: [] };
      for (const row of templateExRows ?? []) {
        const t = templateMap[row.template_id as string];
        if (t) t.exercises.push({ exerciseId: row.exercise_id as string, sets: row.sets as number, repRangeMin: row.rep_range_min as number, repRangeMax: row.rep_range_max as number });
      }

      const stretchMap: Record<string, { templateId: string; pre: Array<{ exerciseId: string; restSeconds: number }>; post: Array<{ exerciseId: string; restSeconds: number }> }> = {};
      for (const tid of TEMPLATE_IDS) stretchMap[tid] = { templateId: tid, pre: [], post: [] };
      for (const row of templateStretchRows ?? []) {
        const t = stretchMap[row.template_id as string];
        if (t) {
          const phase = row.phase as 'pre' | 'post';
          t[phase].push({ exerciseId: row.exercise_id as string, restSeconds: row.rest_seconds as number });
        }
      }

      const historyMap: Record<string, Array<{ weightKg: number; reps: number }>> = {};
      for (const row of recentSetRows ?? []) {
        const eid = row.exercise_id as string;
        if (!historyMap[eid]) historyMap[eid] = [];
        if (historyMap[eid].length < 5) historyMap[eid].push({ weightKg: row.weight_kg as number, reps: row.reps as number });
      }
      const recentHistory = Object.entries(historyMap).map(([exerciseId, recentSets]) => ({ exerciseId, recentSets }));

      const bodyStats = (bodyStatRows ?? []).map(r => ({
        date: r.date as number,
        weightKg: r.weight_kg as number | null ?? undefined,
        waistCm:  r.waist_cm  as number | null ?? undefined,
        chestCm:  r.chest_cm  as number | null ?? undefined,
      }));

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({
            userId: user.id,
            mode: 'plan',
            message: text,
            exerciseLibrary,
            stretchLibrary,
            currentTemplates: Object.values(templateMap),
            templateStretches: Object.values(stretchMap),
            recentHistory,
            bodyStats,
          }),
        },
      );

      const data = await res.json() as { reply?: string; proposedActions?: ProposedAction[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Request failed');

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply ?? 'Here is my plan.',
        proposedActions: (data.proposedActions?.length ?? 0) > 0 ? data.proposedActions : undefined,
        fresh: true,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <Drawer open={open} onClose={onClose}>
      <DrawerContent
        style={{ background: 'var(--color-surface)', maxHeight: '85dvh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: 'var(--border-thin)' }}>
          <span className="font-display tracking-widest" style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)' }}>
            AI ASSISTANT
          </span>
          <button onClick={onClose} style={{ color: 'var(--color-text-faint)' }} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className="font-body"
                style={{
                  maxWidth: '82%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-surface-2)',
                  color: msg.role === 'user' ? '#fff' : 'var(--color-text)',
                  fontSize: 'var(--text-body)',
                  lineHeight: 1.55,
                  wordBreak: 'break-word',
                }}
              >
                {msg.role === 'user' ? msg.content
                  : msg.fresh
                    ? <TypewriterText text={msg.content} onDone={() => clearFresh(i)} />
                    : <ReactMarkdown
                        components={{
                          p:      ({ children }) => <span style={{ display: 'block' }}>{children}</span>,
                          strong: ({ children }) => <strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>{children}</strong>,
                          em:     ({ children }) => <em>{children}</em>,
                          ul:     ({ children }) => <ul style={{ paddingLeft: '1.2em', marginTop: '0.25em' }}>{children}</ul>,
                          ol:     ({ children }) => <ol style={{ paddingLeft: '1.2em', marginTop: '0.25em' }}>{children}</ol>,
                          li:     ({ children }) => <li style={{ marginBottom: '0.15em' }}>{children}</li>,
                        }}
                      >{msg.content}</ReactMarkdown>
                }
              </div>

              {msg.proposedActions && (
                <div style={{ width: '100%', maxWidth: '92%' }}>
                  <PlanCard
                    actions={msg.proposedActions}
                    applied={msg.planApplied ?? false}
                    discarded={msg.planDiscarded ?? false}
                    onAccept={() => void handleAccept(i)}
                    onDiscard={() => handleDiscard(i)}
                    disabled={applying !== null}
                  />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div
                className="font-body"
                style={{
                  padding: '0.625rem 0.875rem',
                  borderRadius: '12px 12px 12px 2px',
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-meta)',
                  transition: 'opacity 300ms',
                }}
              >
                {loadingStatus}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderTop: 'var(--border-thin)' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Ask me anything…"
            className="flex-1 font-body bg-transparent outline-none"
            style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', caretColor: 'var(--color-accent)' }}
          />
          <button
            onClick={() => void send()}
            disabled={!input.trim() || loading}
            style={{ color: !input.trim() || loading ? 'var(--color-text-faint)' : 'var(--color-accent)', transition: 'color 150ms', flexShrink: 0 }}
            aria-label="Send"
          >
            <PaperPlaneTilt size={20} weight="fill" />
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
