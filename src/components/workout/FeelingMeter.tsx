import { useState, useEffect } from 'react';
import { db } from '@/data/db';
import type { Exercise, ExercisePref } from '@/types';

type FeelingLevel = 'easy' | 'medium-easy' | 'fair' | 'fairly-difficult' | 'difficult';
type SaveMode = 'weight' | 'reps' | 'both';

const LEVELS: { id: FeelingLevel; label: string }[] = [
  { id: 'easy',             label: 'Easy' },
  { id: 'medium-easy',      label: 'Fairly Easy' },
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

// Reps per feeling step: 2 for bodyweight, 1 for weighted
function getRepStepSize(exercise: Exercise): number {
  return exercise.isBodyweight || exercise.type === 'plyo' || exercise.type === 'isometric' ? 2 : 1;
}

type Props = {
  exercise: Exercise;
  currentStartingWeightKg: number;
  currentStartingReps: number;
  sessionId: string;
  onDone: () => void;
};

export function FeelingMeter({ exercise, currentStartingWeightKg, currentStartingReps, sessionId, onDone }: Props) {
  const [selected, setSelected] = useState<FeelingLevel | null>(null);
  const [saving, setSaving] = useState(false);
  const [avgRIR, setAvgRIR] = useState<number | null>(null);

  useEffect(() => {
    db.sets
      .where('sessionId').equals(sessionId)
      .filter((s) => s.exerciseId === exercise.id && !s.isWarmup)
      .toArray()
      .then((workSets) => {
        if (workSets.length < 2) return;
        setAvgRIR(workSets.reduce((sum, s) => sum + s.rir, 0) / workSets.length);
      })
      .catch(() => {});
  }, [sessionId, exercise.id]);

  const weightInc  = getWeightIncrement(exercise);
  const repStep    = getRepStepSize(exercise);
  const isWeighted = weightInc > 0;

  const isEasySelection  = selected === 'easy' || selected === 'medium-easy';
  const rirConditionMet  = !exercise.isTimed && isEasySelection && avgRIR != null && avgRIR > 2;

  // Weight: from feeling only
  const weightDelta    = selected ? FEELING_STEPS[selected] * weightInc : 0;
  const suggestedWeight = Math.max(0, +(currentStartingWeightKg + weightDelta).toFixed(2));

  // Reps: feeling-based; when RIR condition met, take the larger of the two signals
  const feelingRepDelta = selected ? FEELING_STEPS[selected] * repStep : 0;
  const rirRepDelta     = rirConditionMet && avgRIR != null
    ? isWeighted
      ? Math.round(avgRIR - 2)           // 1 rep per RIR above target for weighted
      : Math.round((avgRIR - 2) * 2)     // 2 reps per RIR above target for bodyweight
    : 0;
  const finalRepDelta   = rirConditionMet
    ? Math.max(feelingRepDelta, rirRepDelta)
    : feelingRepDelta;
  const suggestedReps   = Math.max(1, currentStartingReps + finalRepDelta);

  const hasSuggestion = selected !== null && selected !== 'fair';

  const handleSave = async (mode: SaveMode) => {
    if (selected === null) return;
    setSaving(true);
    const pref: ExercisePref = {
      exerciseId:       exercise.id,
      startingWeightKg: mode === 'reps' ? currentStartingWeightKg : suggestedWeight,
      ...(mode !== 'weight' ? { startingReps: suggestedReps } : {}),
    };
    await db.exercisePrefs.put(pref);
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
              borderRadius:  'var(--radius-md)',
              border:        selected === id ? '1px solid var(--color-accent)' : 'var(--border-thin)',
              background:    selected === id ? 'var(--color-accent-dim)' : 'var(--color-surface)',
              color:         selected === id ? 'var(--color-accent)' : 'var(--color-text)',
              fontSize:      'var(--text-body)',
              transition:    'border 120ms, background 120ms',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Suggestion card */}
      {hasSuggestion && selected !== null && (
        <div
          className="flex flex-col gap-3 px-4 py-4"
          style={{
            background:    'var(--color-surface)',
            border:        rirConditionMet ? '1px solid var(--color-accent)' : 'var(--border-thin)',
            borderRadius:  'var(--radius-md)',
          }}
        >
          <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
            {rirConditionMet
              ? `Feeling + avg RIR ${avgRIR!.toFixed(1)} → next session`
              : 'Suggested for next session'}
          </p>

          {/* Weight row — weighted exercises only */}
          {isWeighted && (
            <div className="flex items-baseline gap-2">
              <span className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', minWidth: '3.5rem' }}>
                Weight
              </span>
              <span className="font-mono" data-numeric style={{ fontSize: 'var(--text-h3)', color: 'var(--color-accent)' }}>
                {suggestedWeight} kg
              </span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>
                ({weightDelta >= 0 ? '+' : ''}{weightDelta} kg)
              </span>
            </div>
          )}

          {/* Reps row — all exercises */}
          <div className="flex items-baseline gap-2">
            <span className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', minWidth: '3.5rem' }}>
              Reps
            </span>
            <span
              className="font-mono"
              data-numeric
              style={{ fontSize: 'var(--text-h3)', color: isWeighted ? 'var(--color-text)' : 'var(--color-accent)' }}
            >
              {suggestedReps} reps
            </span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>
              ({finalRepDelta >= 0 ? '+' : ''}{finalRepDelta})
            </span>
          </div>

          {/* Action buttons */}
          {isWeighted ? (
            <>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => handleSave('weight')}
                  disabled={saving}
                  className="flex-1 py-3 font-body"
                  style={{
                    fontSize:      'var(--text-meta)',
                    background:    'var(--color-accent)',
                    color:         '#fff',
                    borderRadius:  'var(--radius-md)',
                    border:        'none',
                  }}
                >
                  Weight
                </button>
                <button
                  onClick={() => handleSave('reps')}
                  disabled={saving}
                  className="flex-1 py-3 font-body"
                  style={{
                    fontSize:      'var(--text-meta)',
                    background:    'var(--color-surface-2)',
                    color:         'var(--color-text)',
                    borderRadius:  'var(--radius-md)',
                    border:        'var(--border-thin)',
                  }}
                >
                  Reps
                </button>
                <button
                  onClick={() => handleSave('both')}
                  disabled={saving}
                  className="flex-1 py-3 font-body"
                  style={{
                    fontSize:      'var(--text-meta)',
                    background:    'var(--color-surface-2)',
                    color:         'var(--color-text)',
                    borderRadius:  'var(--radius-md)',
                    border:        'var(--border-thin)',
                  }}
                >
                  Both
                </button>
              </div>
              <button
                onClick={onDone}
                className="font-body"
                style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)', alignSelf: 'center' }}
              >
                Skip
              </button>
            </>
          ) : (
            /* Bodyweight: only reps to update */
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => handleSave('reps')}
                disabled={saving}
                className="flex-1 py-3 font-display uppercase tracking-wide"
                style={{
                  fontSize:      'var(--text-meta)',
                  background:    'var(--color-accent)',
                  color:         '#fff',
                  borderRadius:  'var(--radius-md)',
                  border:        'none',
                  letterSpacing: '0.05em',
                }}
              >
                {saving ? 'Saving…' : 'Update Reps'}
              </button>
              <button
                onClick={onDone}
                className="px-4 py-3 font-body"
                style={{
                  fontSize:     'var(--text-meta)',
                  color:        'var(--color-text-muted)',
                  border:       'var(--border-thin)',
                  borderRadius: 'var(--radius-md)',
                  background:   'transparent',
                }}
              >
                Skip
              </button>
            </div>
          )}
        </div>
      )}

      {/* Continue when fair / no change needed */}
      {selected !== null && !hasSuggestion && (
        <button
          type="button"
          onClick={onDone}
          className="w-full py-4 font-display uppercase tracking-wide"
          style={{
            fontSize:      'var(--text-h2)',
            background:    'var(--color-accent)',
            color:         '#fff',
            borderRadius:  'var(--radius-md)',
            border:        'none',
            letterSpacing: '0.05em',
          }}
        >
          Continue
        </button>
      )}

      {/* Skip entire rating */}
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
