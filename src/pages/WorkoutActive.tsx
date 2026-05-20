import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { WarmupChecklist } from '@/components/workout/WarmupChecklist';
import { StretchChecklist } from '@/components/workout/StretchChecklist';
import { SetLogger } from '@/components/workout/SetLogger';
import { RestTimer } from '@/components/workout/RestTimer';
import { FeelingMeter } from '@/components/workout/FeelingMeter';
import { useTemplate } from '@/hooks/useTemplates';
import { useExercises } from '@/hooks/useExercises';
import { useWorkoutStore } from '@/store/workoutStore';
import { db } from '@/data/db';
import { templateMap as defaultTemplateMap } from '@/data/templates';
import { exerciseMap as staticExerciseMap } from '@/data/exercises';
import { playTimerEnd } from '@/lib/audio';
import { haptics } from '@/lib/haptics';
import type { ActiveSet, ExerciseCategory, Exercise } from '@/types';

type WorkoutPhase = 'warmup' | 'workout' | 'stretching';

// IDs of exercises to show FeelingMeter for, in order
type FeelingEntry = { exerciseId: string; exercise: Exercise; startingWeightKg: number };

export default function WorkoutActive() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<WorkoutPhase>('warmup');
  const [completingAfterRest, setCompletingAfterRest] = useState(false);
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const [restLabel, setRestLabel] = useState('');
  const [showRestoredBanner, setShowRestoredBanner] = useState(false);
  const [feelingQueue, setFeelingQueue] = useState<FeelingEntry[]>([]);
  // pendingRest holds the seconds to start after feeling queue drains
  const pendingRestRef = useRef<number | null>(null);

  const liveTemplate = useTemplate(templateId ?? '');
  const template = liveTemplate ?? (templateId ? defaultTemplateMap.get(templateId) : undefined);

  const allExercises = useExercises();
  const exerciseMap = new Map(allExercises.map((e) => [e.id, e]));

  const store = useWorkoutStore();
  const {
    status,
    sessionId,
    sessionStartedAt,
    currentExerciseIndex,
    currentSetNumber,
    restSecondsRemaining,
    restTotalSeconds,
    restTimerActive,
    restEndTimestamp,
    tickRestTimer,
    skipRestTimer,
    setRestSeconds,
    startRestTimer,
    incrementSetNumber,
    nextExercise,
    setExerciseAndSet,
    logSet,
    startSession,
    completeSession,
    resetSession,
  } = store;

  const prevStatus = useRef(status);
  const mountedRef = useRef(false);

  // On first mount: detect if a session was already in progress (restored from localStorage)
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    if (status !== 'idle') {
      // Session was restored from persisted storage
      setPhase('workout');
      setShowRestoredBanner(true);
      setTimeout(() => setShowRestoredBanner(false), 4000);

      // Correct the rest timer if app was backgrounded
      if (restTimerActive && restEndTimestamp != null) {
        const remaining = Math.max(0, Math.ceil((restEndTimestamp - Date.now()) / 1000));
        if (remaining === 0) {
          skipRestTimer();
        } else {
          setRestSeconds(remaining);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // When feeling queue drains, kick off the pending rest (if any)
  useEffect(() => {
    if (feelingQueue.length === 0 && pendingRestRef.current != null) {
      const secs = pendingRestRef.current;
      pendingRestRef.current = null;
      startRestTimer(secs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feelingQueue.length]);

  const finishWorkout = async () => {
    const completedAt = Date.now();
    const durationSeconds = sessionStartedAt
      ? Math.round((completedAt - sessionStartedAt) / 1000)
      : 0;
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
    startSession(template, id, now);
    setPhase('workout');
  };

  const handleSetLogged = async (activeSet: ActiveSet, _isPR: boolean) => {
    if (!template) return;

    const currTE = template.exercises[currentExerciseIndex];
    const nextTE = template.exercises[currentExerciseIndex + 1];
    const prevTE = template.exercises[currentExerciseIndex - 1];

    const isLastSet = currentSetNumber === currTE.sets;
    const isLastExercise = currentExerciseIndex === template.exercises.length - 1;

    // Superset detection
    const isFirstInPair =
      currTE.isSuperset &&
      nextTE?.isSuperset &&
      nextTE.supersetGroupId != null &&
      nextTE.supersetGroupId === currTE.supersetGroupId;

    const isSecondInPair =
      currTE.isSuperset &&
      prevTE?.isSuperset &&
      prevTE.supersetGroupId != null &&
      prevTE.supersetGroupId === currTE.supersetGroupId;

    logSet(activeSet);

    if (isFirstInPair) {
      // Jump to partner exercise, same set number, no rest
      const partnerName = exerciseMap.get(nextTE.exerciseId)?.name ?? '';
      setRestLabel(`${partnerName} — Set ${currentSetNumber}`);
      setExerciseAndSet(currentExerciseIndex + 1, currentSetNumber);
      // Do NOT start rest timer — no rest between superset partners
      return;
    }

    if (isSecondInPair) {
      const isLastSetOfPair = isLastSet;
      const partnerExerciseA = exerciseMap.get(prevTE.exerciseId);
      const partnerExerciseB = exerciseMap.get(currTE.exerciseId);

      if (!isLastSetOfPair) {
        // Go back to first partner, next set round
        const aName = exerciseMap.get(prevTE.exerciseId)?.name ?? '';
        setRestLabel(`Set ${currentSetNumber + 1} · ${aName} → ${exerciseMap.get(currTE.exerciseId)?.name ?? ''}`);
        setExerciseAndSet(currentExerciseIndex - 1, currentSetNumber + 1);
        const restSecs = getRestSecondsForExercise(currTE.exerciseId, exerciseMap);
        startRestTimer(restSecs);
      } else {
        // Both partners done — queue feeling meter for both exercises, then advance
        const queueEntries: FeelingEntry[] = [];
        if (partnerExerciseA) {
          const pref = await db.exercisePrefs.get(partnerExerciseA.id);
          queueEntries.push({ exerciseId: partnerExerciseA.id, exercise: partnerExerciseA, startingWeightKg: pref?.startingWeightKg ?? partnerExerciseA.startingWeightKg });
        }
        if (partnerExerciseB) {
          const pref = await db.exercisePrefs.get(partnerExerciseB.id);
          queueEntries.push({ exerciseId: partnerExerciseB.id, exercise: partnerExerciseB, startingWeightKg: pref?.startingWeightKg ?? partnerExerciseB.startingWeightKg });
        }

        if (!isLastExercise) {
          const nextNonSupersetEx = template.exercises[currentExerciseIndex + 1];
          const nextName = exerciseMap.get(nextNonSupersetEx.exerciseId)?.name ?? '';
          setRestLabel(`Next: ${nextName}`);
          nextExercise();
        } else {
          setCompletingAfterRest(true);
        }

        const restSecs = getRestSecondsForExercise(currTE.exerciseId, exerciseMap);
        if (queueEntries.length > 0) {
          setFeelingQueue(queueEntries);
          pendingRestRef.current = restSecs;
        } else {
          startRestTimer(restSecs);
        }
      }
      return;
    }

    // ── Non-superset exercise ─────────────────────────────────────
    const exerciseName = exerciseMap.get(currTE.exerciseId)?.name ?? '';
    let label: string;
    if (!isLastSet) {
      label = `Set ${currentSetNumber + 1} of ${currTE.sets} · ${exerciseName}`;
    } else if (!isLastExercise) {
      const nextEx = template.exercises[currentExerciseIndex + 1];
      label = `Next: ${exerciseMap.get(nextEx.exerciseId)?.name ?? ''}`;
    } else {
      label = "That's the last set — cool down time";
    }
    setRestLabel(label);

    if (!isLastSet) {
      incrementSetNumber();
      startRestTimer(getRestSecondsForExercise(currTE.exerciseId, exerciseMap));
    } else {
      // Last set of this exercise — show feeling meter, then rest
      const exercise = exerciseMap.get(currTE.exerciseId) ?? staticExerciseMap.get(currTE.exerciseId);
      const restSecs = getRestSecondsForExercise(currTE.exerciseId, exerciseMap);

      if (!isLastExercise) {
        nextExercise();
      } else {
        setCompletingAfterRest(true);
      }

      if (exercise) {
        const pref = await db.exercisePrefs.get(exercise.id);
        const startingWeight = pref?.startingWeightKg ?? exercise.startingWeightKg;
        setFeelingQueue([{ exerciseId: exercise.id, exercise, startingWeightKg: startingWeight }]);
        pendingRestRef.current = restSecs;
      } else {
        startRestTimer(restSecs);
      }
    }
  };

  const handleFeelingDone = () => {
    setFeelingQueue((q) => q.slice(1));
  };

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

  // ── Feeling meter phase ────────────────────────────────────────
  if (feelingQueue.length > 0) {
    const current = feelingQueue[0];
    return (
      <FeelingMeter
        exercise={current.exercise}
        currentStartingWeightKg={current.startingWeightKg}
        onDone={handleFeelingDone}
      />
    );
  }

  // ── Rest phase ─────────────────────────────────────────────────
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
      {/* Session restored banner */}
      {showRestoredBanner && (
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ background: 'var(--color-surface-2)', borderBottom: 'var(--border-thin)' }}
        >
          <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
            Session restored
          </p>
          <button
            onClick={() => setShowRestoredBanner(false)}
            style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-meta)' }}
          >
            ✕
          </button>
        </div>
      )}

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

// ── Helpers ──────────────────────────────────────────────────────

function getRestSecondsForExercise(
  exerciseId: string,
  exerciseMap: Map<string, Exercise>,
): number {
  return exerciseMap.get(exerciseId)?.restSeconds ?? staticExerciseMap.get(exerciseId)?.restSeconds ?? 60;
}
