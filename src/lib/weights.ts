export const DUMBBELL_WEIGHTS = [
  8, 9, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35,
  37.5, 40, 42.5, 45, 47.5, 50,
];

const MAX_DUMBBELL = DUMBBELL_WEIGHTS[DUMBBELL_WEIGHTS.length - 1];

export function snapToNearestDumbbell(weight: number): number {
  if (weight <= 0) return 0;
  if (weight > MAX_DUMBBELL) return weight;
  return DUMBBELL_WEIGHTS.reduce((a, b) =>
    Math.abs(b - weight) < Math.abs(a - weight) ? b : a,
  );
}

// Single source of truth for "starting weight" so displays that show it
// (SetLogger's default field, the rest-timer's "Next" preview, the feeling
// meter) can never drift apart. Exercise-level prefs act as a floor over the
// per-template value, since prefs are what actually gets updated as you progress.
export function resolveStartingWeight(templateWeightKg: number, prefWeightKg?: number): number {
  return snapToNearestDumbbell(Math.max(prefWeightKg ?? 0, templateWeightKg));
}
