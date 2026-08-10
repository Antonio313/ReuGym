// Single source of truth for "starting weight" so displays that show it
// (SetLogger's default field, the rest-timer's "Next" preview, the feeling
// meter) can never drift apart. Exercise-level prefs take precedence over the
// per-template value once one exists, since prefs are what actually gets
// updated (up or down) as you progress — the template value is only a
// fallback for exercises with no saved pref yet.
export function resolveStartingWeight(templateWeightKg: number, prefWeightKg?: number): number {
  return prefWeightKg ?? templateWeightKg;
}
