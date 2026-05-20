import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { db } from '@/data/db';
import { checkIsPR } from '@/lib/pr';
import { useLastSetData } from '@/hooks/useLastSetData';
import { haptics } from '@/lib/haptics';
import { playSetLogged } from '@/lib/audio';
import { NumericKeypad } from '@/components/shared/NumericKeypad';
import type { TemplateExercise, Exercise, ActiveSet } from '@/types';

type Props = {
  templateExercise: TemplateExercise;
  exercise: Exercise;
  setNumber: number;
  totalSets: number;
  sessionId: string;
  onSetLogged: (set: ActiveSet, isPR: boolean) => void;
};

const RIR_OPTIONS = [0, 1, 2, 3, 4, 5];

export function SetLogger({
  templateExercise,
  exercise,
  setNumber,
  totalSets,
  sessionId,
  onSetLogged,
}: Props) {
  const [weightStr, setWeightStr] = useState('');
  const [repsStr, setRepsStr] = useState('');
  const [activeField, setActiveField] = useState<'weight' | 'reps' | null>(null);
  const [rir, setRir] = useState(2);
  const [isWarmup, setIsWarmup] = useState(false);
  const [justLoggedPR, setJustLoggedPR] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastData = useLastSetData(exercise.id, setNumber, sessionId);

  // Reset fields when set number or exercise changes
  useEffect(() => {
    setWeightStr('');
    setRepsStr('');
    setActiveField(null);
    setError(null);
  }, [exercise.id, setNumber]);

  const resolvedWeight = weightStr !== '' ? parseFloat(weightStr) : (lastData?.weightKg ?? 0);
  const resolvedReps = repsStr !== '' ? parseInt(repsStr, 10) : (lastData?.reps ?? 0);

  const handleLogSet = async () => {
    const weight = resolvedWeight;
    const reps = resolvedReps;

    if (!isWarmup && weight <= 0 && !exercise.isBodyweight) {
      setError('Enter a weight');
      return;
    }
    if (reps <= 0) {
      setError('Enter reps');
      return;
    }

    setError(null);
    setActiveField(null);

    const loggedSet = {
      id: nanoid(),
      sessionId,
      exerciseId: exercise.id,
      setNumber,
      weightKg: exercise.isBodyweight ? 0 : weight,
      reps,
      rir,
      isWarmup,
      isPR: false,
      completedAt: Date.now(),
    };

    await db.sets.add(loggedSet);

    const isPR = await checkIsPR(exercise.id, loggedSet.weightKg, reps, sessionId);
    if (isPR) {
      await db.sets.update(loggedSet.id, { isPR: true });
      setJustLoggedPR(true);
      setTimeout(() => setJustLoggedPR(false), 2000);
    }

    haptics.medium();
    playSetLogged();

    setWeightStr('');
    setRepsStr('');

    onSetLogged(
      {
        exerciseId: exercise.id,
        setNumber,
        weightKg: loggedSet.weightKg,
        reps,
        rir,
        isWarmup,
      },
      isPR,
    );
  };

  const numpadValue = activeField === 'weight' ? weightStr : repsStr;
  const numpadOnChange = activeField === 'weight' ? setWeightStr : setRepsStr;

  return (
    <>
      {/* Main content — padded away from fixed numpad */}
      <div
        className="flex flex-col px-4 py-5 gap-5"
        style={{ paddingBottom: activeField ? '320px' : '0' }}
      >
        {/* Exercise header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2
              className="font-display leading-tight"
              style={{
                fontSize: 'clamp(1.5rem, 5vw, 2rem)',
                color: 'var(--color-text)',
                letterSpacing: '0.02em',
              }}
            >
              {exercise.name.toUpperCase()}
            </h2>
            {templateExercise.isSuperset && (
              <span
                className="font-body uppercase tracking-widest"
                style={{ fontSize: 'var(--text-micro)', color: 'var(--color-accent)' }}
              >
                Superset
              </span>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <span
              className="font-mono"
              data-numeric
              style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text-muted)' }}
            >
              {setNumber}
              <span style={{ color: 'var(--color-text-faint)' }}>/{totalSets}</span>
            </span>
          </div>
        </div>

        {/* Last session + PR badge */}
        <div className="flex items-center gap-3">
          {lastData ? (
            <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
              Last: {lastData.weightKg > 0 ? `${lastData.weightKg}kg × ` : ''}{lastData.reps} reps
            </p>
          ) : lastData === null ? (
            <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)' }}>
              No previous data
            </p>
          ) : null}
          {justLoggedPR && (
            <span
              className="font-body font-medium uppercase tracking-widest px-2 py-0.5"
              style={{
                fontSize: 'var(--text-micro)',
                background: 'var(--color-accent)',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              PR!
            </span>
          )}
        </div>

        {/* Weight + Reps fields */}
        <div className="flex gap-3">
          {/* Weight field (hidden for pure bodyweight exercises) */}
          {!exercise.isBodyweight && (
            <button
              type="button"
              onClick={() => setActiveField('weight')}
              className="flex-1 flex flex-col items-center py-4 gap-1"
              style={{
                background: 'var(--color-surface)',
                border: activeField === 'weight'
                  ? '1px solid var(--color-accent)'
                  : 'var(--border-thin)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <span
                className="font-mono"
                data-numeric
                style={{
                  fontSize: 'var(--text-h1)',
                  color: weightStr ? 'var(--color-text)' : 'var(--color-text-faint)',
                  minHeight: '2rem',
                }}
              >
                {weightStr || (lastData?.weightKg != null ? String(lastData.weightKg) : '—')}
              </span>
              <span className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                kg
              </span>
            </button>
          )}

          {/* Reps field */}
          <button
            type="button"
            onClick={() => setActiveField('reps')}
            className="flex-1 flex flex-col items-center py-4 gap-1"
            style={{
              background: 'var(--color-surface)',
              border: activeField === 'reps'
                ? '1px solid var(--color-accent)'
                : 'var(--border-thin)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <span
              className="font-mono"
              data-numeric
              style={{
                fontSize: 'var(--text-h1)',
                color: repsStr ? 'var(--color-text)' : 'var(--color-text-faint)',
                minHeight: '2rem',
              }}
            >
              {repsStr || (lastData?.reps != null ? String(lastData.reps) : '—')}
            </span>
            <span className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              reps
            </span>
          </button>
        </div>

        {/* RIR selector */}
        <div>
          <p className="font-body mb-2" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            RIR
          </p>
          <div className="flex gap-2">
            {RIR_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRir(r)}
                className="flex-1 py-2 font-mono"
                data-numeric
                style={{
                  fontSize: 'var(--text-body)',
                  borderRadius: 'var(--radius-sm)',
                  border: rir === r ? '1px solid var(--color-accent)' : 'var(--border-thin)',
                  background: rir === r ? 'var(--color-accent-dim)' : 'var(--color-surface)',
                  color: rir === r ? 'var(--color-accent)' : 'var(--color-text-muted)',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Warmup toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsWarmup((w) => !w)}
            className="relative flex-shrink-0"
            style={{
              width: '2.75rem',
              height: '1.5rem',
              borderRadius: '9999px',
              background: isWarmup ? 'var(--color-accent)' : 'var(--color-surface-2)',
              border: 'var(--border-thin)',
              transition: 'background 200ms',
            }}
          >
            <span
              className="absolute top-0.5"
              style={{
                left: isWarmup ? 'calc(100% - 1.25rem)' : '0.25rem',
                width: '1rem',
                height: '1rem',
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 200ms',
              }}
            />
          </button>
          <span className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
            Warmup set
          </span>
        </div>

        {/* Exercise notes */}
        {exercise.notes && (
          <p
            className="font-body"
            style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)', fontStyle: 'italic' }}
          >
            {exercise.notes}
          </p>
        )}

        {/* Error */}
        {error && (
          <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-regression)' }}>
            {error}
          </p>
        )}

        {/* Log set button */}
        <button
          type="button"
          onClick={handleLogSet}
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
          Log Set
        </button>
      </div>

      {/* Fixed bottom numpad panel */}
      {activeField && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 mx-auto"
          style={{
            maxWidth: 'var(--max-content-width)',
            background: 'var(--color-surface)',
            borderTop: 'var(--border-thin)',
          }}
        >
          <NumericKeypad
            value={numpadValue}
            onChange={numpadOnChange}
            decimal={activeField === 'weight'}
            onDone={() => setActiveField(null)}
          />
        </div>
      )}
    </>
  );
}
