import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { WarmupChecklist } from '@/components/workout/WarmupChecklist';
import { StretchChecklist } from '@/components/workout/StretchChecklist';
import { useTemplate } from '@/hooks/useTemplates';
import { templateMap as defaultTemplateMap } from '@/data/templates';
import type { ExerciseCategory } from '@/types';

type WorkoutPhase = 'warmup' | 'workout' | 'stretching';

export default function WorkoutActive() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<WorkoutPhase>('warmup');

  // Live from Dexie — falls back to static map while DB loads
  const liveTemplate = useTemplate(templateId ?? '');
  const template = liveTemplate ?? (templateId ? defaultTemplateMap.get(templateId) : undefined);

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

  if (phase === 'warmup') {
    return (
      <WarmupChecklist
        category={template.category as ExerciseCategory}
        onStart={() => setPhase('workout')}
      />
    );
  }

  if (phase === 'stretching') {
    return (
      <StretchChecklist
        onFinish={() => navigate('/')}
      />
    );
  }

  // workout phase — stub until SetLogger is built
  return (
    <PageShell withNav={false}>
      <div className="flex flex-col items-center justify-center min-h-dvh gap-6 px-4">
        <span
          className="font-display"
          style={{ fontSize: 'clamp(3rem, 15vw, 6rem)', color: 'var(--color-text)' }}
        >
          {template.shortLabel}
        </span>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>
          {template.exercises.length} exercises · Logging coming soon
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => setPhase('stretching')}
            className="w-full py-4 font-display uppercase tracking-wide"
            style={{
              fontSize: 'var(--text-h2)',
              background: 'var(--color-accent)',
              color: '#fff',
              borderRadius: 'var(--radius-md)',
              border: 'none',
            }}
          >
            Finish Workout →
          </button>
          <button
            onClick={() => navigate('/')}
            style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}
          >
            ← Abandon
          </button>
        </div>
      </div>
    </PageShell>
  );
}
