import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClockCounterClockwise, Trophy } from '@phosphor-icons/react';
import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { supabase } from '@/lib/supabase';
import { getLocalSession } from '@/lib/auth';
import { useExercises } from '@/hooks/useExercises';
import { useTemplates } from '@/hooks/useTemplates';
import { templateMap as defaultTemplateMap } from '@/data/templates';
import type { WorkoutSession } from '@/types';

// ─── Helpers ────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function formatDate(ts: number): string {
  return dateFormatter.format(new Date(ts));
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

// ─── Types ──────────────────────────────────────────────────────

type EnrichedSession = {
  session: WorkoutSession;
  workSetCount: number;
  prCount: number;
  exerciseIds: string[];
};

// ─── Session card ────────────────────────────────────────────────

function SessionCard({
  data,
  exerciseMap,
  templateLabel,
}: {
  data: EnrichedSession;
  exerciseMap: Map<string, string>;
  templateLabel: string;
}) {
  const { session, workSetCount, prCount, exerciseIds } = data;

  const MAX_SHOWN = 3;
  const shownIds = exerciseIds.slice(0, MAX_SHOWN);
  const overflow = exerciseIds.length - MAX_SHOWN;

  return (
    <div
      className="px-4 py-4"
      style={{ borderBottom: 'var(--border-thin)' }}
    >
      {/* Top row: day label + date */}
      <div className="flex items-baseline justify-between mb-2">
        <span
          className="font-display"
          style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)', letterSpacing: '0.05em' }}
        >
          {templateLabel}
        </span>
        <span
          className="font-body"
          style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
        >
          {formatDate(session.startedAt)}
        </span>
      </div>

      {/* Exercise list — tappable links */}
      <p
        className="font-body mb-3"
        style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}
      >
        {shownIds.map((id, i) => (
          <span key={id}>
            {i > 0 && <span style={{ color: 'var(--color-text-faint)' }}> · </span>}
            <Link
              to={`/exercise/${id}`}
              style={{ color: 'var(--color-text-muted)' }}
            >
              {exerciseMap.get(id) ?? id}
            </Link>
          </span>
        ))}
        {overflow > 0 && (
          <span style={{ color: 'var(--color-text-faint)' }}> +{overflow} more</span>
        )}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        <span
          className="font-mono"
          data-numeric
          style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
        >
          {workSetCount} sets
        </span>

        {prCount > 0 && (
          <span
            className="flex items-center gap-1 font-body"
            style={{ fontSize: 'var(--text-meta)', color: 'var(--color-accent)' }}
          >
            <Trophy size={13} weight="fill" />
            {prCount} PR{prCount > 1 ? 's' : ''}
          </span>
        )}

        {session.durationSeconds != null && (
          <span
            className="font-mono"
            data-numeric
            style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
          >
            {formatDuration(session.durationSeconds)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────

export default function WorkoutHistory() {
  const allExercises = useExercises();
  const exerciseMap = new Map(allExercises.map((e) => [e.id, e.name]));

  const liveTemplates = useTemplates() ?? [];
  const liveTemplateMap = new Map(liveTemplates.map((t) => [t.id, t]));

  const getTemplateLabel = (templateId: string): string => {
    const live = liveTemplateMap.get(templateId);
    if (live) return live.shortLabel;
    return defaultTemplateMap.get(templateId)?.shortLabel ?? templateId.toUpperCase();
  };

  const [enrichedSessions, setEnrichedSessions] = useState<EnrichedSession[] | undefined>(undefined);

  useEffect(() => {
    const user = getLocalSession();
    if (!user) { setEnrichedSessions([]); return; }

    const load = async () => {
      const { data: sessionRows } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .order('started_at', { ascending: false });

      if (!sessionRows || sessionRows.length === 0) { setEnrichedSessions([]); return; }

      const sessionIds = sessionRows.map((r) => r.id as string);
      const { data: setRows } = await supabase
        .from('logged_sets')
        .select('session_id, exercise_id, is_warmup, is_pr, completed_at')
        .in('session_id', sessionIds);

      const setsBySession = new Map<string, typeof setRows>();
      for (const s of setRows ?? []) {
        const arr = setsBySession.get(s.session_id as string) ?? [];
        arr.push(s);
        setsBySession.set(s.session_id as string, arr);
      }

      const enriched: EnrichedSession[] = sessionRows.map((row) => {
        const session: WorkoutSession = {
          id:              row.id as string,
          templateId:      row.template_id as string,
          startedAt:       row.started_at as number,
          completedAt:     row.completed_at as number | undefined,
          durationSeconds: row.duration_seconds as number | undefined,
          notes:           row.notes as string | undefined,
        };
        const sets = setsBySession.get(session.id) ?? [];
        const workSets = sets.filter((s) => !s.is_warmup);
        const prCount = workSets.filter((s) => s.is_pr).length;

        const seenIds = new Set<string>();
        const exerciseIds: string[] = [];
        const sorted = [...sets].sort((a, b) => (a.completed_at as number) - (b.completed_at as number));
        for (const s of sorted) {
          const id = s.exercise_id as string;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            exerciseIds.push(id);
          }
        }

        return { session, workSetCount: workSets.length, prCount, exerciseIds };
      });

      setEnrichedSessions(enriched);
    };

    void load();
  }, []);

  const loading = enrichedSessions === undefined;
  const empty = !loading && enrichedSessions.length === 0;

  return (
    <PageShell>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center px-4"
        style={{
          height: 'var(--header-height)',
          background: 'var(--color-bg)',
          borderBottom: 'var(--border-thin)',
        }}
      >
        <span
          className="font-display tracking-widest"
          style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)' }}
        >
          HISTORY
        </span>
      </header>

      <main>
        {loading && (
          <div>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="px-4 py-4"
                style={{ borderBottom: 'var(--border-thin)', opacity: 0.4 }}
              >
                <div
                  className="mb-2"
                  style={{ height: '1.25rem', width: '6rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}
                />
                <div
                  className="mb-3"
                  style={{ height: '0.875rem', width: '80%', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}
                />
                <div
                  style={{ height: '0.75rem', width: '40%', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
            ))}
          </div>
        )}

        {empty && (
          <div className="px-4 pt-16">
            <EmptyState
              icon={<ClockCounterClockwise size={32} />}
              title="No sessions yet"
              description="Complete your first workout and it'll appear here."
            />
          </div>
        )}

        {!loading && !empty && enrichedSessions.map((data) => (
          <SessionCard
            key={data.session.id}
            data={data}
            exerciseMap={exerciseMap}
            templateLabel={getTemplateLabel(data.session.templateId)}
          />
        ))}
      </main>
    </PageShell>
  );
}
