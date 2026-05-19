import { useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useExercises } from '@/hooks/useExercises';
import type { ExerciseCategory } from '@/types';

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  push: 'PUSH',
  pull: 'PULL',
  legs: 'LEGS',
  core: 'CORE',
};

const CATEGORY_ORDER: ExerciseCategory[] = ['push', 'pull', 'legs', 'core'];

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (exerciseId: string) => void;
  excludeIds: string[];
  returnTo?: string; // passed to create page so it knows where to come back
};

export function ExercisePickerDrawer({ open, onClose, onSelect, excludeIds, returnTo }: Props) {
  const navigate = useNavigate();
  const allExercises = useExercises();
  const excludeSet = new Set(excludeIds);

  const handleCreate = () => {
    onClose();
    const params = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
    navigate(`/exercise/new${params}`);
  };

  return (
    <Drawer open={open} onClose={onClose}>
      <DrawerContent
        style={{ background: 'var(--color-surface)', maxHeight: '85dvh' }}
      >
        <DrawerHeader className="px-4 pt-4 pb-2">
          <DrawerTitle
            className="font-display text-left"
            style={{ fontSize: 'var(--text-h1)', color: 'var(--color-text)' }}
          >
            ADD EXERCISE
          </DrawerTitle>
        </DrawerHeader>

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

          {CATEGORY_ORDER.map((cat) => {
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
                {catExercises.map((ex) => {
                  const already = excludeSet.has(ex.id);
                  return (
                    <button
                      key={ex.id}
                      disabled={already}
                      onClick={() => {
                        onSelect(ex.id);
                        onClose();
                      }}
                      className="flex w-full items-center justify-between py-3 text-left"
                      style={{ borderBottom: 'var(--border-thin)', opacity: already ? 0.35 : 1 }}
                    >
                      <span>
                        <span
                          className="font-body block"
                          style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}
                        >
                          {ex.name}
                        </span>
                        <span
                          className="font-mono"
                          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
                        >
                          {ex.defaultRepRange[0]}–{ex.defaultRepRange[1]} reps
                          {ex.isBodyweight ? ' · Bodyweight' : ` · ${ex.startingWeightKg}kg start`}
                          {ex.notes ? ` · ${ex.notes}` : ''}
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
                })}
              </div>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
