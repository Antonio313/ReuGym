import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { ArrowLeft, ArrowUp, ArrowDown, Trash, Plus } from '@phosphor-icons/react';
import { ExercisePickerDrawer } from '@/components/workout/ExercisePickerDrawer';
import { StretchPickerDrawer } from '@/components/workout/StretchPickerDrawer';
import { useTemplate, saveTemplate, resetTemplate } from '@/hooks/useTemplates';
import { useExercises } from '@/hooks/useExercises';
import { useDayStretches, saveDayStretches } from '@/hooks/useDayStretches';
import { templateMap as defaultTemplateMap } from '@/data/templates';
import type { TemplateExercise, WorkoutTemplate, DayStretch } from '@/types';

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stretchPickerPhase, setStretchPickerPhase] = useState<'pre' | 'post' | null>(null);

  const allExercises = useExercises();
  const exerciseMap = new Map(allExercises.map((e) => [e.id, e]));

  const liveTemplate = useTemplate(id ?? '');
  const template = liveTemplate ?? (id ? defaultTemplateMap.get(id) : undefined);

  const stretches = useDayStretches(template?.category ?? 'push');

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4 px-4"
        style={{ background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Template not found.</p>
        <button onClick={() => navigate('/')} style={{ color: 'var(--color-accent)' }}>← Home</button>
      </div>
    );
  }

  // ── Exercise helpers ──────────────────────────────────────────

  const update = (exercises: TemplateExercise[]) => {
    const updated: WorkoutTemplate = { ...template, exercises };
    saveTemplate(updated);
  };

  const adjustSets = (index: number, delta: number) => {
    const ex = template.exercises.map((entry, i) => {
      if (i !== index) return entry;
      return { ...entry, sets: Math.max(1, Math.min(10, entry.sets + delta)) };
    });
    update(ex);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const ex = [...template.exercises];
    [ex[index - 1], ex[index]] = [ex[index], ex[index - 1]];
    update(ex);
  };

  const moveDown = (index: number) => {
    if (index === template.exercises.length - 1) return;
    const ex = [...template.exercises];
    [ex[index], ex[index + 1]] = [ex[index + 1], ex[index]];
    update(ex);
  };

  const remove = (index: number) => {
    const ex = template.exercises.filter((_, i) => i !== index);
    update(ex);
  };

  const addExercise = (exerciseId: string) => {
    const exercise = exerciseMap.get(exerciseId);
    if (!exercise) return;
    const newEntry: TemplateExercise = {
      exerciseId,
      sets: 3,
      repRange: exercise.defaultRepRange,
      isSuperset: false,
    };
    update([...template.exercises, newEntry]);
  };

  const handleReset = async () => {
    await resetTemplate(template.id);
  };

  // ── Stretch helpers ───────────────────────────────────────────

  const moveStretch = (phase: 'pre' | 'post', index: number, direction: 'up' | 'down') => {
    const list = [...(phase === 'pre' ? stretches.pre : stretches.post)];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    if (phase === 'pre') saveDayStretches(template.category, list, stretches.post);
    else saveDayStretches(template.category, stretches.pre, list);
  };

  const removeStretch = (phase: 'pre' | 'post', index: number) => {
    const list = (phase === 'pre' ? stretches.pre : stretches.post).filter((_, i) => i !== index);
    if (phase === 'pre') saveDayStretches(template.category, list, stretches.post);
    else saveDayStretches(template.category, stretches.pre, list);
  };

  const addStretchFromLibrary = (phase: 'pre' | 'post', libraryStretch: DayStretch) => {
    const copy: DayStretch = { ...libraryStretch, id: nanoid() };
    if (phase === 'pre') {
      saveDayStretches(template.category, [...stretches.pre, copy], stretches.post);
    } else {
      saveDayStretches(template.category, stretches.pre, [...stretches.post, copy]);
    }
  };

  const currentIds = template.exercises.map((e) => e.exerciseId);

  return (
    <div className="flex flex-col min-h-dvh mx-auto"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}>

      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 sticky top-0 z-40"
        style={{ height: 'var(--header-height)', borderBottom: 'var(--border-thin)', background: 'var(--color-bg)' }}
      >
        <button onClick={() => navigate(-1)} style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft size={22} />
        </button>
        <span
          className="font-display"
          style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)', letterSpacing: '0.03em' }}
        >
          {template.shortLabel}
        </span>
        <span
          className="font-body ml-1"
          style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
        >
          {template.exercises.length} exercises
        </span>
      </header>

      <div className="flex-1 px-4 py-3">

        {/* Pre-workout stretch section */}
        <StretchSection
          label="Pre-Workout Stretches"
          stretches={stretches.pre}
          onMoveUp={(i) => moveStretch('pre', i, 'up')}
          onMoveDown={(i) => moveStretch('pre', i, 'down')}
          onRemove={(i) => removeStretch('pre', i)}
          onAdd={() => setStretchPickerPhase('pre')}
        />

        {/* Exercise list */}
        <p
          className="font-body uppercase tracking-widest mt-5 mb-3"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          Exercises
        </p>

        {template.exercises.map((entry, index) => {
          const exercise = exerciseMap.get(entry.exerciseId);
          const name = exercise?.name ?? entry.exerciseId;
          const isFirst = index === 0;
          const isLast = index === template.exercises.length - 1;

          return (
            <div
              key={`${entry.exerciseId}-${index}`}
              className="flex items-center gap-2 py-3"
              style={{ borderBottom: 'var(--border-thin)' }}
            >
              {/* Reorder buttons */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moveUp(index)}
                  disabled={isFirst}
                  style={{ color: isFirst ? 'var(--color-text-faint)' : 'var(--color-text-muted)' }}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={isLast}
                  style={{ color: isLast ? 'var(--color-text-faint)' : 'var(--color-text-muted)' }}
                >
                  <ArrowDown size={16} />
                </button>
              </div>

              {/* Exercise info */}
              <div className="flex-1 min-w-0">
                <p
                  className="font-body"
                  style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}
                >
                  {name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {/* Sets stepper */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => adjustSets(index, -1)}
                      disabled={entry.sets <= 1}
                      className="font-mono"
                      style={{
                        fontSize: 'var(--text-meta)',
                        width: '1.5rem',
                        height: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'var(--border-thin)',
                        borderRadius: 'var(--radius-sm)',
                        color: entry.sets <= 1 ? 'var(--color-text-faint)' : 'var(--color-text-muted)',
                        background: 'var(--color-surface)',
                      }}
                    >
                      −
                    </button>
                    <span
                      className="font-mono"
                      data-numeric
                      style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text)', minWidth: '2.5rem', textAlign: 'center' }}
                    >
                      {entry.sets} sets
                    </span>
                    <button
                      onClick={() => adjustSets(index, 1)}
                      disabled={entry.sets >= 10}
                      className="font-mono"
                      style={{
                        fontSize: 'var(--text-meta)',
                        width: '1.5rem',
                        height: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'var(--border-thin)',
                        borderRadius: 'var(--radius-sm)',
                        color: entry.sets >= 10 ? 'var(--color-text-faint)' : 'var(--color-text-muted)',
                        background: 'var(--color-surface)',
                      }}
                    >
                      +
                    </button>
                  </div>
                  <span
                    className="font-mono"
                    data-numeric
                    style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
                  >
                    · {entry.repRange[0]}–{entry.repRange[1]} reps
                    {entry.isSuperset && <span style={{ color: 'var(--color-accent)' }}> · SS</span>}
                  </span>
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => remove(index)}
                style={{ color: 'var(--color-text-faint)', padding: '0.25rem' }}
              >
                <Trash size={18} />
              </button>
            </div>
          );
        })}

        {/* Add exercise */}
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-2 w-full py-4 mt-2"
          style={{ color: 'var(--color-accent)', fontSize: 'var(--text-body)' }}
        >
          <Plus size={18} weight="bold" />
          <span className="font-body">Add exercise</span>
        </button>

        {/* Post-workout stretch section */}
        <div className="mt-4" style={{ borderTop: 'var(--border-thin)', paddingTop: '1rem' }}>
          <StretchSection
            label="Post-Workout Stretches"
            stretches={stretches.post}
            onMoveUp={(i) => moveStretch('post', i, 'up')}
            onMoveDown={(i) => moveStretch('post', i, 'down')}
            onRemove={(i) => removeStretch('post', i)}
            onAdd={() => setStretchPickerPhase('post')}
          />
        </div>

        {/* Reset to defaults */}
        <div className="pb-8 mt-6" style={{ borderTop: 'var(--border-thin)' }}>
          <button
            onClick={handleReset}
            className="w-full py-3 font-body mt-4"
            style={{ fontSize: 'var(--text-meta)', color: 'var(--color-regression)' }}
          >
            Reset to defaults
          </button>
        </div>
      </div>

      <ExercisePickerDrawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addExercise}
        excludeIds={currentIds}
        returnTo={`/template/${template.id}/edit`}
      />

      <StretchPickerDrawer
        open={stretchPickerPhase !== null}
        onClose={() => setStretchPickerPhase(null)}
        onSelect={(stretch) => {
          if (stretchPickerPhase) addStretchFromLibrary(stretchPickerPhase, stretch);
        }}
      />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

type StretchSectionProps = {
  label: string;
  stretches: DayStretch[];
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
};

function StretchSection({ label, stretches, onMoveUp, onMoveDown, onRemove, onAdd }: StretchSectionProps) {
  return (
    <>
      <p
        className="font-body uppercase tracking-widest mb-2"
        style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
      >
        {label}
      </p>
      {stretches.map((s, i) => (
        <div
          key={s.id}
          className="flex items-center gap-2 py-2"
          style={{ borderBottom: 'var(--border-thin)' }}
        >
          <div className="flex flex-col gap-0.5">
            <button onClick={() => onMoveUp(i)} disabled={i === 0} style={{ color: i === 0 ? 'var(--color-text-faint)' : 'var(--color-text-muted)' }}>
              <ArrowUp size={14} />
            </button>
            <button onClick={() => onMoveDown(i)} disabled={i === stretches.length - 1} style={{ color: i === stretches.length - 1 ? 'var(--color-text-faint)' : 'var(--color-text-muted)' }}>
              <ArrowDown size={14} />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
              {s.name}
            </p>
            <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
              {s.reps}
            </p>
          </div>
          <button onClick={() => onRemove(i)} style={{ color: 'var(--color-text-faint)', padding: '0.25rem' }}>
            <Trash size={16} />
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="flex items-center gap-2 py-3"
        style={{ color: 'var(--color-accent)', fontSize: 'var(--text-meta)' }}
      >
        <Plus size={16} weight="bold" />
        <span className="font-body">Add stretch</span>
      </button>
    </>
  );
}
