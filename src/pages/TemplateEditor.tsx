import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUp, ArrowDown, Trash, Plus } from '@phosphor-icons/react';
import { ExercisePickerDrawer } from '@/components/workout/ExercisePickerDrawer';
import { useTemplate, saveTemplate, resetTemplate } from '@/hooks/useTemplates';
import { useExercises } from '@/hooks/useExercises';
import { templateMap as defaultTemplateMap } from '@/data/templates';
import type { TemplateExercise, WorkoutTemplate } from '@/types';

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);

  const allExercises = useExercises();
  const exerciseMap = new Map(allExercises.map((e) => [e.id, e]));

  const liveTemplate = useTemplate(id ?? '');
  const template = liveTemplate ?? (id ? defaultTemplateMap.get(id) : undefined);

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4 px-4"
        style={{ background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Template not found.</p>
        <button onClick={() => navigate('/')} style={{ color: 'var(--color-accent)' }}>← Home</button>
      </div>
    );
  }

  const update = (exercises: TemplateExercise[]) => {
    const updated: WorkoutTemplate = { ...template, exercises };
    saveTemplate(updated);
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

      {/* Exercise list */}
      <div className="flex-1 px-4 py-3">
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
                <p
                  className="font-mono"
                  data-numeric
                  style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
                >
                  {entry.sets} sets · {entry.repRange[0]}–{entry.repRange[1]} reps
                  {entry.isSuperset && (
                    <span style={{ color: 'var(--color-accent)' }}> · SS</span>
                  )}
                </p>
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
      </div>

      {/* Reset to defaults */}
      <div className="px-4 pb-8" style={{ borderTop: 'var(--border-thin)' }}>
        <button
          onClick={handleReset}
          className="w-full py-3 font-body mt-4"
          style={{ fontSize: 'var(--text-meta)', color: 'var(--color-regression)' }}
        >
          Reset to defaults
        </button>
      </div>

      <ExercisePickerDrawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addExercise}
        excludeIds={currentIds}
        returnTo={`/template/${template.id}/edit`}
      />
    </div>
  );
}
