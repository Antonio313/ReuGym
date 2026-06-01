import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { supabase } from '@/lib/supabase';
import { getLocalSession } from '@/lib/auth';
import { checkIsPR } from '@/lib/pr';
import { useLastSetData } from '@/hooks/useLastSetData';
import { useExercisePref } from '@/hooks/useExercisePref';
import { haptics } from '@/lib/haptics';
import { playSetLogged } from '@/lib/audio';
import { NumericKeypad } from '@/components/shared/NumericKeypad';
import { VideoReference } from '@/components/workout/VideoReference';
import { snapToNearestDumbbell } from '@/lib/weights';
import type { TemplateExercise, Exercise, ActiveSet } from '@/types';

type Props = {
  templateExercise: TemplateExercise;
  exercise: Exercise;
  setNumber: number;
  totalSets: number;
  sessionId: string;
  onSetLogged: (set: ActiveSet, isPR: boolean) => void;
  onSkip?: () => void;
};


function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function SetLogger({
  templateExercise,
  exercise,
  setNumber,
  totalSets,
  sessionId,
  onSetLogged,
  onSkip,
}: Props) {
  const [weightStr, setWeightStr] = useState('');
  const [repsStr, setRepsStr] = useState('');
  const [activeField, setActiveField] = useState<'weight' | 'reps' | null>(null);
  const rirOptions = templateExercise.isTimed ? [0, 5, 10, 15, 20, 30] : [0, 1, 2, 3, 4, 5];
  const [rir, setRir] = useState(() => templateExercise.isTimed ? 10 : 2);
  const [isWarmup, setIsWarmup] = useState(false);
  const [justLoggedPR, setJustLoggedPR] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timed exercise state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDisplaySeconds, setTimerDisplaySeconds] = useState(0);
  const [timerLocked, setTimerLocked] = useState<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lastData = useLastSetData(exercise.id, setNumber, sessionId);
  const exercisePref = useExercisePref(exercise.id);

  // Reset fields when set number or exercise changes
  useEffect(() => {
    setWeightStr('');
    setRepsStr('');
    setActiveField(null);
    setError(null);
    setTimerRunning(false);
    setTimerDisplaySeconds(0);
    setTimerLocked(null);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, [exercise.id, setNumber]);

  // Default weight: lastData → exercisePref → templateExercise.startingWeightKg → snap to dumbbell
  const defaultWeightKg = snapToNearestDumbbell(
    lastData?.weightKg != null
      ? lastData.weightKg
      : (exercisePref?.startingWeightKg ?? templateExercise.startingWeightKg),
  );

  // Default reps: lastData → pref startingReps → lower bound of rep range
  const defaultReps =
    lastData?.reps != null
      ? lastData.reps
      : (exercisePref?.startingReps ?? templateExercise.repRange[0]);

  const resolvedWeight = weightStr !== '' ? parseFloat(weightStr) : defaultWeightKg;
  const resolvedReps = templateExercise.isTimed
    ? (timerLocked ?? defaultReps)
    : (repsStr !== '' ? parseInt(repsStr, 10) : defaultReps);

  // Timer controls
  const startTimer = () => {
    if (timerRunning) return;
    setTimerRunning(true);
    setTimerLocked(null);
    timerIntervalRef.current = setInterval(() => {
      setTimerDisplaySeconds(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimerRunning(false);
    setTimerLocked(timerDisplaySeconds);
  };

  const resetTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimerRunning(false);
    setTimerDisplaySeconds(0);
    setTimerLocked(null);
  };

  const handleLogSet = async () => {
    const weight = resolvedWeight;
    const reps = resolvedReps;

    if (!isWarmup && weight <= 0 && !templateExercise.isBodyweight) {
      setError('Enter a weight');
      return;
    }
    if (templateExercise.isTimed && timerLocked === null) {
      setError('Start and stop the timer first');
      return;
    }
    if (!templateExercise.isTimed && reps <= 0) {
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
      weightKg: templateExercise.isBodyweight ? 0 : weight,
      reps,
      rir,
      isWarmup,
      isPR: false,
      completedAt: Date.now(),
    };

    const user = getLocalSession();
    if (user) {
      await supabase.from('logged_sets').insert({
        id:           loggedSet.id,
        user_id:      user.id,
        session_id:   loggedSet.sessionId,
        exercise_id:  loggedSet.exerciseId,
        set_number:   loggedSet.setNumber,
        weight_kg:    loggedSet.weightKg,
        reps:         loggedSet.reps,
        rir:          loggedSet.rir,
        is_warmup:    loggedSet.isWarmup,
        is_pr:        false,
        completed_at: loggedSet.completedAt,
      });
    }

    const isPR = await checkIsPR(exercise.id, loggedSet.weightKg, reps, sessionId);
    if (isPR) {
      if (user) await supabase.from('logged_sets').update({ is_pr: true }).eq('id', loggedSet.id);
      setJustLoggedPR(true);
      setTimeout(() => setJustLoggedPR(false), 2000);
    }

    haptics.medium();
    playSetLogged();

    setWeightStr('');
    setRepsStr('');
    resetTimer();

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
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {templateExercise.isSuperset && (
                <span
                  className="font-body uppercase tracking-widest"
                  style={{ fontSize: 'var(--text-micro)', color: 'var(--color-accent)' }}
                >
                  Superset
                </span>
              )}
              {templateExercise.isBodyweight && (
                <span
                  className="font-body uppercase tracking-widest"
                  style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
                >
                  Bodyweight
                </span>
              )}
              {templateExercise.isTimed && (
                <span
                  className="font-body uppercase tracking-widest"
                  style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
                >
                  Timed
                </span>
              )}
            </div>
            {exercise.videoUrl && (
              <div className="mt-2">
                <VideoReference videoUrl={exercise.videoUrl} />
              </div>
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
              Last:{' '}
              {lastData.weightKg > 0 ? `${lastData.weightKg}kg × ` : ''}
              {exercise.isTimed ? `${lastData.reps}s` : `${lastData.reps} reps`}
            </p>
          ) : lastData === null ? (
            <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)' }}>
              Starting defaults shown
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

        {/* Weight field (hidden for pure bodyweight exercises) */}
        {!templateExercise.isBodyweight && (
          <div className="flex gap-3">
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
                  color: weightStr ? 'var(--color-text)' : 'var(--color-text-muted)',
                  minHeight: '2rem',
                }}
              >
                {weightStr || String(defaultWeightKg)}
              </span>
              <span className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                kg
              </span>
            </button>
          </div>
        )}

        {/* Timed exercise — count-up timer */}
        {templateExercise.isTimed ? (
          <div
            className="flex flex-col items-center gap-4 py-5"
            style={{
              background: 'var(--color-surface)',
              border: timerLocked !== null ? '1px solid var(--color-accent)' : 'var(--border-thin)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {/* Target hint */}
            <p
              className="font-body uppercase tracking-widest"
              style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
            >
              Target: {templateExercise.repRange[0]}–{templateExercise.repRange[1]}s
            </p>

            {/* Elapsed time */}
            <span
              className="font-mono"
              data-numeric
              style={{
                fontSize: 'clamp(3rem, 15vw, 6rem)',
                color: timerLocked !== null ? 'var(--color-accent)' : 'var(--color-text)',
                lineHeight: 1,
                transition: 'color 200ms',
              }}
            >
              {formatTime(timerLocked !== null && !timerRunning ? timerLocked : timerDisplaySeconds)}
            </span>

            {/* Controls */}
            <div className="flex gap-3">
              {!timerRunning && timerLocked === null ? (
                <button
                  type="button"
                  onClick={startTimer}
                  className="font-display uppercase tracking-wide px-8 py-3"
                  style={{
                    fontSize: 'var(--text-body)',
                    background: 'var(--color-accent)',
                    color: '#fff',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    letterSpacing: '0.05em',
                  }}
                >
                  Start
                </button>
              ) : timerRunning ? (
                <button
                  type="button"
                  onClick={stopTimer}
                  className="font-display uppercase tracking-wide px-8 py-3"
                  style={{
                    fontSize: 'var(--text-body)',
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-accent)',
                    letterSpacing: '0.05em',
                  }}
                >
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resetTimer}
                  className="font-body px-6 py-3"
                  style={{
                    fontSize: 'var(--text-meta)',
                    color: 'var(--color-text-muted)',
                    border: 'var(--border-thin)',
                    borderRadius: 'var(--radius-md)',
                    background: 'transparent',
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Normal reps field */
          <div className="flex gap-3">
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
                  color: repsStr ? 'var(--color-text)' : 'var(--color-text-muted)',
                  minHeight: '2rem',
                }}
              >
                {repsStr || String(defaultReps)}
              </span>
              <span className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                reps
              </span>
            </button>
          </div>
        )}

        {/* RIR selector */}
        <div>
          <p className="font-body mb-2" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {templateExercise.isTimed ? 'SIR' : 'RIR'}
          </p>
          <div className="flex gap-2">
            {rirOptions.map((r) => (
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

        {/* Skip — shown only when machine could be occupied */}
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="w-full py-3 font-body"
            style={{
              fontSize: 'var(--text-meta)',
              color: 'var(--color-text-faint)',
              border: 'var(--border-thin)',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
            }}
          >
            Machine in use — skip for now
          </button>
        )}
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
