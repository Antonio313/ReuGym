import { ArrowLeft } from '@phosphor-icons/react';
import type { WorkoutTemplate, Exercise, ExercisePref, DayStretch } from '@/types';

type Props = {
  template: WorkoutTemplate;
  exerciseMap: Map<string, Exercise>;
  dayStretches: { pre: DayStretch[]; post: DayStretch[] };
  stretchExMap: Map<string, Exercise>;
  prefsMap: Map<string, ExercisePref>;
  onBegin: () => void;
  onBack: () => void;
};

function weightLabel(exercise: Exercise, pref: ExercisePref | undefined): string {
  if (exercise.isBodyweight) return 'Bodyweight';
  const w = pref?.startingWeightKg ?? exercise.startingWeightKg;
  return `${w}kg`;
}

function formatRepRange(min: number, max: number, isTimed = false): string {
  const unit = isTimed ? 's' : '';
  return min === max ? `${min}${unit}` : `${min}–${max}${unit}`;
}

export function WorkoutPreview({ template, exerciseMap, dayStretches, stretchExMap, prefsMap, onBegin, onBack }: Props) {
  return (
    <div
      className="flex flex-col min-h-dvh mx-auto"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 sticky top-0 z-10"
        style={{ height: 'var(--header-height)', borderBottom: 'var(--border-thin)', background: 'var(--color-bg)' }}
      >
        <button onClick={onBack} style={{ color: 'var(--color-text-muted)' }} aria-label="Go back">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p
            className="font-body uppercase tracking-widest"
            style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
          >
            Today's Workout
          </p>
          <h1
            className="font-display leading-none"
            style={{ fontSize: 'var(--text-h1)', color: 'var(--color-text)', letterSpacing: '0.02em' }}
          >
            {template.shortLabel}
          </h1>
        </div>
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
            {dayStretches.pre.length === 0 && (
              <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)' }}>None added</p>
            )}
            {dayStretches.pre.map((s, i) => {
              const ex = stretchExMap.get(s.exerciseId);
              if (!ex) return null;
              const repsDisplay = formatRepRange(s.repRange[0], s.repRange[1], s.isTimed);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2"
                  style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)' }}
                >
                  <span className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                    {i + 1}. {ex.name}
                  </span>
                  <span className="font-mono" data-numeric style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
                    {repsDisplay}
                  </span>
                </div>
              );
            })}
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
                      {te.sets}×{formatRepRange(te.repRange[0], te.repRange[1], ex.isTimed)}
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
            {dayStretches.post.length === 0 && (
              <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)' }}>None added</p>
            )}
            {dayStretches.post.map((s, i) => {
              const ex = stretchExMap.get(s.exerciseId);
              if (!ex) return null;
              const repsDisplay = formatRepRange(s.repRange[0], s.repRange[1], s.isTimed);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2"
                  style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)' }}
                >
                  <span className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                    {i + 1}. {ex.name}
                  </span>
                  <span className="font-mono" data-numeric style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
                    {repsDisplay}
                  </span>
                </div>
              );
            })}
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
