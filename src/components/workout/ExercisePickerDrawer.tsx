import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useExercises } from '@/hooks/useExercises';
import { useUnit } from '@/hooks/useUnit';
import type { ExerciseCategory } from '@/types';

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  push:    'PUSH',
  pull:    'PULL',
  legs:    'LEGS',
  core:    'CORE',
  glutes:  'GLUTES',
  back:    'BACK',
  general: 'GENERAL',
};

const CATEGORY_ORDER: ExerciseCategory[] = ['push', 'pull', 'legs', 'core', 'glutes', 'back'];

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (exerciseId: string) => void;
  excludeIds: string[];
  returnTo?: string; // passed to create page so it knows where to come back
};

export function ExercisePickerDrawer({ open, onClose, onSelect, excludeIds, returnTo }: Props) {
  const navigate = useNavigate();
  const allExercises = useExercises().filter((e) => !e.isStretch);
  const excludeSet = new Set(excludeIds);
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? allExercises.filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()))
    : allExercises;

  const handleCreate = () => {
    onClose();
    const params = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
    navigate(`/exercise/new${params}`);
  };

  return (
    <Drawer open={open} onClose={onClose}>
      <DrawerContent
        style={{ background: 'var(--color-surface)', maxHeight: '85dvh' }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="px-4 pt-4 pb-2">
          <DrawerTitle
            className="font-display text-left"
            style={{ fontSize: 'var(--text-h1)', color: 'var(--color-text)' }}
          >
            ADD EXERCISE
          </DrawerTitle>
        </DrawerHeader>

        {/* Search */}
        <div className="px-4 pb-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises…"
            className="w-full px-3 py-2 rounded-md font-body"
            style={{
              background: 'var(--color-surface-2)',
              border: 'var(--border-thin)',
              color: 'var(--color-text)',
              fontSize: 'var(--text-body)',
              outline: 'none',
            }}
          />
        </div>

        <div className="overflow-y-auto px-4 pb-8">
          {/* Create new exercise shortcut */}
          <button
            onClick={handleCreate}
            className="flex w-full items-center gap-2 py-3 mb-4"
            style={{
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-dim)',
              border: '1px solid var(--color-accent)',
              padding: '0.75rem 1rem',
              color: 'var(--color-accent)',
            }}
          >
            <Plus size={16} weight="bold" />
            <span className="font-body font-medium" style={{ fontSize: 'var(--text-body)' }}>
              Create new exercise…
            </span>
          </button>

          {search.trim() ? (
            filtered.length === 0 ? (
              <p className="px-1 py-8 text-center font-body" style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-body)' }}>
                No exercises found
              </p>
            ) : (
              filtered.map((ex) => (
                <ExerciseRow key={ex.id} exercise={ex} already={excludeSet.has(ex.id)} onSelect={() => { onSelect(ex.id); onClose(); }} />
              ))
            )
          ) : (
            CATEGORY_ORDER.map((cat) => {
              const catExercises = allExercises.filter((e) => e.category === cat);
              if (catExercises.length === 0) return null;
              return (
                <div key={cat} className="mb-6">
                  <p
                    className="font-body font-medium uppercase tracking-widest mb-2 sticky top-0 py-1"
                    style={{
                      fontSize: 'var(--text-micro)',
                      color: 'var(--color-accent)',
                      background: 'var(--color-surface)',
                    }}
                  >
                    {CATEGORY_LABELS[cat]}
                  </p>
                  {catExercises.map((ex) => (
                    <ExerciseRow key={ex.id} exercise={ex} already={excludeSet.has(ex.id)} onSelect={() => { onSelect(ex.id); onClose(); }} />
                  ))}
                </div>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ExerciseRow({
  exercise, already, onSelect,
}: {
  exercise: ReturnType<typeof useExercises>[number];
  already: boolean;
  onSelect: () => void;
}) {
  const { unit, toDisplay } = useUnit();
  return (
    <button
      disabled={already}
      onClick={onSelect}
      className="flex w-full items-center justify-between py-3 text-left"
      style={{ borderBottom: 'var(--border-thin)', opacity: already ? 0.35 : 1 }}
    >
      <span>
        <span
          className="font-body block"
          style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}
        >
          {exercise.name}
        </span>
        <span
          className="font-mono"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          {exercise.defaultRepRange ? `${exercise.defaultRepRange[0]}–${exercise.defaultRepRange[1]} reps` : ''}
          {exercise.isBodyweight ? ' · Bodyweight' : exercise.startingWeightKg ? ` · ${toDisplay(exercise.startingWeightKg)}${unit} start` : ''}
          {exercise.notes ? ` · ${exercise.notes}` : ''}
        </span>
      </span>
      {already && (
        <span
          className="font-body uppercase"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-faint)' }}
        >
          Added
        </span>
      )}
    </button>
  );
}
