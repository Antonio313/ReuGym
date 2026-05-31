import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { WorkoutPreview } from '@/components/workout/WorkoutPreview';
import { StretchStep } from '@/components/workout/StretchStep';
import { SetLogger } from '@/components/workout/SetLogger';
import { RestTimer } from '@/components/workout/RestTimer';
import { FeelingMeter } from '@/components/workout/FeelingMeter';
import { WorkoutComplete, type CompletionStats } from '@/components/workout/WorkoutComplete';
import { useTemplate } from '@/hooks/useTemplates';
import { useExercises, useStretches } from '@/hooks/useExercises';
import { useDayStretches } from '@/hooks/useDayStretches';
import { loadAllPrefs } from '@/hooks/useExercisePref';
import { useWorkoutStore } from '@/store/workoutStore';
import { enableWakeLock, disableWakeLock } from '@/lib/wakeLock';
import { supabase } from '@/lib/supabase';
import { getLocalSession } from '@/lib/auth';
import { templateMap as defaultTemplateMap } from '@/data/templates';
import { exerciseMap as staticExerciseMap } from '@/data/exercises';
import { playTimerEnd } from '@/lib/audio';
import { haptics } from '@/lib/haptics';
import type { ActiveSet, Exercise, ExercisePref } from '@/types';

type WorkoutPhase = 'preview' | 'pre-stretch' | 'workout' | 'post-stretch' | 'complete';

type FeelingEntry = {
  exerciseId: string;
  exercise: Exercise;
  startingWeightKg: number;
  startingReps: number;
  sessionId: string;
};

export default function WorkoutActive() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<WorkoutPhase>('preview');
  const [stretchIndex, setStretchIndex] = useState(0);
  const [completingAfterRest, setCompletingAfterRest] = useState(false);
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const [restLabel, setRestLabel] = useState('');
  const [showRestoredBanner, setShowRestoredBanner] = useState(false);
  const [feelingQueue, setFeelingQueue] = useState<FeelingEntry[]>([]);
  const [completionStats, setCompletionStats] = useState<CompletionStats | null>(null);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [restNextExercise, setRestNextExercise] = useState<Exercise | null>(null);
  const [restNextTarget, setRestNextTarget] = useState<{ weight: number | null; reps: [number, number] } | null>(null);
  // pendingRest holds the seconds to start after feeling queue drains
  const pendingRestRef = useRef<number | null>(null);

  // Skip-exercise state: indices deferred to end of workout
  const [skippedIndices, setSkippedIndices] = useState<number[]>([]);
  const [isWorkingThroughSkipped, setIsWorkingThroughSkipped] = useState(false);
  const [pendingSkippedIndex, setPendingSkippedIndex] = useState<number | null>(null);

  const [liveTemplate] = useTemplate(templateId ?? '');
  const template = liveTemplate ?? (templateId ? defaultTemplateMap.get(templateId) : undefined);

  const allExercises = useExercises();
  const exerciseMap = new Map(allExercises.map((e) => [e.id, e]));

  const [dayStretches] = useDayStretches(templateId ?? '');
  const allStretches = useStretches();
  const stretchExMap = new Map(allStretches.map((s) => [s.id, s]));

  const [prefsMap, setPrefsMap] = useState(new Map<string, ExercisePref>());
  useEffect(() => {
    loadAllPrefs().then(setPrefsMap);
  }, []);

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
    logSetSilent,
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
      setPhase('workout');
      setShowRestoredBanner(true);
      setTimeout(() => setShowRestoredBanner(false), 4000);

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

  // When rest ends, play sound + haptics; then complete or advance to a deferred exercise
  useEffect(() => {
    if (status === 'active' && prevStatus.current === 'resting') {
      playTimerEnd();
      haptics.timer();
      if (completingAfterRest) {
        void finishWorkout();
      } else if (pendingSkippedIndex !== null) {
        setExerciseAndSet(pendingSkippedIndex, 1);
        setPendingSkippedIndex(null);
      }
    }
    prevStatus.current = status;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);


  const finishWorkout = async () => {
    disableWakeLock();
    const completedAt = Date.now();
    const durationSeconds = sessionStartedAt
      ? Math.round((completedAt - sessionStartedAt) / 1000)
      : 0;

    let stats: CompletionStats = {
      durationSeconds,
      exercisesCompleted: template?.exercises.length ?? 0,
      totalSets: 0,
      prsHit: 0,
      totalVolumeKg: 0,
    };

    const user = getLocalSession();
    if (sessionId && user) {
      await supabase
        .from('workout_sessions')
        .update({ completed_at: completedAt, duration_seconds: durationSeconds })
        .eq('id', sessionId);
      const { data: setsData } = await supabase
        .from('logged_sets')
        .select('*')
        .eq('session_id', sessionId);
      const workSets = (setsData ?? []).filter((s) => !s.is_warmup);
      stats = {
        durationSeconds,
        exercisesCompleted: template?.exercises.length ?? 0,
        totalSets: workSets.length,
        prsHit: workSets.filter((s) => s.is_pr).length,
        totalVolumeKg: Math.round(workSets.reduce((sum, s) => sum + (s.weight_kg as number) * (s.reps as number), 0)),
      };
    }

    setCompletionStats(stats);
    completeSession();
    resetSession();
    setStretchIndex(0);
    setSkippedIndices([]);
    setIsWorkingThroughSkipped(false);
    setPendingSkippedIndex(null);
    setPhase(dayStretches.post.length > 0 ? 'post-stretch' : 'complete');
  };

  const handleStartWorkout = async () => {
    if (!template) return;
    const id = nanoid();
    const now = Date.now();
    const user = getLocalSession();
    if (user) {
      await supabase.from('workout_sessions').insert({
        id, user_id: user.id, template_id: template.id, started_at: now,
      });
    }
    startSession(template, id, now);
    enableWakeLock();
    setStretchIndex(0);
    setPhase(dayStretches.pre.length > 0 ? 'pre-stretch' : 'workout');
  };

  const handleSkipExercise = () => {
    if (!template || isWorkingThroughSkipped) return;
    const currTE = template.exercises[currentExerciseIndex];
    if (currTE.isSuperset) return; // supersets can't be skipped mid-pair

    haptics.light();

    const newSkipped = [...skippedIndices, currentExerciseIndex];
    const isLastMain = currentExerciseIndex === template.exercises.length - 1;

    if (!isLastMain) {
      setSkippedIndices(newSkipped);
      nextExercise();
    } else {
      // Skipped the last main exercise — jump straight to the first deferred one
      const [first, ...rest] = newSkipped;
      setSkippedIndices(rest);
      setIsWorkingThroughSkipped(true);
      setExerciseAndSet(first, 1);
    }
  };

  const handleStretchNext = () => {
    const list = phase === 'pre-stretch' ? dayStretches.pre : dayStretches.post;
    if (stretchIndex < list.length - 1) {
      setStretchIndex((i) => i + 1);
    } else {
      setStretchIndex(0);
      if (phase === 'pre-stretch') {
        setPhase('workout');
      } else {
        setPhase('complete');
      }
    }
  };

  const handleSetLogged = async (activeSet: ActiveSet, _isPR: boolean) => {
    if (activeSet.isWarmup) return;
    if (!template) return;

    const currTE = template.exercises[currentExerciseIndex];
    const nextTE = template.exercises[currentExerciseIndex + 1];
    const prevTE = template.exercises[currentExerciseIndex - 1];

    const isLastSet = currentSetNumber === currTE.sets;
    const isLastMainExercise = currentExerciseIndex === template.exercises.length - 1;

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

    if (isFirstInPair) {
      logSetSilent(activeSet);
      const partnerName = exerciseMap.get(nextTE.exerciseId)?.name ?? '';
      const partnerEx = exerciseMap.get(nextTE.exerciseId);
      setRestLabel(`${partnerName} — Set ${currentSetNumber}`);
      if (partnerEx) {
        const pref = prefsMap.get(partnerEx.id);
        setRestNextExercise(partnerEx);
        setRestNextTarget({
          weight: partnerEx.isBodyweight ? null : (pref?.startingWeightKg ?? partnerEx.startingWeightKg),
          reps: nextTE.repRange,
        });
      } else {
        setRestNextExercise(null);
        setRestNextTarget(null);
      }
      setExerciseAndSet(currentExerciseIndex + 1, currentSetNumber);
      return;
    }

    if (isSecondInPair) {
      logSetSilent(activeSet);
      const isLastSetOfPair = isLastSet;
      const partnerExerciseA = exerciseMap.get(prevTE.exerciseId);
      const partnerExerciseB = exerciseMap.get(currTE.exerciseId);

      if (!isLastSetOfPair) {
        const aName = exerciseMap.get(prevTE.exerciseId)?.name ?? '';
        setRestLabel(`Set ${currentSetNumber + 1} · ${aName} → ${exerciseMap.get(currTE.exerciseId)?.name ?? ''}`);
        if (partnerExerciseA) {
          const prefA = prefsMap.get(partnerExerciseA.id);
          setRestNextExercise(partnerExerciseA);
          setRestNextTarget({
            weight: partnerExerciseA.isBodyweight ? null : (prefA?.startingWeightKg ?? partnerExerciseA.startingWeightKg),
            reps: prevTE.repRange,
          });
        } else {
          setRestNextExercise(null);
          setRestNextTarget(null);
        }
        setExerciseAndSet(currentExerciseIndex - 1, currentSetNumber + 1);
        const restSecs = getRestSecondsForExercise(currTE.exerciseId, exerciseMap);
        startRestTimer(restSecs);
      } else {
        const queueEntries: FeelingEntry[] = [];
        const sid = sessionId ?? '';
        if (partnerExerciseA) {
          const pref = prefsMap.get(partnerExerciseA.id);
          queueEntries.push({
            exerciseId: partnerExerciseA.id,
            exercise: partnerExerciseA,
            startingWeightKg: pref?.startingWeightKg ?? partnerExerciseA.startingWeightKg,
            startingReps: pref?.startingReps ?? prevTE.repRange[0],
            sessionId: sid,
          });
        }
        if (partnerExerciseB) {
          const pref = prefsMap.get(partnerExerciseB.id);
          queueEntries.push({
            exerciseId: partnerExerciseB.id,
            exercise: partnerExerciseB,
            startingWeightKg: pref?.startingWeightKg ?? partnerExerciseB.startingWeightKg,
            startingReps: pref?.startingReps ?? currTE.repRange[0],
            sessionId: sid,
          });
        }

        const hasMoreMain = !isLastMainExercise && !isWorkingThroughSkipped;
        const hasMoreDeferred = skippedIndices.length > 0;

        if (hasMoreMain) {
          const nextNonSupersetEx = template.exercises[currentExerciseIndex + 1];
          const nextEx = exerciseMap.get(nextNonSupersetEx.exerciseId);
          const nextName = nextEx?.name ?? '';
          setRestLabel(`Next: ${nextName}`);
          if (nextEx) {
            const pref = prefsMap.get(nextEx.id);
            setRestNextExercise(nextEx);
            setRestNextTarget({
              weight: nextEx.isBodyweight ? null : (pref?.startingWeightKg ?? nextEx.startingWeightKg),
              reps: nextNonSupersetEx.repRange,
            });
          } else {
            setRestNextExercise(null);
            setRestNextTarget(null);
          }
          nextExercise();
        } else if (hasMoreDeferred) {
          const [first, ...rest] = skippedIndices;
          const nextEx = exerciseMap.get(template.exercises[first].exerciseId);
          setRestLabel(`Next: ${nextEx?.name ?? ''} (deferred)`);
          if (nextEx) {
            const pref = prefsMap.get(nextEx.id);
            setRestNextExercise(nextEx);
            setRestNextTarget({
              weight: nextEx.isBodyweight ? null : (pref?.startingWeightKg ?? nextEx.startingWeightKg),
              reps: template.exercises[first].repRange,
            });
          } else {
            setRestNextExercise(null);
            setRestNextTarget(null);
          }
          setPendingSkippedIndex(first);
          setSkippedIndices(rest);
          if (!isWorkingThroughSkipped) setIsWorkingThroughSkipped(true);
        } else {
          setRestNextExercise(null);
          setRestNextTarget(null);
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
    logSet(activeSet);
    const exerciseName = exerciseMap.get(currTE.exerciseId)?.name ?? '';
    const hasMoreMain = !isLastMainExercise && !isWorkingThroughSkipped;
    const hasMoreDeferred = skippedIndices.length > 0;

    let label: string;
    if (!isLastSet) {
      label = `Set ${currentSetNumber + 1} of ${currTE.sets} · ${exerciseName}`;
    } else if (hasMoreMain) {
      const nextTeEntry = template.exercises[currentExerciseIndex + 1];
      label = `Next: ${exerciseMap.get(nextTeEntry.exerciseId)?.name ?? ''}`;
    } else if (hasMoreDeferred) {
      label = `Next: ${exerciseMap.get(template.exercises[skippedIndices[0]].exerciseId)?.name ?? ''} (deferred)`;
    } else {
      label = "That's the last set — cool down time";
    }
    setRestLabel(label);

    // Set next exercise info for rest screen
    if (!isLastSet) {
      const currEx = exerciseMap.get(currTE.exerciseId);
      if (currEx) {
        const pref = prefsMap.get(currEx.id);
        setRestNextExercise(currEx);
        setRestNextTarget({
          weight: currEx.isBodyweight ? null : (pref?.startingWeightKg ?? currEx.startingWeightKg),
          reps: currTE.repRange,
        });
      } else {
        setRestNextExercise(null);
        setRestNextTarget(null);
      }
    } else if (hasMoreMain) {
      const nextTeEntry = template.exercises[currentExerciseIndex + 1];
      const nextEx = exerciseMap.get(nextTeEntry.exerciseId);
      if (nextEx) {
        const pref = prefsMap.get(nextEx.id);
        setRestNextExercise(nextEx);
        setRestNextTarget({
          weight: nextEx.isBodyweight ? null : (pref?.startingWeightKg ?? nextEx.startingWeightKg),
          reps: nextTeEntry.repRange,
        });
      } else {
        setRestNextExercise(null);
        setRestNextTarget(null);
      }
    } else if (hasMoreDeferred) {
      const nextSkippedTE = template.exercises[skippedIndices[0]];
      const nextEx = exerciseMap.get(nextSkippedTE.exerciseId);
      if (nextEx) {
        const pref = prefsMap.get(nextEx.id);
        setRestNextExercise(nextEx);
        setRestNextTarget({
          weight: nextEx.isBodyweight ? null : (pref?.startingWeightKg ?? nextEx.startingWeightKg),
          reps: nextSkippedTE.repRange,
        });
      } else {
        setRestNextExercise(null);
        setRestNextTarget(null);
      }
    } else {
      setRestNextExercise(null);
      setRestNextTarget(null);
    }

    if (!isLastSet) {
      incrementSetNumber();
      startRestTimer(getRestSecondsForExercise(currTE.exerciseId, exerciseMap));
    } else {
      const exercise = exerciseMap.get(currTE.exerciseId) ?? staticExerciseMap.get(currTE.exerciseId);
      const restSecs = getRestSecondsForExercise(currTE.exerciseId, exerciseMap);

      if (hasMoreMain) {
        nextExercise();
      } else if (hasMoreDeferred) {
        const [first, ...rest] = skippedIndices;
        setPendingSkippedIndex(first);
        setSkippedIndices(rest);
        if (!isWorkingThroughSkipped) setIsWorkingThroughSkipped(true);
      } else {
        setCompletingAfterRest(true);
      }

      if (exercise) {
        const pref = prefsMap.get(exercise.id);
        setFeelingQueue([{
          exerciseId: exercise.id,
          exercise,
          startingWeightKg: pref?.startingWeightKg ?? exercise.startingWeightKg,
          startingReps: pref?.startingReps ?? currTE.repRange[0],
          sessionId: sessionId ?? '',
        }]);
        pendingRestRef.current = restSecs;
      } else {
        startRestTimer(restSecs);
      }
    }
  };

  const handleFeelingDone = () => {
    const newQueue = feelingQueue.slice(1);
    setFeelingQueue(newQueue);
    if (newQueue.length === 0 && pendingRestRef.current != null) {
      const secs = pendingRestRef.current;
      pendingRestRef.current = null;
      startRestTimer(secs);
    }
  };

  const handleSkipRest = () => {
    skipRestTimer();
  };

  const handleAbandon = () => {
    disableWakeLock();
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

  // ── Preview phase ──────────────────────────────────────────────
  if (phase === 'preview') {
    return (
      <WorkoutPreview
        template={template}
        exerciseMap={exerciseMap}
        dayStretches={dayStretches}
        stretchExMap={stretchExMap}
        prefsMap={prefsMap}
        onBegin={handleStartWorkout}
        onBack={() => navigate(-1)}
      />
    );
  }

  // ── Pre-stretch phase ──────────────────────────────────────────
  if (phase === 'pre-stretch') {
    const list = dayStretches.pre;
    const assignment = list[stretchIndex];
    const stretchEx = stretchExMap.get(assignment?.exerciseId ?? '');
    const nextAssignment = list[stretchIndex + 1];
    const nextStretchEx = nextAssignment ? stretchExMap.get(nextAssignment.exerciseId) : undefined;
    if (!stretchEx) { handleStretchNext(); return null; }
    return (
      <StretchStep
        stretch={stretchEx}
        restSeconds={assignment.restSeconds}
        index={stretchIndex}
        total={list.length}
        phase="pre"
        nextStretch={nextStretchEx}
        nextRestSeconds={nextAssignment?.restSeconds}
        onNext={handleStretchNext}
      />
    );
  }

  // ── Post-stretch phase ─────────────────────────────────────────
  if (phase === 'post-stretch') {
    const list = dayStretches.post;
    const assignment = list[stretchIndex];
    const stretchEx = stretchExMap.get(assignment?.exerciseId ?? '');
    const nextAssignment = list[stretchIndex + 1];
    const nextStretchEx = nextAssignment ? stretchExMap.get(nextAssignment.exerciseId) : undefined;
    if (!stretchEx) { handleStretchNext(); return null; }
    return (
      <StretchStep
        stretch={stretchEx}
        restSeconds={assignment.restSeconds}
        index={stretchIndex}
        total={list.length}
        phase="post"
        nextStretch={nextStretchEx}
        nextRestSeconds={nextAssignment?.restSeconds}
        onNext={handleStretchNext}
      />
    );
  }

  // ── Complete phase ─────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <WorkoutComplete
        stats={completionStats ?? {
          durationSeconds: 0,
          exercisesCompleted: 0,
          totalSets: 0,
          prsHit: 0,
          totalVolumeKg: 0,
        }}
        onHome={() => navigate('/')}
      />
    );
  }

  // ── Feeling meter phase ────────────────────────────────────────
  if (feelingQueue.length > 0) {
    const current = feelingQueue[0];
    return (
      <FeelingMeter
        exercise={current.exercise}
        currentStartingWeightKg={current.startingWeightKg}
        currentStartingReps={current.startingReps}
        sessionId={current.sessionId}
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
          nextExercise={restNextExercise ?? undefined}
          nextTargetWeight={restNextTarget?.weight}
          nextTargetReps={restNextTarget?.reps}
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
                onClick={() => setShowUpcoming(true)}
                className="font-body"
                style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
              >
                Exercises
              </button>
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

      {showUpcoming && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          style={{ background: 'var(--color-bg)', maxWidth: 'var(--max-content-width)', margin: '0 auto' }}
        >
          <div
            className="flex items-center justify-between px-4 py-4"
            style={{ borderBottom: 'var(--border-thin)' }}
          >
            <span className="font-display" style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)', letterSpacing: '0.05em' }}>
              {template.shortLabel}
            </span>
            <button
              onClick={() => setShowUpcoming(false)}
              style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-h2)', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col px-4 py-3">
            {template.exercises.map((te, i) => {
              const ex = exerciseMap.get(te.exerciseId);
              const isCurrent = i === currentExerciseIndex;
              const isSkipped = skippedIndices.includes(i);
              const isDone = !isSkipped && i < currentExerciseIndex && !isSkipped;
              return (
                <div
                  key={te.exerciseId + i}
                  className="flex items-center gap-3 py-3"
                  style={{ borderBottom: 'var(--border-thin)', opacity: isDone ? 0.3 : 1 }}
                >
                  <span
                    className="font-mono flex-shrink-0"
                    data-numeric
                    style={{
                      fontSize: 'var(--text-meta)',
                      color: isCurrent ? 'var(--color-accent)' : 'var(--color-text-faint)',
                      width: '1.25rem',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-body truncate"
                      style={{ fontSize: 'var(--text-body)', color: isCurrent ? 'var(--color-accent)' : 'var(--color-text)' }}
                    >
                      {ex?.name ?? te.exerciseId}
                    </p>
                    <p
                      className="font-mono"
                      data-numeric
                      style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
                    >
                      {te.sets} × {formatRepRange(te.repRange[0], te.repRange[1], ex?.isTimed)}
                    </p>
                  </div>
                  {isCurrent && (
                    <span
                      className="font-body uppercase tracking-widest flex-shrink-0"
                      style={{ fontSize: 'var(--text-micro)', color: 'var(--color-accent)' }}
                    >
                      Now
                    </span>
                  )}
                  {isSkipped && (
                    <span
                      className="font-body uppercase tracking-widest flex-shrink-0"
                      style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-faint)', border: '1px solid var(--color-border)', padding: '1px 5px', borderRadius: 'var(--radius-sm)' }}
                    >
                      Deferred
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isWorkingThroughSkipped && (
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{ background: 'var(--color-surface-2)', borderBottom: 'var(--border-thin)' }}
        >
          <span className="font-body uppercase tracking-widest" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-faint)' }}>
            Deferred exercise
          </span>
        </div>
      )}

      <SetLogger
        templateExercise={currentTemplateExercise}
        exercise={currentExercise}
        setNumber={currentSetNumber}
        totalSets={currentTemplateExercise.sets}
        sessionId={sessionId ?? ''}
        onSetLogged={handleSetLogged}
        onSkip={!currentTemplateExercise.isSuperset && !isWorkingThroughSkipped ? handleSkipExercise : undefined}
      />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function formatRepRange(min: number, max: number, isTimed = false): string {
  const unit = isTimed ? 's' : ' reps';
  return min === max ? `${min}${unit}` : `${min}–${max}${unit}`;
}

function getRestSecondsForExercise(
  exerciseId: string,
  exerciseMap: Map<string, Exercise>,
): number {
  return exerciseMap.get(exerciseId)?.restSeconds ?? staticExerciseMap.get(exerciseId)?.restSeconds ?? 60;
}
