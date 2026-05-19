import { useParams, useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { Header } from '@/components/layout/Header';
import { exerciseMap } from '@/data/exercises';

export default function ExerciseDetail() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const exercise = exerciseId ? exerciseMap.get(exerciseId) : undefined;

  if (!exercise) {
    return (
      <PageShell>
        <Header />
        <div className="flex flex-col items-center justify-center gap-4 px-4 py-16">
          <p style={{ color: 'var(--color-text-muted)' }}>Exercise not found.</p>
          <button
            onClick={() => navigate(-1)}
            style={{ color: 'var(--color-accent)', fontSize: 'var(--text-meta)' }}
          >
            ← Back
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Header />
      <main className="px-4 pt-4">
        <h1
          className="font-display mb-1"
          style={{ fontSize: 'var(--text-h1)', color: 'var(--color-text)' }}
        >
          {exercise.name}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>
          Progress charts coming soon
        </p>
      </main>
    </PageShell>
  );
}
