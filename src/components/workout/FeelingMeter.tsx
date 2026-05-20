import { useState } from 'react';
import { db } from '@/data/db';
import type { Exercise } from '@/types';

type FeelingLevel = 'easy' | 'medium-easy' | 'fair' | 'fairly-difficult' | 'difficult';

const LEVELS: { id: FeelingLevel; label: string }[] = [
  { id: 'easy',             label: 'Easy' },
  { id: 'medium-easy',      label: 'Medium Easy' },
  { id: 'fair',             label: 'Fair' },
  { id: 'fairly-difficult', label: 'Fairly Difficult' },
  { id: 'difficult',        label: 'Difficult' },
];

function getIncrement(exercise: Exercise): number {
  if (exercise.type === 'plyo' || exercise.type === 'isometric' || exercise.isBodyweight) return 0;
  return exercise.type === 'compound' ? 5 : 2.5;
}

function getAdjustment(level: FeelingLevel, exercise: Exercise): number {
  const inc = getIncrement(exercise);
  if (inc === 0) return 0;
  const steps: Record<FeelingLevel, number> = {
    'easy':             2,
    'medium-easy':      1,
    'fair':             0,
    'fairly-difficult': -1,
    'difficult':        -2,
  };
  return steps[level] * inc;
}

type Props = {
  exercise: Exercise;
  currentStartingWeightKg: number;
  onDone: () => void;
};

export function FeelingMeter({ exercise, currentStartingWeightKg, onDone }: Props) {
  const [selected, setSelected] = useState<FeelingLevel | null>(null);
  const [saving, setSaving] = useState(false);

  const adjustment = selected ? getAdjustment(selected, exercise) : 0;
  const suggestedWeight = Math.max(0, +(currentStartingWeightKg + adjustment).toFixed(2));
  const hasWeightSuggestion = selected !== null && selected !== 'fair' && getIncrement(exercise) > 0;

  const handleAccept = async () => {
    if (selected === null) return;
    setSaving(true);
    await db.exercisePrefs.put({ exerciseId: exercise.id, startingWeightKg: suggestedWeight });
    setSaving(false);
    onDone();
  };

  return (
    <div
      className="flex flex-col min-h-dvh mx-auto px-4 py-6 gap-6"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}
    >
      {/* Header */}
      <div>
        <p
          className="font-body uppercase tracking-widest mb-1"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          How did that feel?
        </p>
        <h2
          className="font-display leading-tight"
          style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', color: 'var(--color-text)', letterSpacing: '0.02em' }}
        >
          {exercise.name.toUpperCase()}
        </h2>
      </div>

      {/* Feeling buttons */}
      <div className="flex flex-col gap-2">
        {LEVELS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSelected(id)}
            className="w-full py-4 font-body text-left px-4"
            style={{
              borderRadius: 'var(--radius-md)',
              border: selected === id
                ? '1px solid var(--color-accent)'
                : 'var(--border-thin)',
              background: selected === id ? 'var(--color-accent-dim)' : 'var(--color-surface)',
              color: selected === id ? 'var(--color-accent)' : 'var(--color-text)',
              fontSize: 'var(--text-body)',
              transition: 'border 120ms, background 120ms',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Weight suggestion */}
      {hasWeightSuggestion && selected !== null && (
        <div
          className="flex flex-col gap-3 px-4 py-4"
          style={{
            background: 'var(--color-surface)',
            border: 'var(--border-thin)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
            Suggested starting weight:{' '}
            <span className="font-mono" data-numeric style={{ color: 'var(--color-accent)' }}>
              {suggestedWeight}{exercise.isCable ? ' hole' : ' kg'}
            </span>
            {' '}
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>
              ({adjustment > 0 ? '+' : ''}{adjustment}{exercise.isCable ? ' hole' : ' kg'})
            </span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              disabled={saving}
              className="flex-1 py-3 font-display uppercase tracking-wide"
              style={{
                fontSize: 'var(--text-meta)',
                background: 'var(--color-accent)',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                letterSpacing: '0.05em',
              }}
            >
              {saving ? 'Saving…' : 'Update Starting Weight'}
            </button>
            <button
              onClick={onDone}
              className="px-4 py-3 font-body"
              style={{
                fontSize: 'var(--text-meta)',
                color: 'var(--color-text-muted)',
                border: 'var(--border-thin)',
                borderRadius: 'var(--radius-md)',
                background: 'transparent',
              }}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Continue button when no weight suggestion (fair, or plyo/isometric/bodyweight) */}
      {selected !== null && !hasWeightSuggestion && (
        <button
          type="button"
          onClick={onDone}
          className="w-full py-4 font-display uppercase tracking-wide"
          style={{
            fontSize: 'var(--text-h2)',
            background: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            letterSpacing: '0.05em',
          }}
        >
          Continue
        </button>
      )}

      {/* Skip entirely */}
      <button
        type="button"
        onClick={onDone}
        className="font-body"
        style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)', alignSelf: 'center' }}
      >
        Skip rating
      </button>
    </div>
  );
}
