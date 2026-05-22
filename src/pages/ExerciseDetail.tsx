import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, PencilSimple } from '@phosphor-icons/react';
import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { supabase } from '@/lib/supabase';
import { getLocalSession } from '@/lib/auth';
import { useExercises, useStretches } from '@/hooks/useExercises';
import type { LoggedSet, WorkoutSession } from '@/types';

// ─── Helpers ────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

function formatDate(ts: number) {
  return dateFormatter.format(new Date(ts));
}

function formatShortDate(ts: number) {
  return shortDateFormatter.format(new Date(ts));
}

// Brzycki formula — only reliable for ≤10 reps
function estimatedOneRM(weightKg: number, reps: number): number | null {
  if (reps <= 0 || reps > 10 || weightKg <= 0) return null;
  return Math.round(weightKg * (36 / (37 - reps)));
}

function topSet(sets: LoggedSet[]): LoggedSet | null {
  const work = sets.filter((s) => !s.isWarmup && s.weightKg > 0);
  if (work.length === 0) return null;
  return work.reduce((best, s) =>
    s.weightKg * s.reps > best.weightKg * best.reps ? s : best,
  );
}

function topReps(sets: LoggedSet[]): LoggedSet | null {
  const work = sets.filter((s) => !s.isWarmup);
  if (work.length === 0) return null;
  return work.reduce((best, s) => (s.reps > best.reps ? s : best));
}

// ─── Chart ──────────────────────────────────────────────────────

type ChartPoint = { label: string; value: number };

function LineChart({ points }: { points: ChartPoint[] }) {
  if (points.length < 2) return null;

  const W = 400;
  const H = 100;
  const PAD = { top: 8, right: 8, bottom: 24, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values = points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const coords = points.map((p, i) => ({
    x: PAD.left + (i / (points.length - 1)) * innerW,
    y: PAD.top + innerH - ((p.value - minVal) / range) * innerH,
    label: p.label,
    value: p.value,
  }));

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');

  // Y-axis ticks: min and max
  const yTicks = [minVal, maxVal];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      aria-hidden
    >
      {/* Horizontal grid lines */}
      {yTicks.map((v) => {
        const y = PAD.top + innerH - ((v - minVal) / range) * innerH;
        return (
          <g key={v}>
            <line
              x1={PAD.left}
              y1={y}
              x2={W - PAD.right}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 4}
              y={y + 4}
              textAnchor="end"
              fontSize="9"
              fill="var(--color-text-faint)"
              fontFamily="var(--font-mono)"
            >
              {v}
            </text>
          </g>
        );
      })}

      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Area fill */}
      <polygon
        points={`${PAD.left},${PAD.top + innerH} ${polyline} ${W - PAD.right},${PAD.top + innerH}`}
        fill="var(--color-accent)"
        opacity="0.08"
      />

      {/* Dots */}
      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r="3"
          fill="var(--color-accent)"
        />
      ))}

      {/* X-axis: first and last label only */}
      {[coords[0], coords[coords.length - 1]].map((c, i) => (
        <text
          key={i}
          x={c.x}
          y={H - 4}
          textAnchor={i === 0 ? 'start' : 'end'}
          fontSize="9"
          fill="var(--color-text-faint)"
          fontFamily="var(--font-body)"
        >
          {c.label}
        </text>
      ))}
    </svg>
  );
}

// ─── Session row ─────────────────────────────────────────────────

function SessionRow({
  session,
  sets,
  isBodyweight,
  isTimed,
}: {
  session: WorkoutSession;
  sets: LoggedSet[];
  isBodyweight: boolean;
  isTimed: boolean;
}) {
  const workSets = sets.filter((s) => !s.isWarmup);
  const best = isBodyweight ? topReps(sets) : topSet(sets);
  const hasPR = workSets.some((s) => s.isPR);

  return (
    <div
      className="flex items-center justify-between py-3"
      style={{ borderBottom: 'var(--border-thin)' }}
    >
      <div>
        <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
          {formatShortDate(session.startedAt)}
          {hasPR && (
            <Trophy
              size={12}
              weight="fill"
              style={{ display: 'inline', marginLeft: '0.4rem', color: 'var(--color-accent)', verticalAlign: 'middle' }}
            />
          )}
        </p>
        <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
          {workSets.length} work set{workSets.length !== 1 ? 's' : ''}
        </p>
      </div>

      {best && (
        <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
          {isTimed
            ? `${best.reps}s`
            : isBodyweight
              ? `${best.reps} reps`
              : `${best.weightKg}kg × ${best.reps}`}
        </p>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────

export default function ExerciseDetail() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();

  const allExercises = useExercises();
  const allStretchExercises = useStretches();
  const exercise = [...allExercises, ...allStretchExercises].find((e) => e.id === exerciseId);

  type DetailData = {
    allSets: LoggedSet[];
    sessions: WorkoutSession[];
    bySession: Map<string, LoggedSet[]>;
  };
  const [data, setData] = useState<DetailData | null | undefined>(undefined);

  useEffect(() => {
    if (!exerciseId) { setData(null); return; }
    const user = getLocalSession();
    if (!user) { setData({ allSets: [], sessions: [], bySession: new Map() }); return; }

    const load = async () => {
      const { data: setRows } = await supabase
        .from('logged_sets')
        .select('*')
        .eq('user_id', user.id)
        .eq('exercise_id', exerciseId)
        .order('completed_at');

      if (!setRows || setRows.length === 0) {
        setData({ allSets: [], sessions: [], bySession: new Map() });
        return;
      }

      const allSets: LoggedSet[] = setRows.map((r) => ({
        id:          r.id as string,
        sessionId:   r.session_id as string,
        exerciseId:  r.exercise_id as string,
        setNumber:   r.set_number as number,
        weightKg:    r.weight_kg as number,
        reps:        r.reps as number,
        rir:         r.rir as number,
        isWarmup:    r.is_warmup as boolean,
        isPR:        r.is_pr as boolean,
        completedAt: r.completed_at as number,
      }));

      const bySession = new Map<string, LoggedSet[]>();
      for (const s of allSets) {
        const arr = bySession.get(s.sessionId) ?? [];
        arr.push(s);
        bySession.set(s.sessionId, arr);
      }

      const sessionIds = [...bySession.keys()];
      const { data: sessionRows } = await supabase
        .from('workout_sessions')
        .select('*')
        .in('id', sessionIds)
        .not('completed_at', 'is', null);

      const sessions: WorkoutSession[] = (sessionRows ?? [])
        .map((r) => ({
          id:              r.id as string,
          templateId:      r.template_id as string,
          startedAt:       r.started_at as number,
          completedAt:     r.completed_at as number | undefined,
          durationSeconds: r.duration_seconds as number | undefined,
          notes:           r.notes as string | undefined,
        }))
        .sort((a, b) => a.startedAt - b.startedAt);

      setData({ allSets, sessions, bySession });
    };

    void load();
  }, [exerciseId]);

  if (!exercise) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center gap-4 px-4 py-16">
          <p style={{ color: 'var(--color-text-muted)' }}>Exercise not found.</p>
          <button onClick={() => navigate(-1)} style={{ color: 'var(--color-accent)', fontSize: 'var(--text-meta)' }}>
            ← Back
          </button>
        </div>
      </PageShell>
    );
  }

  const loading = data === undefined;
  const allSets = data?.allSets ?? [];
  const sessions = data?.sessions ?? [];
  const bySession = data?.bySession ?? new Map<string, LoggedSet[]>();
  const isBodyweight = exercise.isBodyweight;

  // PR across all history
  const prSet = isBodyweight ? topReps(allSets) : topSet(allSets);
  const prSession = prSet ? sessions.find((s) => s.id === prSet.sessionId) : null;
  const oneRM = prSet && !isBodyweight
    ? estimatedOneRM(prSet.weightKg, prSet.reps)
    : null;

  // Chart data: top value per session, chronological
  const chartPoints: ChartPoint[] = sessions.flatMap((s) => {
    const sets = bySession.get(s.id) ?? [];
    const best = isBodyweight ? topReps(sets) : topSet(sets);
    if (!best) return [];
    return [{
      label: formatShortDate(s.startedAt),
      value: isBodyweight ? best.reps : best.weightKg,
    }];
  });

  const sessionsDesc = [...sessions].reverse();

  return (
    <PageShell>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 sticky top-0 z-40"
        style={{
          height: 'var(--header-height)',
          borderBottom: 'var(--border-thin)',
          background: 'var(--color-bg)',
        }}
      >
        <button onClick={() => navigate(-1)} style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft size={22} />
        </button>
        <h1
          className="font-display flex-1 min-w-0 truncate"
          style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)', letterSpacing: '0.02em' }}
        >
          {exercise.name.toUpperCase()}
        </h1>
        <button
          onClick={() => navigate(`/exercise/${exercise.id}/edit`)}
          style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}
          aria-label="Edit exercise"
        >
          <PencilSimple size={20} />
        </button>
      </header>

      <main className="px-4 pb-8">

        {/* Badges */}
        <div className="flex flex-wrap gap-2 py-4" style={{ borderBottom: 'var(--border-thin)' }}>
          {[exercise.category, exercise.type, ...exercise.muscles].map((tag) => (
            <span
              key={tag}
              className="font-body uppercase tracking-widest px-2 py-0.5"
              style={{
                fontSize: 'var(--text-micro)',
                color: 'var(--color-text-muted)',
                border: 'var(--border-thin)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Default rep range + rest */}
        <div className="flex gap-6 py-4" style={{ borderBottom: 'var(--border-thin)' }}>
          <div>
            <p className="font-body uppercase tracking-widest mb-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
              {exercise.isTimed ? 'Default seconds' : 'Default reps'}
            </p>
            <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
              {exercise.defaultRepRange[0]}–{exercise.defaultRepRange[1]}{exercise.isTimed ? 's' : ''}
            </p>
          </div>
          <div>
            <p className="font-body uppercase tracking-widest mb-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
              Rest
            </p>
            <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
              {exercise.restSeconds}s
            </p>
          </div>
          {!isBodyweight && (
            <div>
              <p className="font-body uppercase tracking-widest mb-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
                Starting weight
              </p>
              <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                {exercise.startingWeightKg}kg
              </p>
            </div>
          )}
        </div>

        {/* Notes */}
        {exercise.notes && (
          <div className="py-4" style={{ borderBottom: 'var(--border-thin)' }}>
            <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              {exercise.notes}
            </p>
          </div>
        )}

        {/* Personal best */}
        {!loading && prSet && (
          <div className="py-5" style={{ borderBottom: 'var(--border-thin)' }}>
            <p
              className="font-body uppercase tracking-widest mb-2"
              style={{ fontSize: 'var(--text-micro)', color: 'var(--color-accent)' }}
            >
              Personal Best
            </p>
            <p className="font-mono" data-numeric style={{ fontSize: 'clamp(1.75rem, 7vw, 2.5rem)', color: 'var(--color-text)', lineHeight: 1 }}>
              {exercise.isTimed
                ? `${prSet.reps}s`
                : isBodyweight
                  ? `${prSet.reps} reps`
                  : `${prSet.weightKg}kg × ${prSet.reps}`}
            </p>
            <div className="flex items-center gap-3 mt-2">
              {prSession && (
                <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
                  {formatDate(prSession.startedAt)}
                </p>
              )}
              {oneRM && (
                <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
                  · Est. 1RM: <span className="font-mono" data-numeric>{oneRM}kg</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Progress chart */}
        {!loading && chartPoints.length >= 2 && (
          <div className="py-5" style={{ borderBottom: 'var(--border-thin)' }}>
            <p
              className="font-body uppercase tracking-widest mb-3"
              style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
            >
              {exercise.isTimed ? 'Best Time' : isBodyweight ? 'Best Reps' : 'Top Weight'} per Session
            </p>
            <LineChart points={chartPoints} />
          </div>
        )}

        {/* Session history */}
        <div className="pt-4">
          <p
            className="font-body uppercase tracking-widest mb-1"
            style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
          >
            Session History
          </p>

          {loading && (
            <div style={{ opacity: 0.4 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="py-3" style={{ borderBottom: 'var(--border-thin)' }}>
                  <div style={{ height: '1rem', width: '5rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', marginBottom: '0.4rem' }} />
                  <div style={{ height: '0.75rem', width: '3rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }} />
                </div>
              ))}
            </div>
          )}

          {!loading && sessionsDesc.length === 0 && (
            <div className="pt-8">
              <EmptyState
                icon={<Trophy size={28} />}
                title="No history yet"
                description="Log this exercise in a workout to see your progress here."
              />
            </div>
          )}

          {!loading && sessionsDesc.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              sets={bySession.get(session.id) ?? []}
              isBodyweight={isBodyweight}
              isTimed={exercise.isTimed ?? false}
            />
          ))}
        </div>
      </main>
    </PageShell>
  );
}
