import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { templates } from '@/data/templates';
import { db } from '@/data/db';
import type { WorkoutTemplate } from '@/types';

const DAY_LABEL_ORDER = ['push', 'pull', 'legs', 'core'] as const;

const CARD_COLORS: Record<string, string> = {
  push: '#FF4D00',
  pull: '#FF4D00',
  legs: '#FF4D00',
  core: '#FF4D00',
};

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
        className="mt-auto self-start font-body font-medium transition-colors"
        style={{
          fontSize: 'var(--text-meta)',
          color: CARD_COLORS[template.category],
          border: `1px solid ${CARD_COLORS[template.category]}`,
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

  const lastSessions = useLiveQuery(async () => {
    const results: Record<string, number> = {};
    for (const template of templates) {
      const session = await db.sessions
        .where('templateId')
        .equals(template.id)
        .and((s) => s.completedAt !== undefined)
        .last();
      if (session?.completedAt) {
        results[template.id] = session.completedAt;
      }
    }
    return results;
  }, []);

  const orderedTemplates = DAY_LABEL_ORDER
    .map((cat) => templates.find((t) => t.category === cat))
    .filter((t): t is WorkoutTemplate => t !== undefined);

  return (
    <PageShell>
      <Header
        subtitle={formatToday()}
      />

      <main className="flex flex-col gap-3 p-4">
        {/* Day cards grid */}
        <div className="grid grid-cols-2 gap-3">
          {orderedTemplates.map((template) => (
            <DayCard
              key={template.id}
              template={template}
              lastSessionDate={lastSessions?.[template.id]}
            />
          ))}
        </div>

        {/* Sunday body stats CTA */}
        {isSunday && (
          <button
            onClick={() => navigate('/stats')}
            className="w-full py-3 font-body font-medium transition-colors"
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
