import { create } from 'zustand';
import type { WorkoutTemplate, ActiveSet, SessionStatus } from '../types';

type WorkoutStore = {
  status: SessionStatus;
  activeTemplate: WorkoutTemplate | null;
  sessionId: string | null;
  currentExerciseIndex: number;
  currentSetNumber: number;
  loggedSets: ActiveSet[];

  restSecondsRemaining: number;
  restTotalSeconds: number;
  restTimerActive: boolean;

  startSession: (template: WorkoutTemplate, sessionId: string) => void;
  logSet: (set: ActiveSet) => void;
  nextExercise: () => void;
  startRestTimer: (seconds: number) => void;
  tickRestTimer: () => void;
  skipRestTimer: () => void;
  completeSession: () => void;
  resetSession: () => void;
};

export const useWorkoutStore = create<WorkoutStore>((set) => ({
  status: 'idle',
  activeTemplate: null,
  sessionId: null,
  currentExerciseIndex: 0,
  currentSetNumber: 1,
  loggedSets: [],
  restSecondsRemaining: 0,
  restTotalSeconds: 0,
  restTimerActive: false,

  startSession: (template, sessionId) => set({
    status: 'active',
    activeTemplate: template,
    sessionId,
    currentExerciseIndex: 0,
    currentSetNumber: 1,
    loggedSets: [],
  }),

  logSet: (newSet) => set((state) => ({
    loggedSets: [...state.loggedSets, newSet],
    status: 'resting',
  })),

  nextExercise: () => set((state) => ({
    currentExerciseIndex: state.currentExerciseIndex + 1,
    currentSetNumber: 1,
  })),

  startRestTimer: (seconds) => set({
    restSecondsRemaining: seconds,
    restTotalSeconds: seconds,
    restTimerActive: true,
  }),

  tickRestTimer: () => set((state) => {
    const next = state.restSecondsRemaining - 1;
    return {
      restSecondsRemaining: Math.max(0, next),
      restTimerActive: next > 0,
      status: next > 0 ? 'resting' : 'active',
    };
  }),

  skipRestTimer: () => set({
    restSecondsRemaining: 0,
    restTimerActive: false,
    status: 'active',
  }),

  completeSession: () => set({ status: 'complete' }),

  resetSession: () => set({
    status: 'idle',
    activeTemplate: null,
    sessionId: null,
    currentExerciseIndex: 0,
    currentSetNumber: 1,
    loggedSets: [],
    restSecondsRemaining: 0,
    restTimerActive: false,
  }),
}));
