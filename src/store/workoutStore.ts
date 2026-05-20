import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkoutTemplate, ActiveSet, SessionStatus } from '../types';

type WorkoutStore = {
  status: SessionStatus;
  activeTemplate: WorkoutTemplate | null;
  sessionId: string | null;
  sessionStartedAt: number;
  currentExerciseIndex: number;
  currentSetNumber: number;
  loggedSets: ActiveSet[];

  restSecondsRemaining: number;
  restTotalSeconds: number;
  restTimerActive: boolean;
  restEndTimestamp: number | null;

  startSession: (template: WorkoutTemplate, sessionId: string, startedAt: number) => void;
  logSet: (set: ActiveSet) => void;
  nextExercise: () => void;
  incrementSetNumber: () => void;
  setExerciseAndSet: (index: number, setNumber: number) => void;
  startRestTimer: (seconds: number) => void;
  tickRestTimer: () => void;
  setRestSeconds: (n: number) => void;
  skipRestTimer: () => void;
  completeSession: () => void;
  resetSession: () => void;
};

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      status: 'idle',
      activeTemplate: null,
      sessionId: null,
      sessionStartedAt: 0,
      currentExerciseIndex: 0,
      currentSetNumber: 1,
      loggedSets: [],
      restSecondsRemaining: 0,
      restTotalSeconds: 0,
      restTimerActive: false,
      restEndTimestamp: null,

      startSession: (template, sessionId, startedAt) => set({
        status: 'active',
        activeTemplate: template,
        sessionId,
        sessionStartedAt: startedAt,
        currentExerciseIndex: 0,
        currentSetNumber: 1,
        loggedSets: [],
        restSecondsRemaining: 0,
        restTimerActive: false,
        restEndTimestamp: null,
      }),

      logSet: (newSet) => set((state) => ({
        loggedSets: [...state.loggedSets, newSet],
        status: 'resting',
      })),

      nextExercise: () => set((state) => ({
        currentExerciseIndex: state.currentExerciseIndex + 1,
        currentSetNumber: 1,
      })),

      incrementSetNumber: () => set((state) => ({ currentSetNumber: state.currentSetNumber + 1 })),

      setExerciseAndSet: (index, setNumber) => set({ currentExerciseIndex: index, currentSetNumber: setNumber, status: 'active' }),

      startRestTimer: (seconds) => set({
        restSecondsRemaining: seconds,
        restTotalSeconds: seconds,
        restTimerActive: true,
        restEndTimestamp: Date.now() + seconds * 1000,
      }),

      tickRestTimer: () => {
        const { restEndTimestamp } = get();
        if (restEndTimestamp == null) return;
        const remaining = Math.max(0, Math.ceil((restEndTimestamp - Date.now()) / 1000));
        set({
          restSecondsRemaining: remaining,
          restTimerActive: remaining > 0,
          status: remaining > 0 ? 'resting' : 'active',
        });
      },

      setRestSeconds: (n) => set({ restSecondsRemaining: n }),

      skipRestTimer: () => set({
        restSecondsRemaining: 0,
        restTimerActive: false,
        restEndTimestamp: null,
        status: 'active',
      }),

      completeSession: () => set({ status: 'complete' }),

      resetSession: () => set({
        status: 'idle',
        activeTemplate: null,
        sessionId: null,
        sessionStartedAt: 0,
        currentExerciseIndex: 0,
        currentSetNumber: 1,
        loggedSets: [],
        restSecondsRemaining: 0,
        restTimerActive: false,
        restEndTimestamp: null,
      }),
    }),
    {
      name: 'reugym-workout',
    },
  ),
);
