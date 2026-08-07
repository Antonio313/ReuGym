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
import { fetchLastSetData } from '@/hooks/useLastSetData';
import { useWorkoutStore } from '@/store/workoutStore';
import { enableWakeLock, disableWakeLock } from '@/lib/wakeLock';
import { getLocalSession } from '@/lib/auth';
import { getDB } from '@/data/db';
import { enqueueSync } from '@/lib/sync';
import { templateMap as defaultTemplateMap } from '@/data/templates';
import { exerciseMap as staticExerciseMap } from '@/data/exercises';
import { playTimerEnd } from '@/lib/audio';
import { haptics } from '@/lib/haptics';
import { resolveStartingWeight } from '@/lib/weights';
import { useUnit } from '@/hooks/useUnit';
import type { ActiveSet, Exercise, ExercisePref, SubstituteConfig, TemplateExercise } from '@/types';

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

  const { unit, toDisplay } = useUnit();
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

  // Defer-stretch state — mirrors skippedIndices/isWorkingThroughSkipped above,
  // scoped to whichever stretch list (pre or post) is currently active.
  const [skippedStretchIndices, setSkippedStretchIndices] = useState<number[]>([]);
  const [isWorkingThroughSkippedStretches, setIsWorkingThroughSkippedStretches] = useState(false);

  // Outright-skip notes (exercises and stretches) — accumulated through the
  // whole session (pre-stretch → workout → post-stretch) and persisted onto
  // the session's `notes` field so a skip is never silently lost.
  const [skipNotes, setSkipNotes] = useState<string[]>([]);

  // Session-only substitute swaps: exerciseIndex → SubstituteConfig
  const [sessionSwaps, setSessionSwaps] = useState<Map<number, SubstituteConfig>>(new Map());
  const [swapSheetOpen, setSwapSheetOpen] = useState(false);

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

  // Keeps "upcoming" weight previews (rest screen, feeling meter) in sync with
  // the exact value SetLogger will actually default to for that set number —
  // mirrors SetLogger's own priority order (history for this exact set number
  // first, then pref/template) so the two can never show different numbers
  // for the same upcoming set.
  const targetWeightFor = async (
    te: { exerciseId: string; startingWeightKg: number },
    setNumber: number,
  ): Promise<number> => {
    const user = getLocalSession();
    const lastData = user
      ? await fetchLastSetData(user.id, te.exerciseId, setNumber, sessionId)
      : null;
    return lastData?.weightKg
      ?? resolveStartingWeight(te.startingWeightKg, prefsMap.get(te.exerciseId)?.startingWeightKg);
  };

  // Resolves a template slot to what's actually being performed there this
  // session — a slot with an active substitute takes the substitute's own
  // sets/reps/weight/rest/bodyweight/timed nature, but keeps the slot's
  // superset membership so pairing logic (below) continues to treat it as
  // part of the same pair. isBodyweight/isTimed fall back to the slot's own
  // values for substitutes saved before those fields existed on the type.
  // Only called (in handleSetLogged) once `template` is known to exist.
  const effectiveTEAt = (index: number): TemplateExercise => {
    const te = template!.exercises[index];
    const swap = sessionSwaps.get(index);
    return swap
      ? { ...te, ...swap, isBodyweight: swap.isBodyweight ?? te.isBodyweight, isTimed: swap.isTimed ?? te.isTimed }
      : te;
  };

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


  // Writes whatever's currently in skipNotes onto the session row. Called
  // standalone after post-stretch (finishWorkout has already saved the
  // session by then, so there's no other write to piggyback on) and inlined
  // into finishWorkout's own update for the pre-stretch/workout portion.
  const persistSessionNotes = async (notes: string) => {
    if (!sessionId || !notes) return;
    const user = getLocalSession();
    if (!user) return;
    const db = getDB(user.id);
    await db.sessions.update(sessionId, { notes });
    await enqueueSync(user.id, 'workout_sessions', 'upsert', { id: sessionId, user_id: user.id, notes });
  };

  const finishWorkout = async () => {
    disableWakeLock();
    const completedAt = Date.now();
    const durationSeconds = sessionStartedAt
      ? Math.round((completedAt - sessionStartedAt) / 1000)
      : 0;
    const notes = skipNotes.length > 0 ? skipNotes.join(' · ') : undefined;

    let stats: CompletionStats = {
      durationSeconds,
      exercisesCompleted: template?.exercises.length ?? 0,
      totalSets: 0,
      prsHit: 0,
      totalVolumeKg: 0,
    };

    const user = getLocalSession();
    if (sessionId && user) {
      const db = getDB(user.id);

      // Update session in Dexie then queue the change for Supabase
      await db.sessions.update(sessionId, { completedAt, durationSeconds, ...(notes ? { notes } : {}) });
      await enqueueSync(user.id, 'workout_sessions', 'upsert', {
        id:               sessionId,
        user_id:          user.id,
        template_id:      template?.id,
        started_at:       sessionStartedAt,
        completed_at:     completedAt,
        duration_seconds: durationSeconds,
        ...(notes ? { notes } : {}),
      });

      // Read completion stats from Dexie (already populated by SetLogger)
      const allSets = await db.sets
        .where('[userId+sessionId]')
        .equals([user.id, sessionId])
        .toArray();
      const workSets = allSets.filter((s) => !s.isWarmup);
      stats = {
        durationSeconds,
        exercisesCompleted: template?.exercises.length ?? 0,
        totalSets: workSets.length,
        prsHit: workSets.filter((s) => s.isPR).length,
        totalVolumeKg: Math.round(workSets.reduce((sum, s) => sum + s.weightKg * s.reps, 0)),
      };
    }

    setCompletionStats(stats);
    completeSession();
    resetSession();
    setStretchIndex(0);
    setSkippedIndices([]);
    setIsWorkingThroughSkipped(false);
    setPendingSkippedIndex(null);
    setSessionSwaps(new Map());
    const hasPostStretch = dayStretches.post.length > 0;
    if (!hasPostStretch) setSkipNotes([]); // true end of session — safe to clear
    setPhase(hasPostStretch ? 'post-stretch' : 'complete');
  };

  const handleStartWorkout = async () => {
    if (!template) return;
    const id = nanoid();
    const now = Date.now();
    const user = getLocalSession();
    if (user) {
      const db = getDB(user.id);
      await db.sessions.put({ id, userId: user.id, templateId: template.id, startedAt: now });
      await enqueueSync(user.id, 'workout_sessions', 'upsert', {
        id, user_id: user.id, template_id: template.id, started_at: now,
      });
    }
    startSession(template, id, now);
    enableWakeLock();
    setStretchIndex(0);
    setSkippedStretchIndices([]);
    setIsWorkingThroughSkippedStretches(false);
    setSkipNotes([]);
    setPhase(dayStretches.pre.length > 0 ? 'pre-stretch' : 'workout');
  };

  // Finds the adjacent partner index sharing the same superset group, if any.
  const findSupersetPartnerIndex = (index: number, te: TemplateExercise): number | undefined => {
    if (!template || !te.isSuperset || te.supersetGroupId == null) return undefined;
    return [index - 1, index + 1].find((i) => {
      const partner = template.exercises[i];
      return partner?.isSuperset && partner.supersetGroupId === te.supersetGroupId;
    });
  };

  const handleSkipExercise = () => {
    if (!template || isWorkingThroughSkipped) return;
    const currTE = template.exercises[currentExerciseIndex];

    haptics.light();

    // Defer a whole superset pair together — the two halves depend on each
    // other (handleSetLogged alternates between them by adjacent index), so
    // deferring just one would strand its partner mid-pair. Only the pair's
    // first index goes into skippedIndices; resuming there naturally carries
    // through to the second half via the normal pair-alternation logic.
    const partnerIdx = findSupersetPartnerIndex(currentExerciseIndex, currTE);
    const deferIndex = partnerIdx != null ? Math.min(currentExerciseIndex, partnerIdx) : currentExerciseIndex;
    const resumeAt = (partnerIdx != null ? Math.max(currentExerciseIndex, partnerIdx) : currentExerciseIndex) + 1;

    const newSkipped = [...skippedIndices, deferIndex];
    const isLastMain = resumeAt >= template.exercises.length;

    if (!isLastMain) {
      setSkippedIndices(newSkipped);
      if (resumeAt === currentExerciseIndex + 1) {
        nextExercise();
      } else {
        setExerciseAndSet(resumeAt, 1);
      }
    } else {
      // Skipped the last main exercise (or pair) — jump straight to the first deferred one
      const [first, ...rest] = newSkipped;
      setSkippedIndices(rest);
      setIsWorkingThroughSkipped(true);
      setExerciseAndSet(first, 1);
    }
  };

  // Outright skip — won't be revisited this session, unlike "Skip for now"
  // above. Recorded in skipNotes so it shows up on the session afterward.
  const handleSkipExerciseEntirely = () => {
    if (!template) return;
    const currTE = template.exercises[currentExerciseIndex];
    const exName = exerciseMap.get(currTE.exerciseId)?.name ?? currTE.exerciseId;

    haptics.light();

    const partnerIdx = findSupersetPartnerIndex(currentExerciseIndex, currTE);
    const resumeAt = (partnerIdx != null ? Math.max(currentExerciseIndex, partnerIdx) : currentExerciseIndex) + 1;
    const partnerName = partnerIdx != null
      ? exerciseMap.get(template.exercises[partnerIdx].exerciseId)?.name ?? template.exercises[partnerIdx].exerciseId
      : null;

    setSkipNotes((notes) => [
      ...notes,
      partnerName ? `Skipped: ${exName} + ${partnerName} (superset)` : `Skipped: ${exName}`,
    ]);

    if (isWorkingThroughSkipped) {
      if (skippedIndices.length > 0) {
        const [first, ...rest] = skippedIndices;
        setSkippedIndices(rest);
        setExerciseAndSet(first, 1);
      } else {
        void finishWorkout();
      }
      return;
    }

    if (resumeAt < template.exercises.length) {
      setExerciseAndSet(resumeAt, 1);
    } else if (skippedIndices.length > 0) {
      const [first, ...rest] = skippedIndices;
      setSkippedIndices(rest);
      setIsWorkingThroughSkipped(true);
      setExerciseAndSet(first, 1);
    } else {
      void finishWorkout();
    }
  };

  // True end of the stretch phase — for post-stretch this is also the true
  // end of the session, so it's where any skip notes accumulated during
  // post-stretch (on top of whatever finishWorkout already saved) get
  // persisted.
  const finishStretchPhase = async () => {
    setStretchIndex(0);
    setSkippedStretchIndices([]);
    setIsWorkingThroughSkippedStretches(false);
    if (phase === 'pre-stretch') {
      setPhase('workout');
    } else {
      if (skipNotes.length > 0) await persistSessionNotes(skipNotes.join(' · '));
      setSkipNotes([]);
      setPhase('complete');
    }
  };

  // Shared "what's next" step for the stretch walkthrough — used by the
  // normal Done flow and by defer/skip so they all converge on the same
  // deferred-queue-then-next-phase logic. `skippedList` lets a caller that
  // just mutated the deferred queue pass the up-to-date array directly,
  // since the setSkippedStretchIndices call above it hasn't flushed yet.
  const advanceStretch = (list: typeof dayStretches.pre, skippedList: number[] = skippedStretchIndices) => {
    if (isWorkingThroughSkippedStretches) {
      if (skippedList.length > 0) {
        const [first, ...rest] = skippedList;
        setSkippedStretchIndices(rest);
        setStretchIndex(first);
      } else {
        void finishStretchPhase();
      }
      return;
    }
    if (stretchIndex < list.length - 1) {
      setStretchIndex((i) => i + 1);
    } else if (skippedList.length > 0) {
      const [first, ...rest] = skippedList;
      setSkippedStretchIndices(rest);
      setIsWorkingThroughSkippedStretches(true);
      setStretchIndex(first);
    } else {
      void finishStretchPhase();
    }
  };

  const handleStretchNext = () => {
    const list = phase === 'pre-stretch' ? dayStretches.pre : dayStretches.post;
    advanceStretch(list);
  };

  // Defer — comes back later, once the rest of this stretch list is done.
  const handleDeferStretch = () => {
    if (isWorkingThroughSkippedStretches) return;
    haptics.light();
    const list = phase === 'pre-stretch' ? dayStretches.pre : dayStretches.post;
    const nextSkipped = [...skippedStretchIndices, stretchIndex];
    setSkippedStretchIndices(nextSkipped);
    advanceStretch(list, nextSkipped);
  };

  // Outright skip — won't be revisited, recorded in skipNotes.
  const handleSkipStretchEntirely = () => {
    const list = phase === 'pre-stretch' ? dayStretches.pre : dayStretches.post;
    const assignment = list[stretchIndex];
    const stretchName = stretchExMap.get(assignment?.exerciseId ?? '')?.name ?? assignment?.exerciseId ?? '';
    const phaseLabel = phase === 'pre-stretch' ? 'pre-workout' : 'post-workout';

    haptics.light();
    setSkipNotes((notes) => [...notes, `Skipped stretch: ${stretchName} (${phaseLabel})`]);
    advanceStretch(list);
  };

  const handleSetLogged = async (activeSet: ActiveSet, _isPR: boolean) => {
    if (!template) return;

    if (activeSet.isWarmup) {
      // Warmup sets don't count toward the set number or touch superset/PR
      // logic — just a shorter breather (half the exercise's normal rest)
      // before logging the next one for the same exercise.
      logSetSilent(activeSet);
      const currTE = effectiveTEAt(currentExerciseIndex);
      const currEx = exerciseMap.get(currTE.exerciseId);
      setRestLabel(`Warm-up done · ${currEx?.name ?? ''}`);
      setRestNextExercise(currEx ?? null);
      if (currEx) {
        setRestNextTarget({
          weight: currTE.isBodyweight ? null : await targetWeightFor(currTE, currentSetNumber),
          reps: currTE.repRange,
        });
      } else {
        setRestNextTarget(null);
      }
      startRestTimer(Math.round(currTE.restSeconds / 2));
      return;
    }

    const currTE = effectiveTEAt(currentExerciseIndex);
    const nextTE = currentExerciseIndex + 1 < template.exercises.length ? effectiveTEAt(currentExerciseIndex + 1) : undefined;
    const prevTE = currentExerciseIndex > 0 ? effectiveTEAt(currentExerciseIndex - 1) : undefined;

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

    if (isFirstInPair && nextTE) {
      logSetSilent(activeSet);
      const partnerEx = exerciseMap.get(nextTE.exerciseId);
      const partnerName = partnerEx?.name ?? '';
      setRestLabel(`${partnerName} — Set ${currentSetNumber}`);
      setRestNextExercise(partnerEx ?? null);
      if (partnerEx) {
        setRestNextTarget({
          weight: nextTE.isBodyweight ? null : await targetWeightFor(nextTE, currentSetNumber),
          reps: nextTE.repRange,
        });
      } else {
        setRestNextTarget(null);
      }
      setExerciseAndSet(currentExerciseIndex + 1, currentSetNumber);
      return;
    }

    if (isSecondInPair && prevTE) {
      logSetSilent(activeSet);
      const isLastSetOfPair = isLastSet;
      const partnerExerciseA = exerciseMap.get(prevTE.exerciseId);
      const partnerExerciseB = exerciseMap.get(currTE.exerciseId);

      if (!isLastSetOfPair) {
        const aName = exerciseMap.get(prevTE.exerciseId)?.name ?? '';
        setRestLabel(`Set ${currentSetNumber + 1} · ${aName} → ${exerciseMap.get(currTE.exerciseId)?.name ?? ''}`);
        setRestNextExercise(partnerExerciseA ?? null);
        if (partnerExerciseA) {
          setRestNextTarget({
            weight: prevTE.isBodyweight ? null : await targetWeightFor(prevTE, currentSetNumber + 1),
            reps: prevTE.repRange,
          });
        } else {
          setRestNextTarget(null);
        }
        setExerciseAndSet(currentExerciseIndex - 1, currentSetNumber + 1);
        const restSecs = currTE.restSeconds;
        startRestTimer(restSecs);
      } else {
        const queueEntries: FeelingEntry[] = [];
        const sid = sessionId ?? '';
        if (partnerExerciseA) {
          const prefA = prefsMap.get(partnerExerciseA.id);
          queueEntries.push({
            exerciseId: partnerExerciseA.id,
            exercise: partnerExerciseA,
            startingWeightKg: await targetWeightFor(prevTE, 1),
            startingReps: prefA?.startingReps ?? prevTE.repRange[0],
            sessionId: sid,
          });
        }
        if (partnerExerciseB) {
          const prefB = prefsMap.get(partnerExerciseB.id);
          queueEntries.push({
            exerciseId: partnerExerciseB.id,
            exercise: partnerExerciseB,
            startingWeightKg: await targetWeightFor(currTE, 1),
            startingReps: prefB?.startingReps ?? currTE.repRange[0],
            sessionId: sid,
          });
        }

        const hasMoreMain = !isLastMainExercise && !isWorkingThroughSkipped;
        const hasMoreDeferred = skippedIndices.length > 0;

        if (hasMoreMain) {
          const nextNonSupersetEx = effectiveTEAt(currentExerciseIndex + 1);
          const nextEx = exerciseMap.get(nextNonSupersetEx.exerciseId);
          const nextName = nextEx?.name ?? '';
          setRestLabel(`Next: ${nextName}`);
          setRestNextExercise(nextEx ?? null);
          if (nextEx) {
            setRestNextTarget({
              weight: nextNonSupersetEx.isBodyweight ? null : await targetWeightFor(nextNonSupersetEx, 1),
              reps: nextNonSupersetEx.repRange,
            });
          } else {
            setRestNextTarget(null);
          }
          nextExercise();
        } else if (hasMoreDeferred) {
          const [first, ...rest] = skippedIndices;
          const firstSkippedTE = effectiveTEAt(first);
          const nextEx = exerciseMap.get(firstSkippedTE.exerciseId);
          setRestLabel(`Next: ${nextEx?.name ?? ''} (deferred)`);
          setRestNextExercise(nextEx ?? null);
          if (nextEx) {
            setRestNextTarget({
              weight: firstSkippedTE.isBodyweight ? null : await targetWeightFor(firstSkippedTE, 1),
              reps: firstSkippedTE.repRange,
            });
          } else {
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

        const restSecs = currTE.restSeconds;
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
      const nextTeEntry = effectiveTEAt(currentExerciseIndex + 1);
      label = `Next: ${exerciseMap.get(nextTeEntry.exerciseId)?.name ?? ''}`;
    } else if (hasMoreDeferred) {
      label = `Next: ${exerciseMap.get(effectiveTEAt(skippedIndices[0]).exerciseId)?.name ?? ''} (deferred)`;
    } else {
      label = "That's the last set — cool down time";
    }
    setRestLabel(label);

    // Set next exercise info for rest screen
    if (!isLastSet) {
      const currEx = exerciseMap.get(currTE.exerciseId);
      setRestNextExercise(currEx ?? null);
      if (currEx) {
        setRestNextTarget({
          weight: currTE.isBodyweight ? null : await targetWeightFor(currTE, currentSetNumber + 1),
          reps: currTE.repRange,
        });
      } else {
        setRestNextTarget(null);
      }
    } else if (hasMoreMain) {
      const nextTeEntry = effectiveTEAt(currentExerciseIndex + 1);
      const nextEx = exerciseMap.get(nextTeEntry.exerciseId);
      setRestNextExercise(nextEx ?? null);
      if (nextEx) {
        setRestNextTarget({
          weight: nextTeEntry.isBodyweight ? null : await targetWeightFor(nextTeEntry, 1),
          reps: nextTeEntry.repRange,
        });
      } else {
        setRestNextTarget(null);
      }
    } else if (hasMoreDeferred) {
      const nextSkippedTE = effectiveTEAt(skippedIndices[0]);
      const nextEx = exerciseMap.get(nextSkippedTE.exerciseId);
      setRestNextExercise(nextEx ?? null);
      if (nextEx) {
        setRestNextTarget({
          weight: nextSkippedTE.isBodyweight ? null : await targetWeightFor(nextSkippedTE, 1),
          reps: nextSkippedTE.repRange,
        });
      } else {
        setRestNextTarget(null);
      }
    } else {
      setRestNextExercise(null);
      setRestNextTarget(null);
    }

    if (!isLastSet) {
      incrementSetNumber();
      startRestTimer(currTE.restSeconds);
    } else {
      const exercise = exerciseMap.get(currTE.exerciseId) ?? staticExerciseMap.get(currTE.exerciseId);
      const restSecs = currTE.restSeconds;

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
          startingWeightKg: await targetWeightFor(currTE, 1),
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
      <>
        <WorkoutPreview
          template={template}
          exerciseMap={exerciseMap}
          dayStretches={dayStretches}
          stretchExMap={stretchExMap}
          prefsMap={prefsMap}
          onBegin={handleStartWorkout}
          onBack={() => navigate(-1)}
        />
      </>
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
        assignment={assignment}
        index={stretchIndex}
        total={list.length}
        phase="pre"
        nextStretch={nextStretchEx}
        nextAssignment={nextAssignment}
        onNext={handleStretchNext}
        onDefer={!isWorkingThroughSkippedStretches ? handleDeferStretch : undefined}
        onSkipEntirely={handleSkipStretchEntirely}
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
        assignment={assignment}
        index={stretchIndex}
        total={list.length}
        phase="post"
        nextStretch={nextStretchEx}
        nextAssignment={nextAssignment}
        onNext={handleStretchNext}
        onDefer={!isWorkingThroughSkippedStretches ? handleDeferStretch : undefined}
        onSkipEntirely={handleSkipStretchEntirely}
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

  const activeSwap = sessionSwaps.get(currentExerciseIndex);
  const effectiveTE = activeSwap
    ? {
        ...currentTemplateExercise, ...activeSwap,
        isBodyweight: activeSwap.isBodyweight ?? currentTemplateExercise.isBodyweight,
        isTimed: activeSwap.isTimed ?? currentTemplateExercise.isTimed,
      }
    : currentTemplateExercise;
  const effectiveExercise = activeSwap
    ? (exerciseMap.get(activeSwap.exerciseId) ?? currentExercise)
    : currentExercise;

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
              {(currentTemplateExercise.substitutes?.length ?? 0) > 0 && (
                <button
                  onClick={() => setSwapSheetOpen(true)}
                  className="font-body"
                  style={{ fontSize: 'var(--text-meta)', color: activeSwap ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                >
                  {activeSwap ? 'Swapped' : 'Swap'}
                </button>
              )}
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
                      {te.sets} × {formatRepRange(te.repRange[0], te.repRange[1], te.isTimed)}
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

      {activeSwap && (
        <button
          onClick={() => setSessionSwaps(m => { const next = new Map(m); next.delete(currentExerciseIndex); return next; })}
          className="font-body px-4 py-1"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-faint)', borderBottom: 'var(--border-thin)', width: '100%', textAlign: 'left' }}
        >
          ↩ Undo swap — back to {exerciseMap.get(currentTemplateExercise.exerciseId)?.name ?? currentTemplateExercise.exerciseId}
        </button>
      )}

      <SetLogger
        templateExercise={effectiveTE}
        exercise={effectiveExercise ?? currentExercise}
        setNumber={currentSetNumber}
        totalSets={currentTemplateExercise.sets}
        sessionId={sessionId ?? ''}
        onSetLogged={handleSetLogged}
        onSkip={!isWorkingThroughSkipped ? handleSkipExercise : undefined}
        onSkipEntirely={handleSkipExerciseEntirely}
      />

      {swapSheetOpen && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setSwapSheetOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex flex-col"
            style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-surface)', borderRadius: '6px 6px 0 0' }}>
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: 'var(--border-thin)' }}>
              <p className="font-body font-medium" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                Substitutes
              </p>
              <button onClick={() => setSwapSheetOpen(false)} style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-h2)', lineHeight: 1 }}>✕</button>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2 pb-8">
              {currentTemplateExercise.substitutes?.map((sub) => {
                const subEx = exerciseMap.get(sub.exerciseId);
                const isActive = activeSwap?.exerciseId === sub.exerciseId;
                return (
                  <button
                    key={sub.exerciseId}
                    onClick={() => { setSessionSwaps(m => new Map(m).set(currentExerciseIndex, sub)); setSwapSheetOpen(false); }}
                    className="flex items-start gap-3 p-3 text-left w-full"
                    style={{
                      background: isActive ? 'var(--color-accent-dim)' : 'var(--color-surface-2)',
                      border: isActive ? '1px solid var(--color-accent)' : 'var(--border-thin)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-body" style={{ fontSize: 'var(--text-body)', color: isActive ? 'var(--color-accent)' : 'var(--color-text)' }}>
                        {subEx?.name ?? sub.exerciseId}
                      </p>
                      <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
                        {sub.sets}×{formatRepRange(sub.repRange[0], sub.repRange[1])}
                        {' · '}{sub.startingWeightKg > 0 ? `${toDisplay(sub.startingWeightKg)}${unit}` : 'BW'}
                        {' · '}{sub.restSeconds}s
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function formatRepRange(min: number, max: number, isTimed = false): string {
  const unit = isTimed ? 's' : ' reps';
  return min === max ? `${min}${unit}` : `${min}–${max}${unit}`;
}
