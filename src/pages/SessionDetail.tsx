import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trophy } from '@phosphor-icons/react';
import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { PRBadge } from '@/components/workout/PRBadge';
import { getLocalSession } from '@/lib/auth';
import { getDB } from '@/data/db';
import { useExercises, useStretches } from '@/hooks/useExercises';
import { useTemplates } from '@/hooks/useTemplates';
import { useUnit } from '@/hooks/useUnit';
import { templateMap as defaultTemplateMap } from '@/data/templates';
import type { LoggedSet, WorkoutSession } from '@/types';

// ─── Helpers ────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDate(ts: number): string {
  return dateFormatter.format(new Date(ts));
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Exercise group ─────────────────────────────────────────────

function ExerciseGroup({
  exerciseId,
  exerciseName,
  sets,
  isBodyweight,
  isTimed,
}: {
  exerciseId: string;
  exerciseName: string;
  sets: LoggedSet[];
  isBodyweight: boolean;
  isTimed: boolean;
}) {
  const { unit, toDisplay } = useUnit();
  const sorted = [...sets].sort((a, b) => a.setNumber - b.setNumber);

  return (
    <div className="py-4" style={{ borderBottom: 'var(--border-thin)' }}>
      <Link
        to={`/exercise/${exerciseId}`}
        className="font-body font-medium block mb-3"
        style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}
      >
        {exerciseName}
      </Link>

      <div className="flex flex-col gap-2">
        {sorted.map((set) => (
          <div key={set.id} className="flex items-center gap-3">
            <span
              className="font-mono"
              data-numeric
              style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)', width: '1.25rem' }}
            >
              {set.setNumber}
            </span>
            <span
              className="font-mono flex-1"
              data-numeric
              style={{
                fontSize: 'var(--text-body)',
                color: set.isWarmup ? 'var(--color-text-muted)' : 'var(--color-text)',
              }}
            >
              {isTimed
                ? `${set.reps}s`
                : isBodyweight
                  ? `${set.reps} reps`
                  : `${toDisplay(set.weightKg)}${unit} × ${set.reps}`}
            </span>
            {set.isWarmup && (
              <span
                className="font-body uppercase tracking-widest"
                style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-faint)' }}
              >
                Warm-up
              </span>
            )}
            {!set.isWarmup && (
              <span
                className="font-body uppercase tracking-widest"
                style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
              >
                {isTimed ? 'SIR' : 'RIR'} {set.rir}
              </span>
            )}
            <PRBadge show={set.isPR} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────

export default function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const allExercises = useExercises();
  const allStretchExercises = useStretches();
  const exerciseMap = new Map([...allExercises, ...allStretchExercises].map((e) => [e.id, e]));

  const liveTemplates = useTemplates() ?? [];
  const liveTemplateMap = new Map(liveTemplates.map((t) => [t.id, t]));
  const getTemplateLabel = (templateId: string): string => {
    const live = liveTemplateMap.get(templateId);
    if (live) return live.shortLabel;
    return defaultTemplateMap.get(templateId)?.shortLabel ?? templateId.toUpperCase();
  };

  type Data = {
    session: WorkoutSession;
    byExercise: Map<string, LoggedSet[]>;
    exerciseOrder: string[];
    workSetCount: number;
    prCount: number;
  };
  const [data, setData] = useState<Data | null | undefined>(undefined);

  useEffect(() => {
    if (!sessionId) { setData(null); return; }
    const user = getLocalSession();
    if (!user) { setData(null); return; }

    const load = async () => {
      const db = getDB(user.id);
      const row = await db.sessions.get(sessionId);
      if (!row || row.userId !== user.id) { setData(null); return; }

      const session: WorkoutSession = {
        id:              row.id,
        templateId:      row.templateId,
        startedAt:       row.startedAt,
        completedAt:     row.completedAt,
        durationSeconds: row.durationSeconds,
        notes:           row.notes,
      };

      const setRows = await db.sets
        .where('[userId+sessionId]')
        .equals([user.id, sessionId])
        .toArray();
      setRows.sort((a, b) => a.completedAt - b.completedAt);

      const byExercise = new Map<string, LoggedSet[]>();
      const exerciseOrder: string[] = [];
      let workSetCount = 0;
      let prCount = 0;

      for (const r of setRows) {
        const set: LoggedSet = {
          id:          r.id,
          sessionId:   r.sessionId,
          exerciseId:  r.exerciseId,
          setNumber:   r.setNumber,
          weightKg:    r.weightKg,
          reps:        r.reps,
          rir:         r.rir,
          isWarmup:    r.isWarmup,
          isPR:        r.isPR,
          completedAt: r.completedAt,
        };
        if (!byExercise.has(r.exerciseId)) {
          byExercise.set(r.exerciseId, []);
          exerciseOrder.push(r.exerciseId);
        }
        byExercise.get(r.exerciseId)!.push(set);

        if (!set.isWarmup) {
          workSetCount += 1;
          if (set.isPR) prCount += 1;
        }
      }

      setData({ session, byExercise, exerciseOrder, workSetCount, prCount });
    };

    void load();
  }, [sessionId]);

  const loading = data === undefined;
  const notFound = data === null;

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
          {data ? getTemplateLabel(data.session.templateId) : 'SESSION'}
        </h1>
      </header>

      <main className="px-4 pb-8">
        {loading && (
          <div className="py-16 text-center">
            <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
          </div>
        )}

        {notFound && (
          <div className="pt-16">
            <EmptyState
              icon={<Trophy size={32} />}
              title="Session not found"
              description="This workout session couldn't be loaded."
            />
          </div>
        )}

        {data && (
          <>
            {/* Date + duration */}
            <div className="py-4" style={{ borderBottom: 'var(--border-thin)' }}>
              <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
                {formatDate(data.session.startedAt)}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <span className="font-mono" data-numeric style={{ fontSize: 'var(--text-h1)', color: 'var(--color-text)' }}>
                  {data.workSetCount} sets
                </span>
                {data.prCount > 0 && (
                  <span
                    className="flex items-center gap-1 font-body"
                    style={{ fontSize: 'var(--text-body)', color: 'var(--color-accent)' }}
                  >
                    <Trophy size={15} weight="fill" />
                    {data.prCount} PR{data.prCount > 1 ? 's' : ''}
                  </span>
                )}
                {data.session.durationSeconds != null && (
                  <span className="font-mono" data-numeric style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
                    {formatDuration(data.session.durationSeconds)}
                  </span>
                )}
              </div>
            </div>

            {/* Notes */}
            {data.session.notes && (
              <div className="py-4" style={{ borderBottom: 'var(--border-thin)' }}>
                <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  {data.session.notes}
                </p>
              </div>
            )}

            {/* Exercises */}
            {data.exerciseOrder.map((exerciseId) => {
              const exercise = exerciseMap.get(exerciseId);
              const sets = data.byExercise.get(exerciseId) ?? [];
              return (
                <ExerciseGroup
                  key={exerciseId}
                  exerciseId={exerciseId}
                  exerciseName={exercise?.name ?? exerciseId}
                  sets={sets}
                  isBodyweight={exercise?.isBodyweight ?? false}
                  isTimed={exercise?.isTimed ?? false}
                />
              );
            })}
          </>
        )}
      </main>
    </PageShell>
  );
}
