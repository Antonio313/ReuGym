import { useState, useEffect } from 'react';
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

const FEELING_STEPS: Record<FeelingLevel, number> = {
  'easy':              2,
  'medium-easy':       1,
  'fair':              0,
  'fairly-difficult': -1,
  'difficult':        -2,
};

function getWeightIncrement(exercise: Exercise): number {
  if (exercise.type === 'plyo' || exercise.type === 'isometric' || exercise.isBodyweight) return 0;
  return exercise.type === 'compound' ? 5 : 2.5;
}

function getRepIncrement(exercise: Exercise): number {
  if (exercise.type === 'plyo' || exercise.type === 'isometric' || exercise.isBodyweight) return 2;
  return 0;
}

function getWeightAdjustment(level: FeelingLevel, exercise: Exercise): number {
  const inc = getWeightIncrement(exercise);
  if (inc === 0) return 0;
  return FEELING_STEPS[level] * inc;
}

function getRepAdjustment(level: FeelingLevel, exercise: Exercise): number {
  const inc = getRepIncrement(exercise);
  if (inc === 0) return 0;
  return FEELING_STEPS[level] * inc;
}

type Props = {
  exercise: Exercise;
  currentStartingWeightKg: number;
  currentStartingReps: number;
  sessionId: string;
  onDone: () => void;
};

type RirSuggestion = {
  type: 'weight';
  value: number;
  delta: number;
} | {
  type: 'reps';
  value: number;
  delta: number;
} | null;

export function FeelingMeter({ exercise, currentStartingWeightKg, currentStartingReps, sessionId, onDone }: Props) {
  const [selected, setSelected] = useState<FeelingLevel | null>(null);
  const [saving, setSaving] = useState(false);
  const [rirSuggestion, setRirSuggestion] = useState<RirSuggestion>(null);

  useEffect(() => {
    db.sets
      .where('sessionId').equals(sessionId)
      .filter(s => s.exerciseId === exercise.id && !s.isWarmup)
      .toArray()
      .then(workSets => {
        if (workSets.length < 2) return;
        const avgRIR = workSets.reduce((sum, s) => sum + s.rir, 0) / workSets.length;
        const delta = avgRIR - 2;
        if (Math.abs(delta) < 0.5) return;

        if (getWeightIncrement(exercise) > 0) {
          const inc = getWeightIncrement(exercise);
          const change = Math.round(delta / (inc / inc)) * inc;
          const suggestion = Math.max(0, +(currentStartingWeightKg + change).toFixed(2));
          setRirSuggestion({ type: 'weight', value: suggestion, delta: change });
        } else if (getRepIncrement(exercise) > 0) {
          const change = Math.round(delta * 2);
          const suggestion = Math.max(1, currentStartingReps + change);
          setRirSuggestion({ type: 'reps', value: suggestion, delta: change });
        }
      })
      .catch(() => {});
  }, [sessionId, exercise.id, currentStartingWeightKg, currentStartingReps, exercise]);

  const weightInc = getWeightIncrement(exercise);
  const repInc = getRepIncrement(exercise);

  const weightAdj = selected ? getWeightAdjustment(selected, exercise) : 0;
  const repAdj = selected ? getRepAdjustment(selected, exercise) : 0;
  const suggestedWeight = Math.max(0, +(currentStartingWeightKg + weightAdj).toFixed(2));
  const suggestedReps = Math.max(1, currentStartingReps + repAdj);

  const hasWeightSuggestion = selected !== null && selected !== 'fair' && weightInc > 0;
  const hasRepSuggestion = selected !== null && selected !== 'fair' && repInc > 0;
  const hasSuggestion = hasWeightSuggestion || hasRepSuggestion;

  const handleAcceptSubjective = async () => {
    if (selected === null) return;
    setSaving(true);
    if (weightInc > 0) {
      await db.exercisePrefs.put({ exerciseId: exercise.id, startingWeightKg: suggestedWeight });
    } else {
      await db.exercisePrefs.put({ exerciseId: exercise.id, startingWeightKg: currentStartingWeightKg, startingReps: suggestedReps });
    }
    setSaving(false);
    onDone();
  };

  const handleAcceptRir = async () => {
    if (!rirSuggestion) return;
    setSaving(true);
    if (rirSuggestion.type === 'weight') {
      await db.exercisePrefs.put({ exerciseId: exercise.id, startingWeightKg: rirSuggestion.value });
    } else {
      await db.exercisePrefs.put({ exerciseId: exercise.id, startingWeightKg: currentStartingWeightKg, startingReps: rirSuggestion.value });
    }
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

      {/* Subjective suggestion */}
      {hasSuggestion && selected !== null && (
        <div
          className="flex flex-col gap-3 px-4 py-4"
          style={{
            background: 'var(--color-surface)',
            border: 'var(--border-thin)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
            Based on how it felt
          </p>
          {hasWeightSuggestion && (
            <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
              Suggested starting weight:{' '}
              <span className="font-mono" data-numeric style={{ color: 'var(--color-accent)' }}>
                {suggestedWeight}{exercise.isCable ? ' hole' : ' kg'}
              </span>
              {' '}
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>
                ({weightAdj > 0 ? '+' : ''}{weightAdj}{exercise.isCable ? ' hole' : ' kg'})
              </span>
            </p>
          )}
          {hasRepSuggestion && (
            <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
              Suggested starting reps:{' '}
              <span className="font-mono" data-numeric style={{ color: 'var(--color-accent)' }}>
                {suggestedReps} reps
              </span>
              {' '}
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>
                ({repAdj > 0 ? '+' : ''}{repAdj})
              </span>
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAcceptSubjective}
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
              {saving ? 'Saving…' : hasWeightSuggestion ? 'Update Starting Weight' : 'Update Starting Reps'}
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

      {/* RIR-based suggestion */}
      {rirSuggestion && (
        <div
          className="flex flex-col gap-3 px-4 py-4"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-hover)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
            Based on avg RIR this session
          </p>
          <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
            {rirSuggestion.type === 'weight' ? 'Suggested starting weight' : 'Suggested starting reps'}:{' '}
            <span className="font-mono" data-numeric style={{ color: 'var(--color-text)' }}>
              {rirSuggestion.type === 'weight'
                ? `${rirSuggestion.value}${exercise.isCable ? ' hole' : ' kg'}`
                : `${rirSuggestion.value} reps`}
            </span>
            {' '}
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>
              ({rirSuggestion.delta > 0 ? '+' : ''}{rirSuggestion.delta}{rirSuggestion.type === 'weight' && !exercise.isCable ? ' kg' : ''})
            </span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleAcceptRir}
              disabled={saving}
              className="flex-1 py-3 font-body"
              style={{
                fontSize: 'var(--text-meta)',
                background: 'var(--color-surface-2)',
                color: 'var(--color-text)',
                borderRadius: 'var(--radius-md)',
                border: 'var(--border-thin)',
              }}
            >
              {saving ? 'Saving…' : 'Use This'}
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

      {/* Continue when no suggestion (fair, or no changes needed) */}
      {selected !== null && !hasSuggestion && (
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
