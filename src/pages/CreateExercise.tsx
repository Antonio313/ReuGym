import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { ArrowLeft, Trash } from '@phosphor-icons/react';
import { createExercise, updateExercise, deleteCustomExercise, isStaticExercise, useExercises } from '@/hooks/useExercises';
import type { ExerciseCategory, ExerciseType, MuscleGroup } from '@/types';

// ─── Schema ─────────────────────────────────────────────────────

const schema = z.object({
  name:             z.string().min(1, 'Name is required').max(60),
  category:         z.enum(['push', 'pull', 'legs', 'core', 'glutes', 'back']),
  type:             z.enum(['compound', 'accessory', 'plyo', 'isometric']),
  muscles:          z.array(z.string()).min(1, 'Select at least one muscle group'),
  repRangeMin:      z.number().int().min(1).max(9999),
  repRangeMax:      z.number().int().min(1).max(9999),
  isBodyweight:     z.boolean(),
  isTimed:          z.boolean(),
  startingWeightKg: z.number().min(0),
  restSeconds:      z.number().int().min(15).max(600),
  notes:            z.string().max(200).optional(),
  videoUrl:         z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Constants ──────────────────────────────────────────────────

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'push',   label: 'Push' },
  { value: 'pull',   label: 'Pull' },
  { value: 'legs',   label: 'Legs' },
  { value: 'core',   label: 'Core' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'back',   label: 'Back' },
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
  const { exerciseId } = useParams<{ exerciseId?: string }>();
  const returnTo = searchParams.get('returnTo');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEditMode = exerciseId !== undefined;

  // In edit mode, find the exercise to pre-populate
  const allExercises = useExercises();
  const existingExercise = isEditMode ? allExercises.find((e) => e.id === exerciseId) : undefined;
  const isBuiltIn = isEditMode && exerciseId ? isStaticExercise(exerciseId) : false;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
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
      isTimed:          false,
      startingWeightKg: 0,
      restSeconds:      60,
    },
  });

  // Populate form when editing an existing exercise
  useEffect(() => {
    if (existingExercise) {
      reset({
        name:             existingExercise.name,
        category:         existingExercise.category,
        type:             existingExercise.type,
        muscles:          existingExercise.muscles,
        repRangeMin:      existingExercise.defaultRepRange[0],
        repRangeMax:      existingExercise.defaultRepRange[1],
        isBodyweight:     existingExercise.isBodyweight,
        isTimed:          existingExercise.isTimed ?? false,
        startingWeightKg: existingExercise.startingWeightKg,
        restSeconds:      existingExercise.restSeconds,
        notes:            existingExercise.notes ?? '',
        videoUrl:         existingExercise.videoUrl ?? '',
      });
    }
  }, [existingExercise, reset]);

  const isBodyweight = watch('isBodyweight');
  const isTimed = watch('isTimed');
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
      const exercise = {
        id:               isEditMode ? exerciseId! : nanoid(),
        name:             data.name,
        category:         data.category,
        type:             data.type,
        muscles:          data.muscles as MuscleGroup[],
        defaultRepRange:  [data.repRangeMin, data.repRangeMax] as [number, number],
        startingWeightKg: data.isBodyweight ? 0 : data.startingWeightKg,
        restSeconds:      data.restSeconds,
        isBodyweight:     data.isBodyweight,
        isTimed:          data.isTimed || undefined,
        isCable:          existingExercise?.isCable,
        notes:            data.notes || undefined,
        videoUrl:         data.videoUrl || undefined,
      };

      if (isEditMode) {
        await updateExercise(exercise);
      } else {
        await createExercise(exercise);
      }
      navigate(returnTo ?? (isEditMode ? `/exercise/${exerciseId}` : '/exercises'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!exerciseId) return;
    // Remove the override — static defaults take effect again
    await deleteCustomExercise(exerciseId);
    navigate(`/exercise/${exerciseId}`);
  };

  const handleDelete = async () => {
    if (!exerciseId) return;
    await deleteCustomExercise(exerciseId);
    navigate('/exercises');
  };

  if (isEditMode && !existingExercise) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4 px-4"
        style={{ background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Exercise not found.</p>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--color-accent)' }}>← Back</button>
      </div>
    );
  }

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
        <span className="font-display flex-1 min-w-0 truncate" style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)' }}>
          {isEditMode ? 'EDIT EXERCISE' : 'NEW EXERCISE'}
        </span>
        {/* Delete button — only for custom (non-built-in) exercises */}
        {isEditMode && !isBuiltIn && (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="font-body"
                style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="font-body font-medium"
                style={{ fontSize: 'var(--text-meta)', color: 'var(--color-regression)' }}
              >
                Delete
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={{ color: 'var(--color-text-faint)' }}
              aria-label="Delete exercise"
            >
              <Trash size={20} />
            </button>
          )
        )}
      </header>

      {/* Built-in exercise notice */}
      {isEditMode && isBuiltIn && (
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: 'var(--color-surface)', borderBottom: 'var(--border-thin)' }}
        >
          <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
            Built-in exercise — edits create a custom override
          </p>
        </div>
      )}

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

        {/* Rep range / duration */}
        <div>
          <FieldLabel>{isTimed ? 'Target duration (seconds)' : 'Default rep range'}</FieldLabel>
          <div className="flex items-center gap-3">
            <input
              {...register('repRangeMin', { valueAsNumber: true })}
              type="number"
              inputMode="numeric"
              min={1}
              max={9999}
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
              max={9999}
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
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>
              {isTimed ? 'sec' : 'reps'}
            </span>
          </div>
          <FieldError message={errors.repRangeMin?.message ?? errors.repRangeMax?.message} />
        </div>

        {/* Bodyweight toggle + starting weight */}
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
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>
                  kg
                </span>
              </div>
              <FieldError message={errors.startingWeightKg?.message} />
            </div>
          )}
        </div>

        {/* Timed exercise toggle */}
        <div>
          <FieldLabel>Exercise tracking</FieldLabel>
          <Controller
            name="isTimed"
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
                  Timed exercise (uses stopwatch instead of rep counter)
                </span>
              </div>
            )}
          />
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

        {/* Reference video URL */}
        <div>
          <FieldLabel>Reference video URL <span style={{ color: 'var(--color-text-faint)' }}>(optional)</span></FieldLabel>
          <input
            {...register('videoUrl')}
            type="url"
            inputMode="url"
            placeholder="YouTube or TikTok URL"
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
          <FieldError message={errors.videoUrl?.message} />
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
          {saving ? 'Saving…' : isEditMode ? 'Save Changes' : 'Save Exercise'}
        </button>

        {/* Reset to defaults — only shown for built-in exercises that have been overridden */}
        {isEditMode && isBuiltIn && (
          <button
            type="button"
            onClick={handleReset}
            className="w-full py-3 font-body"
            style={{ fontSize: 'var(--text-meta)', color: 'var(--color-regression)' }}
          >
            Reset to defaults
          </button>
        )}

      </form>
    </div>
  );
}
