import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { saveStretchToLibrary, deleteStretchFromLibrary } from '@/hooks/useStretchLibrary';
import type { DayStretch } from '@/types';

const REST_PRESETS = [0, 10, 15, 20, 25, 30];

const schema = z.object({
  name:        z.string().min(1, 'Name is required').max(80),
  reps:        z.string().min(1, 'Reps / duration is required').max(40),
  restSeconds: z.number().min(0).max(120),
  note:        z.string().max(200).optional(),
  videoUrl:    z.string().url('Must be a valid URL').or(z.literal('')).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function CreateStretch() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const existing = useLiveQuery(
    () => (id ? db.stretchLibrary.get(id) : Promise.resolve(undefined)),
    [id],
  );

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', reps: '', restSeconds: 15, note: '', videoUrl: '' },
  });

  useEffect(() => {
    if (existing) {
      reset({
        name:        existing.name,
        reps:        existing.reps,
        restSeconds: existing.restSeconds,
        note:        existing.note ?? '',
        videoUrl:    existing.videoUrl ?? '',
      });
    }
  }, [existing, reset]);

  const onSubmit = async (data: FormValues) => {
    const stretch: DayStretch = {
      id:          id ?? nanoid(),
      name:        data.name,
      reps:        data.reps,
      restSeconds: data.restSeconds,
      note:        data.note || undefined,
      videoUrl:    data.videoUrl || undefined,
    };
    await saveStretchToLibrary(stretch);
    navigate('/exercises?tab=stretches');
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteStretchFromLibrary(id);
    navigate('/exercises?tab=stretches');
  };

  return (
    <div
      className="flex flex-col min-h-dvh mx-auto"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}
    >
      <header
        className="flex items-center gap-3 px-4"
        style={{ height: 'var(--header-height)', borderBottom: 'var(--border-thin)' }}
      >
        <button onClick={() => navigate(-1)} style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>
          ← Back
        </button>
        <h1
          className="font-display flex-1"
          style={{ fontSize: 'var(--text-h2)', letterSpacing: '0.05em' }}
        >
          {isEditing ? 'EDIT STRETCH' : 'NEW STRETCH'}
        </h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 px-4 py-6">
        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
            NAME
          </label>
          <input
            {...register('name')}
            placeholder="e.g. Doorway Chest Stretch"
            className="w-full px-3 py-3 font-body rounded-md"
            style={{
              background: 'var(--color-surface)',
              border: 'var(--border-thin)',
              color: 'var(--color-text)',
              fontSize: 'var(--text-body)',
              outline: 'none',
            }}
          />
          {errors.name && (
            <p style={{ color: 'var(--color-regression)', fontSize: 'var(--text-meta)' }}>{errors.name.message}</p>
          )}
        </div>

        {/* Reps / Duration */}
        <div className="flex flex-col gap-1">
          <label className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
            REPS / DURATION
          </label>
          <input
            {...register('reps')}
            placeholder="e.g. 45s/side, 15 reps, 8/side"
            className="w-full px-3 py-3 font-body rounded-md"
            style={{
              background: 'var(--color-surface)',
              border: 'var(--border-thin)',
              color: 'var(--color-text)',
              fontSize: 'var(--text-body)',
              outline: 'none',
            }}
          />
          {errors.reps && (
            <p style={{ color: 'var(--color-regression)', fontSize: 'var(--text-meta)' }}>{errors.reps.message}</p>
          )}
        </div>

        {/* Rest after */}
        <div className="flex flex-col gap-2">
          <label className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
            REST AFTER (SECONDS)
          </label>
          <Controller
            control={control}
            name="restSeconds"
            render={({ field }) => (
              <div className="flex gap-2 flex-wrap">
                {REST_PRESETS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => field.onChange(s)}
                    className="px-4 py-2 rounded-md font-mono"
                    style={{
                      background: field.value === s ? 'var(--color-accent)' : 'var(--color-surface)',
                      color: field.value === s ? '#fff' : 'var(--color-text-muted)',
                      border: field.value === s ? 'none' : 'var(--border-thin)',
                      fontSize: 'var(--text-meta)',
                    }}
                  >
                    {s === 0 ? 'None' : `${s}s`}
                  </button>
                ))}
              </div>
            )}
          />
        </div>

        {/* Note */}
        <div className="flex flex-col gap-1">
          <label className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
            NOTE <span style={{ color: 'var(--color-text-faint)' }}>(optional)</span>
          </label>
          <textarea
            {...register('note')}
            placeholder="Coaching cue or setup note"
            rows={2}
            className="w-full px-3 py-3 font-body rounded-md resize-none"
            style={{
              background: 'var(--color-surface)',
              border: 'var(--border-thin)',
              color: 'var(--color-text)',
              fontSize: 'var(--text-body)',
              outline: 'none',
            }}
          />
        </div>

        {/* Video URL */}
        <div className="flex flex-col gap-1">
          <label className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
            FORM VIDEO URL <span style={{ color: 'var(--color-text-faint)' }}>(optional)</span>
          </label>
          <input
            {...register('videoUrl')}
            placeholder="https://youtube.com/..."
            className="w-full px-3 py-3 font-body rounded-md"
            style={{
              background: 'var(--color-surface)',
              border: 'var(--border-thin)',
              color: 'var(--color-text)',
              fontSize: 'var(--text-body)',
              outline: 'none',
            }}
          />
          {errors.videoUrl && (
            <p style={{ color: 'var(--color-regression)', fontSize: 'var(--text-meta)' }}>{errors.videoUrl.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 font-display rounded-md mt-2"
          style={{
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 'var(--text-h3)',
            letterSpacing: '0.05em',
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          {isEditing ? 'SAVE CHANGES' : 'ADD TO LIBRARY'}
        </button>

        {isEditing && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full py-3 font-body rounded-md"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-regression)',
              color: 'var(--color-regression)',
              fontSize: 'var(--text-body)',
            }}
          >
            Delete stretch
          </button>
        )}
      </form>
    </div>
  );
}
