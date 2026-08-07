import { useAuth } from '@/context/AuthContext';
import { toDisplayWeight, toStorageWeight, formatWeight } from '@/lib/units';
import type { WeightUnit } from '@/lib/auth';

// Thin wrapper around AuthContext's weight-unit preference — the single
// place components reach for to convert/format weights. Defaults to 'kg'
// (the canonical storage unit) if no user is signed in yet.
export function useUnit() {
  const { user, setWeightUnit } = useAuth();
  const unit: WeightUnit = user?.weightUnit ?? 'kg';

  return {
    unit,
    setUnit: setWeightUnit,
    toDisplay: (kg: number) => toDisplayWeight(kg, unit),
    toKg: (displayValue: number) => toStorageWeight(displayValue, unit),
    formatWeight: (kg: number) => formatWeight(kg, unit),
  };
}
