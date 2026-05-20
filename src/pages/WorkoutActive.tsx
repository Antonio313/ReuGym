import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { WarmupChecklist } from '@/components/workout/WarmupChecklist';
import { StretchChecklist } from '@/components/workout/StretchChecklist';
import { SetLogger } from '@/components/workout/SetLogger';
import { RestTimer } from '@/components/workout/RestTimer';
import { useTemplate } from '@/hooks/useTemplates';
import { useExercises } from '@/hooks/useExercises';
import { useWorkoutStore } from '@/store/workoutStore';
import { db } from '@/data/db';
import { templateMap as defaultTemplateMap } from '@/data/templates';
import { playTimerEnd } from '@/lib/audio';
import { haptics } from '@/lib/haptics';
import type { ActiveSet, ExerciseCategory } from '@/types';

type WorkoutPhase = 'warmup' | 'workout' | 'stretching';

export default function WorkoutActive() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<WorkoutPhase>('warmup');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [completingAfterRest, setCompletingAfterRest] = useState(false);
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const [restLabel, setRestLabel] = useState('');

  const liveTemplate = useTemplate(templateId ?? '');
  const template = liveTemplate ?? (templateId ? defaultTemplateMap.get(templateId) : undefined);

  const allExercises = useExercises();
  const exerciseMap = new Map(allExercises.map((e) => [e.id, e]));

  const store = useWorkoutStore();
  const {
    status,
    currentExerciseIndex,
    currentSetNumber,
    restSecondsRemaining,
    restTotalSeconds,
    restTimerActive,
    tickRestTimer,
    skipRestTimer,
    startRestTimer,
    incrementSetNumber,
    nextExercise,
    logSet,
    startSession,
    completeSession,
    resetSession,
  } = store;

  const prevStatus = useRef(status);

  // Tick the rest timer every second
  useEffect(() => {
    if (!restTimerActive) return;
    const id = setInterval(tickRestTimer, 1000);
    return () => clearInterval(id);
  }, [restTimerActive, tickRestTimer]);

  // When rest ends, play sound + haptics; if last set, finish workout
  useEffect(() => {
    if (status === 'active' && prevStatus.current === 'resting') {
      playTimerEnd();
      haptics.timer();
      if (completingAfterRest) {
        void finishWorkout();
      }
    }
    prevStatus.current = status;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const finishWorkout = async () => {
    const completedAt = Date.now();
    const durationSeconds = Math.round((completedAt - startedAt) / 1000);
    if (sessionId) {
      await db.sessions.update(sessionId, { completedAt, durationSeconds });
    }
    completeSession();
    resetSession();
    setPhase('stretching');
  };

  const handleStartWorkout = async () => {
    if (!template) return;
    const id = nanoid();
    const now = Date.now();
    await db.sessions.add({ id, templateId: template.id, startedAt: now });
    setSessionId(id);
    setStartedAt(now);
    startSession(template, id);
    setPhase('workout');
  };

  const handleSetLogged = (activeSet: ActiveSet, _isPR: boolean) => {
    if (!template) return;

    const currentTemplateExercise = template.exercises[currentExerciseIndex];
    const isLastSet = currentSetNumber === currentTemplateExercise.sets;
    const isLastExercise = currentExerciseIndex === template.exercises.length - 1;

    // Compute rest label from pre-update values so set numbers are correct
    const exerciseName = exerciseMap.get(currentTemplateExercise.exerciseId)?.name ?? '';
    let label: string;
    if (!isLastSet) {
      label = `Set ${currentSetNumber + 1} of ${currentTemplateExercise.sets} · ${exerciseName}`;
    } else if (!isLastExercise) {
      const nextEx = template.exercises[currentExerciseIndex + 1];
      label = `Next: ${exerciseMap.get(nextEx.exerciseId)?.name ?? ''}`;
    } else {
      label = "That's the last set — cool down time";
    }
    setRestLabel(label);

    logSet(activeSet);

    if (!isLastSet) {
      incrementSetNumber();
    } else if (!isLastExercise) {
      nextExercise();
    } else {
      setCompletingAfterRest(true);
    }

    const exercise = exerciseMap.get(currentTemplateExercise.exerciseId);
    startRestTimer(exercise?.restSeconds ?? 60);
  };

  // Skip rest — the status useEffect handles finishWorkout if completingAfterRest
  const handleSkipRest = () => {
    skipRestTimer();
  };

  const handleAbandon = () => {
    resetSession();
    navigate('/');
  };

  if (!template) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-dvh gap-4 px-4"
        style={{ background: 'var(--color-bg)' }}
      >
        <p style={{ color: 'var(--color-text-muted)' }}>Template not found.</p>
        <button onClick={() => navigate('/')} style={{ color: 'var(--color-accent)', fontSize: 'var(--text-meta)' }}>
          ← Back home
        </button>
      </div>
    );
  }

  if (phase === 'warmup') {
    return (
      <WarmupChecklist
        category={template.category as ExerciseCategory}
        onStart={handleStartWorkout}
      />
    );
  }

  if (phase === 'stretching') {
    return <StretchChecklist onFinish={() => navigate('/')} />;
  }

  // ── Workout phase ──────────────────────────────────────────────

  if (status === 'resting') {
    return (
      <div style={{ maxWidth: 'var(--max-content-width)', margin: '0 auto' }}>
        <RestTimer
          secondsRemaining={restSecondsRemaining}
          totalSeconds={restTotalSeconds}
          nextLabel={restLabel}
          onSkip={handleSkipRest}
        />
      </div>
    );
  }

  const currentTemplateExercise = template.exercises[currentExerciseIndex];
  const currentExercise = exerciseMap.get(currentTemplateExercise?.exerciseId ?? '');

  if (!currentExercise) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-dvh px-4"
        style={{ background: 'var(--color-bg)' }}
      >
        <p style={{ color: 'var(--color-text-muted)' }}>Exercise data missing.</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-dvh mx-auto"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}
    >
      {/* Minimal header */}
      <header
        className="flex items-center justify-between px-4"
        style={{
          height: 'var(--header-height)',
          borderBottom: 'var(--border-thin)',
          background: 'var(--color-bg)',
        }}
      >
        {confirmingQuit ? (
          <>
            <span className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
              Abandon workout?
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmingQuit(false)}
                className="font-body"
                style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAbandon}
                className="font-body font-medium"
                style={{ fontSize: 'var(--text-meta)', color: 'var(--color-regression)' }}
              >
                Quit
              </button>
            </div>
          </>
        ) : (
          <>
            <span
              className="font-display"
              style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)', letterSpacing: '0.05em' }}
            >
              {template.shortLabel}
            </span>
            <div className="flex items-center gap-4">
              <span className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
                {currentExerciseIndex + 1}/{template.exercises.length}
              </span>
              <button
                onClick={() => setConfirmingQuit(true)}
                className="font-body"
                style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)' }}
              >
                Quit
              </button>
            </div>
          </>
        )}
      </header>

      <SetLogger
        templateExercise={currentTemplateExercise}
        exercise={currentExercise}
        setNumber={currentSetNumber}
        totalSets={currentTemplateExercise.sets}
        sessionId={sessionId ?? ''}
        onSetLogged={handleSetLogged}
      />
    </div>
  );
}

