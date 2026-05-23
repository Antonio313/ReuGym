import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { ArrowLeft, ArrowUp, ArrowDown, Trash, Plus } from '@phosphor-icons/react';
import { ExercisePickerDrawer } from '@/components/workout/ExercisePickerDrawer';
import { StretchPickerDrawer } from '@/components/workout/StretchPickerDrawer';
import { useTemplate, saveTemplate } from '@/hooks/useTemplates';
import { useExercises, useStretches } from '@/hooks/useExercises';
import { useDayStretches, saveDayStretches } from '@/hooks/useDayStretches';
import { templateMap as defaultTemplateMap } from '@/data/templates';
import type { TemplateExercise, WorkoutTemplate, DayStretch, Exercise } from '@/types';

function formatRepRange(min: number, max: number, isTimed = false): string {
  const unit = isTimed ? 's' : ' reps';
  return min === max ? `${min}${unit}` : `${min}–${max}${unit}`;
}

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stretchPickerPhase, setStretchPickerPhase] = useState<'pre' | 'post' | null>(null);

  const allExercises = useExercises();
  const exerciseMap = new Map(allExercises.map((e) => [e.id, e]));

  const allStretches = useStretches();
  const stretchExMap = new Map(allStretches.map((s) => [s.id, s]));

  const [liveTemplate, reloadTemplate] = useTemplate(id ?? '');
  const template = liveTemplate ?? (id ? defaultTemplateMap.get(id) : undefined);

  const stretches = useDayStretches(id ?? '');

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
    void saveTemplate(updated).then(reloadTemplate);
  };

  // Clears the superset state of the exercise at `index` and its pair partner (if any)
  const clearSupersetForIndex = (exercises: TemplateExercise[], index: number): TemplateExercise[] => {
    const groupId = exercises[index].supersetGroupId;
    if (!groupId) return exercises;
    return exercises.map((e) =>
      e.supersetGroupId === groupId ? { ...e, isSuperset: false, supersetGroupId: undefined } : e,
    );
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
    let ex = [...template.exercises];
    ex = clearSupersetForIndex(ex, index - 1);
    ex = clearSupersetForIndex(ex, index);
    [ex[index - 1], ex[index]] = [ex[index], ex[index - 1]];
    update(ex);
  };

  const moveDown = (index: number) => {
    if (index === template.exercises.length - 1) return;
    let ex = [...template.exercises];
    ex = clearSupersetForIndex(ex, index);
    ex = clearSupersetForIndex(ex, index + 1);
    [ex[index], ex[index + 1]] = [ex[index + 1], ex[index]];
    update(ex);
  };

  const remove = (index: number) => {
    let ex = [...template.exercises];
    ex = clearSupersetForIndex(ex, index);
    ex = ex.filter((_, i) => i !== index);
    update(ex);
  };

  const toggleSuperset = (index: number) => {
    if (index >= template.exercises.length - 1) return;
    let ex = [...template.exercises];
    const a = ex[index];
    const b = ex[index + 1];
    const alreadyPaired =
      a.isSuperset && b.isSuperset &&
      a.supersetGroupId != null &&
      a.supersetGroupId === b.supersetGroupId;

    if (alreadyPaired) {
      ex[index]     = { ...a, isSuperset: false, supersetGroupId: undefined };
      ex[index + 1] = { ...b, isSuperset: false, supersetGroupId: undefined };
    } else {
      ex = clearSupersetForIndex(ex, index);
      ex = clearSupersetForIndex(ex, index + 1);
      const groupId = `${template.id}-${nanoid(6)}`;
      ex[index]     = { ...ex[index],     isSuperset: true, supersetGroupId: groupId };
      ex[index + 1] = { ...ex[index + 1], isSuperset: true, supersetGroupId: groupId };
    }
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

  // ── Stretch helpers ───────────────────────────────────────────

  const moveStretch = (phase: 'pre' | 'post', index: number, direction: 'up' | 'down') => {
    const list = [...(phase === 'pre' ? stretches.pre : stretches.post)];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    if (phase === 'pre') void saveDayStretches(id ?? '', list, stretches.post);
    else void saveDayStretches(id ?? '', stretches.pre, list);
  };

  const removeStretch = (phase: 'pre' | 'post', index: number) => {
    const list = (phase === 'pre' ? stretches.pre : stretches.post).filter((_, i) => i !== index);
    if (phase === 'pre') void saveDayStretches(id ?? '', list, stretches.post);
    else void saveDayStretches(id ?? '', stretches.pre, list);
  };

  const addStretchFromLibrary = (phase: 'pre' | 'post', exercise: Exercise) => {
    const assignment: DayStretch = { id: nanoid(), exerciseId: exercise.id, restSeconds: exercise.restSeconds };
    if (phase === 'pre') {
      void saveDayStretches(id ?? '', [...stretches.pre, assignment], stretches.post);
    } else {
      void saveDayStretches(id ?? '', stretches.pre, [...stretches.post, assignment]);
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
          stretchExMap={stretchExMap}
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
          const nextEntry = template.exercises[index + 1];
          const isPairedWithNext =
            !isLast &&
            entry.isSuperset &&
            nextEntry?.isSuperset &&
            entry.supersetGroupId != null &&
            entry.supersetGroupId === nextEntry.supersetGroupId;

          return (
            <div key={`${entry.exerciseId}-${index}`}>
              {/* Exercise row */}
              <div
                className="flex items-center gap-2 py-3"
                style={{
                  borderBottom: isPairedWithNext ? 'none' : 'var(--border-thin)',
                  borderLeft: entry.isSuperset ? '2px solid var(--color-accent)' : '2px solid transparent',
                  paddingLeft: entry.isSuperset ? '0.5rem' : undefined,
                }}
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
                  <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
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
                      · {formatRepRange(entry.repRange[0], entry.repRange[1], exercise?.isTimed)}
                      {exercise && (
                        <> · {exercise.isBodyweight ? 'BW' : `${exercise.startingWeightKg}kg`}</>
                      )}
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

              {/* Superset connector between adjacent exercises */}
              {!isLast && (
                <div
                  className="flex items-center justify-center"
                  style={{
                    padding: '4px 0',
                    borderBottom: 'var(--border-thin)',
                    borderLeft: isPairedWithNext ? '2px solid var(--color-accent)' : '2px solid transparent',
                    paddingLeft: isPairedWithNext ? '0.5rem' : undefined,
                  }}
                >
                  <button
                    onClick={() => toggleSuperset(index)}
                    className="font-body"
                    style={{
                      fontSize: 'var(--text-micro)',
                      letterSpacing: '0.08em',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: isPairedWithNext ? 'var(--color-accent-dim)' : 'transparent',
                      color: isPairedWithNext ? 'var(--color-accent)' : 'var(--color-text-faint)',
                      border: isPairedWithNext ? '1px solid var(--color-accent)' : '1px dashed var(--color-border)',
                    }}
                  >
                    {isPairedWithNext ? '× SUPERSET' : '+ SUPERSET'}
                  </button>
                </div>
              )}
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
            stretchExMap={stretchExMap}
            onMoveUp={(i) => moveStretch('post', i, 'up')}
            onMoveDown={(i) => moveStretch('post', i, 'down')}
            onRemove={(i) => removeStretch('post', i)}
            onAdd={() => setStretchPickerPhase('post')}
          />
        </div>

        <div className="pb-8" />
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
        onSelect={(exercise) => {
          if (stretchPickerPhase) addStretchFromLibrary(stretchPickerPhase, exercise);
        }}
        excludeIds={[...stretches.pre.map((s) => s.exerciseId), ...stretches.post.map((s) => s.exerciseId)]}
      />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

type StretchSectionProps = {
  label: string;
  stretches: DayStretch[];
  stretchExMap: Map<string, Exercise>;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
};

function StretchSection({ label, stretches, stretchExMap, onMoveUp, onMoveDown, onRemove, onAdd }: StretchSectionProps) {
  return (
    <>
      <p
        className="font-body uppercase tracking-widest mb-2"
        style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
      >
        {label}
      </p>
      {stretches.map((s, i) => {
        const ex = stretchExMap.get(s.exerciseId);
        const repsDisplay = ex
          ? formatRepRange(ex.defaultRepRange[0], ex.defaultRepRange[1], ex.isTimed)
          : s.exerciseId;
        return (
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
                {ex?.name ?? s.exerciseId}
              </p>
              <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
                {repsDisplay}
              </p>
            </div>
            <button onClick={() => onRemove(i)} style={{ color: 'var(--color-text-faint)', padding: '0.25rem' }}>
              <Trash size={16} />
            </button>
          </div>
        );
      })}
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
