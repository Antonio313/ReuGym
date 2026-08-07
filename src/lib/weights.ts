// Single source of truth for "starting weight" so displays that show it
// (SetLogger's default field, the rest-timer's "Next" preview, the feeling
// meter) can never drift apart. Exercise-level prefs act as a floor over the
// per-template value, since prefs are what actually gets updated as you progress.
export function resolveStartingWeight(templateWeightKg: number, prefWeightKg?: number): number {
  return Math.max(prefWeightKg ?? 0, templateWeightKg);
}
