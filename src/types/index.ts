// ─── Exercise Library (static, lives in code) ───────────────────

export type ExerciseCategory = 'push' | 'pull' | 'legs' | 'core';
export type ExerciseType = 'compound' | 'accessory' | 'plyo' | 'isometric';
export type MuscleGroup =
  | 'chest' | 'shoulders' | 'triceps'
  | 'back' | 'biceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves'
  | 'core' | 'full-body';

export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  type: ExerciseType;
  muscles: MuscleGroup[];
  defaultRepRange: [number, number];
  startingWeightKg: number;
  restSeconds: number;
  isBodyweight: boolean;
  notes?: string;
};

// ─── Workout Templates (static, lives in code) ──────────────────

export type TemplateExercise = {
  exerciseId: string;
  sets: number;
  repRange: [number, number];
  isSuperset: boolean;
  supersetGroupId?: string;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  category: ExerciseCategory;
  shortLabel: string;
  exercises: TemplateExercise[];
};

// ─── Database Types (stored in IndexedDB via Dexie) ─────────────

export type WorkoutSession = {
  id: string;
  templateId: string;
  startedAt: number;
  completedAt?: number;
  durationSeconds?: number;
  notes?: string;
};

export type LoggedSet = {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rir: number;
  isWarmup: boolean;
  isPR: boolean;
  completedAt: number;
};

export type BodyStat = {
  id: string;
  date: number;
  weightKg?: number;
  waistCm?: number;
  chestCm?: number;
  notes?: string;
};

// ─── UI / Store Types ────────────────────────────────────────────

export type ActiveSet = {
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rir: number;
  isWarmup: boolean;
};

export type SessionStatus = 'idle' | 'active' | 'resting' | 'complete';
