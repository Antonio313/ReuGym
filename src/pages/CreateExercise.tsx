import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { ArrowLeft } from '@phosphor-icons/react';
import { createExercise } from '@/hooks/useExercises';
import type { ExerciseCategory, ExerciseType, MuscleGroup } from '@/types';

// ─── Schema ─────────────────────────────────────────────────────

const schema = z.object({
  name:             z.string().min(1, 'Name is required').max(60),
  category:         z.enum(['push', 'pull', 'legs', 'core']),
  type:             z.enum(['compound', 'accessory', 'plyo', 'isometric']),
  muscles:          z.array(z.string()).min(1, 'Select at least one muscle group'),
  repRangeMin:      z.number().int().min(1).max(100),
  repRangeMax:      z.number().int().min(1).max(100),
  isBodyweight:     z.boolean(),
  startingWeightKg: z.number().min(0),
  restSeconds:      z.number().int().min(15).max(600),
  notes:            z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Constants ──────────────────────────────────────────────────

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'core', label: 'Core' },
];

const TYPES: { value: ExerciseType; label: string }[] = [
  { value: 'compound',  label: 'Compound' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'plyo',      label: 'Plyo' },
  { value: 'isometric', label: 'Isometric' },
];

const MUSCLE_GROUPS: { value: MuscleGroup; label: string }[] = [
  { value: 'chest',      label: 'Chest' },
  { value: 'shoulders',  label: 'Shoulders' },
  { value: 'triceps',    label: 'Triceps' },
  { value: 'back',       label: 'Back' },
  { value: 'biceps',     label: 'Biceps' },
  { value: 'forearms',   label: 'Forearms' },
  { value: 'quads',      label: 'Quads' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'glutes',     label: 'Glutes' },
  { value: 'calves',     label: 'Calves' },
  { value: 'core',       label: 'Core' },
  { value: 'full-body',  label: 'Full Body' },
];

const REST_PRESETS = [45, 60, 90, 120, 150, 180];

// ─── Sub-components ─────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body font-medium uppercase tracking-widest mb-2"
      style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
      {children}
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-regression)' }}>
      {message}
    </p>
  );
}

function PillButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-body px-3 py-1.5"
      style={{
        fontSize: 'var(--text-meta)',
        borderRadius: 'var(--radius-sm)',
        border: active ? '1px solid var(--color-accent)' : 'var(--border-thin)',
        background: active ? 'var(--color-accent-dim)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
      }}
    >
      {children}
    </button>
  );
}

// ─── Page ───────────────────────────────────────────────────────

export default function CreateExercise() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category:         'push',
      type:             'accessory',
      muscles:          [],
      repRangeMin:      8,
      repRangeMax:      12,
      isBodyweight:     false,
      startingWeightKg: 0,
      restSeconds:      60,
    },
  });

  const isBodyweight = watch('isBodyweight');
  const selectedMuscles = watch('muscles');
  const selectedCategory = watch('category');
  const selectedType = watch('type');
  const selectedRest = watch('restSeconds');

  const toggleMuscle = (muscle: string) => {
    const current = selectedMuscles ?? [];
    setValue(
      'muscles',
      current.includes(muscle) ? current.filter((m) => m !== muscle) : [...current, muscle],
      { shouldValidate: true }
    );
  };

  const onSubmit = async (data: FormValues) => {
    setSaving(true);
    try {
      await createExercise({
        id:               nanoid(),
        name:             data.name,
        category:         data.category,
        type:             data.type,
        muscles:          data.muscles as MuscleGroup[],
        defaultRepRange:  [data.repRangeMin, data.repRangeMax],
        startingWeightKg: data.isBodyweight ? 0 : data.startingWeightKg,
        restSeconds:      data.restSeconds,
        isBodyweight:     data.isBodyweight,
        notes:            data.notes || undefined,
      });
      navigate(returnTo ?? '/');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex flex-col min-h-dvh mx-auto"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 sticky top-0 z-40"
        style={{ height: 'var(--header-height)', borderBottom: 'var(--border-thin)', background: 'var(--color-bg)' }}
      >
        <button onClick={() => navigate(-1)} style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft size={22} />
        </button>
        <span className="font-display" style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)' }}>
          NEW EXERCISE
        </span>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 px-4 py-6 pb-12">

        {/* Name */}
        <div>
          <FieldLabel>Exercise name</FieldLabel>
          <input
            {...register('name')}
            placeholder="e.g. Cable Fly"
            className="w-full font-body px-3 py-3"
            style={{
              fontSize: 'var(--text-body)',
              background: 'var(--color-surface)',
              border: 'var(--border-thin)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text)',
              outline: 'none',
            }}
          />
          <FieldError message={errors.name?.message} />
        </div>

        {/* Category */}
        <div>
          <FieldLabel>Category</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(({ value, label }) => (
              <PillButton
                key={value}
                active={selectedCategory === value}
                onClick={() => setValue('category', value)}
              >
                {label}
              </PillButton>
            ))}
          </div>
        </div>

        {/* Type */}
        <div>
          <FieldLabel>Type</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(({ value, label }) => (
              <PillButton
                key={value}
                active={selectedType === value}
                onClick={() => setValue('type', value)}
              >
                {label}
              </PillButton>
            ))}
          </div>
        </div>

        {/* Muscle groups */}
        <div>
          <FieldLabel>Muscle groups</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {MUSCLE_GROUPS.map(({ value, label }) => (
              <PillButton
                key={value}
                active={selectedMuscles?.includes(value) ?? false}
                onClick={() => toggleMuscle(value)}
              >
                {label}
              </PillButton>
            ))}
          </div>
          <FieldError message={errors.muscles?.message} />
        </div>

        {/* Rep range */}
        <div>
          <FieldLabel>Default rep range</FieldLabel>
          <div className="flex items-center gap-3">
            <input
              {...register('repRangeMin', { valueAsNumber: true })}
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              className="w-20 text-center font-mono py-3"
              data-numeric
              style={{
                fontSize: 'var(--text-body)',
                background: 'var(--color-surface)',
                border: 'var(--border-thin)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                outline: 'none',
              }}
            />
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-body)' }}>to</span>
            <input
              {...register('repRangeMax', { valueAsNumber: true })}
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              className="w-20 text-center font-mono py-3"
              data-numeric
              style={{
                fontSize: 'var(--text-body)',
                background: 'var(--color-surface)',
                border: 'var(--border-thin)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                outline: 'none',
              }}
            />
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>reps</span>
          </div>
          <FieldError message={errors.repRangeMin?.message ?? errors.repRangeMax?.message} />
        </div>

        {/* Bodyweight toggle */}
        <div>
          <FieldLabel>Weight</FieldLabel>
          <Controller
            name="isBodyweight"
            control={control}
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => field.onChange(!field.value)}
                  className="relative flex-shrink-0"
                  style={{
                    width: '2.75rem',
                    height: '1.5rem',
                    borderRadius: '9999px',
                    background: field.value ? 'var(--color-accent)' : 'var(--color-surface-2)',
                    border: 'var(--border-thin)',
                    transition: 'background 200ms',
                  }}
                >
                  <span
                    className="absolute top-0.5"
                    style={{
                      left: field.value ? 'calc(100% - 1.25rem)' : '0.25rem',
                      width: '1rem',
                      height: '1rem',
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 200ms',
                    }}
                  />
                </button>
                <span className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                  Bodyweight exercise
                </span>
              </div>
            )}
          />

          {!isBodyweight && (
            <div className="mt-3">
              <p className="font-body mb-2" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
                Starting weight
              </p>
              <div className="flex items-center gap-2">
                <input
                  {...register('startingWeightKg', { valueAsNumber: true })}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  className="w-24 text-center font-mono py-3"
                  data-numeric
                  style={{
                    fontSize: 'var(--text-body)',
                    background: 'var(--color-surface)',
                    border: 'var(--border-thin)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text)',
                    outline: 'none',
                  }}
                />
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>kg</span>
              </div>
              <FieldError message={errors.startingWeightKg?.message} />
            </div>
          )}
        </div>

        {/* Rest time */}
        <div>
          <FieldLabel>Rest time</FieldLabel>
          <div className="flex flex-wrap gap-2 mb-3">
            {REST_PRESETS.map((s) => (
              <PillButton
                key={s}
                active={selectedRest === s}
                onClick={() => setValue('restSeconds', s)}
              >
                {s}s
              </PillButton>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              {...register('restSeconds', { valueAsNumber: true })}
              type="number"
              inputMode="numeric"
              min={15}
              max={600}
              className="w-24 text-center font-mono py-3"
              data-numeric
              style={{
                fontSize: 'var(--text-body)',
                background: 'var(--color-surface)',
                border: 'var(--border-thin)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                outline: 'none',
              }}
            />
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>seconds</span>
          </div>
          <FieldError message={errors.restSeconds?.message} />
        </div>

        {/* Notes */}
        <div>
          <FieldLabel>Notes <span style={{ color: 'var(--color-text-faint)' }}>(optional)</span></FieldLabel>
          <textarea
            {...register('notes')}
            placeholder="e.g. Keep elbows flared, control the negative"
            rows={3}
            className="w-full font-body px-3 py-3 resize-none"
            style={{
              fontSize: 'var(--text-body)',
              background: 'var(--color-surface)',
              border: 'var(--border-thin)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text)',
              outline: 'none',
            }}
          />
          <FieldError message={errors.notes?.message} />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 font-display uppercase tracking-wide"
          style={{
            fontSize: 'var(--text-h2)',
            background: saving ? 'var(--color-surface-2)' : 'var(--color-accent)',
            color: saving ? 'var(--color-text-muted)' : '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
          }}
        >
          {saving ? 'Saving…' : 'Save Exercise'}
        </button>

      </form>
    </div>
  );
}
