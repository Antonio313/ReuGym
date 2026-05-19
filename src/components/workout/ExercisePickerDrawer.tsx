import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { exercises } from '@/data/exercises';
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
};

export function ExercisePickerDrawer({ open, onClose, onSelect, excludeIds }: Props) {
  const excludeSet = new Set(excludeIds);

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
          {CATEGORY_ORDER.map((cat) => {
            const catExercises = exercises.filter((e) => e.category === cat);
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
