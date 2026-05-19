import { useParams, useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { templateMap } from '@/data/templates';

export default function WorkoutActive() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const template = templateId ? templateMap.get(templateId) : undefined;

  if (!template) {
    return (
      <PageShell withNav={false}>
        <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
          <p style={{ color: 'var(--color-text-muted)' }}>Template not found.</p>
          <button
            onClick={() => navigate('/')}
            style={{ color: 'var(--color-accent)', fontSize: 'var(--text-meta)' }}
          >
            ← Back home
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell withNav={false}>
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4 px-4">
        <span
          className="font-display"
          style={{ fontSize: 'clamp(3rem, 15vw, 6rem)', color: 'var(--color-text)' }}
        >
          {template.shortLabel}
        </span>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>
          Workout logging coming soon
        </p>
        <button
          onClick={() => navigate('/')}
          style={{ color: 'var(--color-accent)', fontSize: 'var(--text-meta)' }}
        >
          ← Back home
        </button>
      </div>
    </PageShell>
  );
}
