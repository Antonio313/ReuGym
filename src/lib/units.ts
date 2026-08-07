import type { WeightUnit } from '@/lib/auth';

const LB_PER_KG = 2.2046226218;

export function kgToLbs(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbsToKg(lbs: number): number {
  return lbs / LB_PER_KG;
}

// Rounds to 1 decimal place without forcing a trailing .0 (40 stays 40, not 40.0).
function roundDisplay(n: number): number {
  return Math.round(n * 10) / 10;
}

// kg (canonical storage unit) -> the number to show for the given display unit.
export function toDisplayWeight(kg: number, unit: WeightUnit): number {
  return roundDisplay(unit === 'lbs' ? kgToLbs(kg) : kg);
}

// The number a user typed/see in `unit` -> kg for storage.
export function toStorageWeight(displayValue: number, unit: WeightUnit): number {
  return unit === 'lbs' ? lbsToKg(displayValue) : displayValue;
}

// Convenience for the common "40kg" / "88.2lbs" inline string pattern.
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${toDisplayWeight(kg, unit)}${unit}`;
}
