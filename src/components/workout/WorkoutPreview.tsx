import type { WorkoutTemplate, Exercise, ExercisePref, DayStretch } from '@/types';

type Props = {
  template: WorkoutTemplate;
  exerciseMap: Map<string, Exercise>;
  stretches: { pre: DayStretch[]; post: DayStretch[] };
  prefsMap: Map<string, ExercisePref>;
  onBegin: () => void;
};

function weightLabel(exercise: Exercise, pref: ExercisePref | undefined): string {
  if (exercise.isBodyweight) return 'Bodyweight';
  const w = pref?.startingWeightKg ?? exercise.startingWeightKg;
  if (exercise.isCable) return `Hole ${w}`;
  return `${w}kg`;
}

export function WorkoutPreview({ template, exerciseMap, stretches, prefsMap, onBegin }: Props) {
  return (
    <div
      className="flex flex-col min-h-dvh mx-auto"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}
    >
      {/* Header */}
      <div
        className="px-4 pt-6 pb-4"
        style={{ borderBottom: 'var(--border-thin)' }}
      >
        <p
          className="font-body uppercase tracking-widest mb-1"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          Today's Workout
        </p>
        <h1
          className="font-display"
          style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', color: 'var(--color-text)', letterSpacing: '0.02em' }}
        >
          {template.shortLabel}
        </h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-6" style={{ paddingBottom: '100px' }}>

        {/* Pre-workout stretches */}
        <section>
          <p
            className="font-body uppercase tracking-widest mb-3"
            style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
          >
            Pre-Workout
          </p>
          <div className="flex flex-col gap-1">
            {stretches.pre.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2"
                style={{
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                  {i + 1}. {s.name}
                </span>
                <span className="font-mono" data-numeric style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
                  {s.reps}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Exercises */}
        <section>
          <p
            className="font-body uppercase tracking-widest mb-3"
            style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
          >
            Exercises
          </p>
          <div className="flex flex-col gap-2">
            {template.exercises.map((te, i) => {
              const ex = exerciseMap.get(te.exerciseId);
              if (!ex) return null;
              const pref = prefsMap.get(te.exerciseId);
              return (
                <div
                  key={te.exerciseId}
                  className="flex items-center justify-between px-3 py-3"
                  style={{
                    background: 'var(--color-surface)',
                    border: 'var(--border-thin)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                      {i + 1}. {ex.name}
                    </p>
                    {te.isSuperset && (
                      <p className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Superset
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
                      {te.sets}×{te.repRange[0]}–{te.repRange[1]}
                    </p>
                    <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)' }}>
                      {weightLabel(ex, pref)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Post-workout stretches */}
        <section>
          <p
            className="font-body uppercase tracking-widest mb-3"
            style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
          >
            Post-Workout
          </p>
          <div className="flex flex-col gap-1">
            {stretches.post.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2"
                style={{
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                  {i + 1}. {s.name}
                </span>
                <span className="font-mono" data-numeric style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
                  {s.reps}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Fixed begin button */}
      <div
        className="fixed bottom-0 left-0 right-0 p-4 mx-auto"
        style={{
          maxWidth: 'var(--max-content-width)',
          background: 'var(--color-bg)',
          borderTop: 'var(--border-thin)',
        }}
      >
        <button
          type="button"
          onClick={onBegin}
          className="w-full py-4 font-display uppercase tracking-wide"
          style={{
            fontSize: 'var(--text-h2)',
            background: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            letterSpacing: '0.05em',
          }}
        >
          Begin Workout
        </button>
      </div>
    </div>
  );
}
