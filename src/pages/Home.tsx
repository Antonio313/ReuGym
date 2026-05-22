import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PencilSimple } from '@phosphor-icons/react';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { useTemplates } from '@/hooks/useTemplates';
import { supabase } from '@/lib/supabase';
import { getLocalSession } from '@/lib/auth';
import type { WorkoutTemplate } from '@/types';

const DAY_LABEL_ORDER = ['push', 'pull', 'legs', 'core', 'glutes', 'back'] as const;

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

function formatToday(): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

type DayCardProps = {
  template: WorkoutTemplate;
  lastSessionDate?: number;
};

function DayCard({ template, lastSessionDate }: DayCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="relative flex flex-col gap-2 p-4"
      style={{
        background: 'var(--color-surface)',
        border: 'var(--border-medium)',
        borderRadius: 'var(--radius-md)',
        minHeight: '9rem',
      }}
    >
      {/* Edit icon */}
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/template/${template.id}/edit`); }}
        className="absolute top-3 right-3"
        style={{ color: 'var(--color-text-faint)' }}
        aria-label={`Edit ${template.name}`}
      >
        <PencilSimple size={16} />
      </button>

      {/* Day label */}
      <span
        className="font-display leading-none"
        style={{
          fontSize: 'clamp(2rem, 8vw, 3rem)',
          color: 'var(--color-text)',
          letterSpacing: '-0.01em',
        }}
      >
        {template.shortLabel}
      </span>

      {/* Exercise count */}
      <span
        className="font-body"
        style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
      >
        {template.exercises.length} exercises
      </span>

      {/* Last session */}
      <span
        className="font-body"
        style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)' }}
      >
        {lastSessionDate ? `Last: ${formatDate(lastSessionDate)}` : 'Never done'}
      </span>

      {/* Start button */}
      <button
        onClick={() => navigate(`/workout/${template.id}`)}
        className="mt-auto self-start font-body font-medium"
        style={{
          fontSize: 'var(--text-meta)',
          color: 'var(--color-accent)',
          border: '1px solid var(--color-accent)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.35rem 0.85rem',
          background: 'transparent',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Start
      </button>
    </div>
  );
}

export default function Home() {
  const isSunday = new Date().getDay() === 0;
  const navigate = useNavigate();

  const templates = useTemplates();

  const [lastSessions, setLastSessions] = useState<Record<string, number>>({});

  useEffect(() => {
    const user = getLocalSession();
    if (!user) return;
    supabase
      .from('workout_sessions')
      .select('template_id, completed_at')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .order('started_at', { ascending: false })
      .then(({ data }) => {
        const results: Record<string, number> = {};
        for (const row of data ?? []) {
          const tId = row.template_id as string;
          if (!results[tId]) results[tId] = row.completed_at as number;
        }
        setLastSessions(results);
      });
  }, []);

  const orderedTemplates = DAY_LABEL_ORDER
    .map((cat) => templates.find((t) => t.category === cat))
    .filter((t): t is WorkoutTemplate => t !== undefined);

  return (
    <PageShell>
      <Header subtitle={formatToday()} />

      <main className="flex flex-col gap-3 p-4">
        {/* Day cards grid */}
        <div className="grid grid-cols-2 gap-3">
          {orderedTemplates.map((template) => (
            <DayCard
              key={template.id}
              template={template}
              lastSessionDate={lastSessions[template.id]}
            />
          ))}
        </div>

        {/* Sunday body stats CTA */}
        {isSunday && (
          <button
            onClick={() => navigate('/stats')}
            className="w-full py-3 font-body font-medium"
            style={{
              fontSize: 'var(--text-meta)',
              color: 'var(--color-text-muted)',
              border: 'var(--border-thin)',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              letterSpacing: '0.02em',
            }}
          >
            Log today's body stats →
          </button>
        )}
      </main>
    </PageShell>
  );
}
