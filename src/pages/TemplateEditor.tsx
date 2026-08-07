import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { Reorder, useDragControls } from 'motion/react';
import {
  ArrowLeft, Trash, Plus,
  DotsSixVertical, PencilSimple, X,
} from '@phosphor-icons/react';
import { ExercisePickerDrawer } from '@/components/workout/ExercisePickerDrawer';
import { StretchPickerDrawer } from '@/components/workout/StretchPickerDrawer';
import { useTemplate, saveTemplate } from '@/hooks/useTemplates';
import { useExercises, useStretches } from '@/hooks/useExercises';
import { useDayStretches, saveDayStretches } from '@/hooks/useDayStretches';
import { templateMap as defaultTemplateMap } from '@/data/templates';
import { useUnit } from '@/hooks/useUnit';
import type { TemplateExercise, WorkoutTemplate, DayStretch, Exercise, SubstituteConfig } from '@/types';

const REST_PRESETS = [45, 60, 90, 120, 150, 180];

function formatRepRange(min: number, max: number, isTimed = false): string {
  const unit = isTimed ? 's' : ' reps';
  return min === max ? `${min}${unit}` : `${min}–${max}${unit}`;
}

function sanitizeSupersets(exercises: TemplateExercise[]): TemplateExercise[] {
  const result = exercises.map(e => ({ ...e }));
  for (let i = 0; i < result.length; i++) {
    const e = result[i];
    if (!e.isSuperset || !e.supersetGroupId) continue;
    const partnerId = e.supersetGroupId;
    const partnerIdx = result.findIndex((x, j) => j !== i && x.supersetGroupId === partnerId);
    if (partnerIdx === -1 || Math.abs(partnerIdx - i) !== 1) {
      result[i] = { ...e, isSuperset: false, supersetGroupId: undefined };
      if (partnerIdx !== -1) {
        result[partnerIdx] = { ...result[partnerIdx], isSuperset: false, supersetGroupId: undefined };
      }
    }
  }
  return result;
}

// ── Tiny field helpers ───────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body font-medium uppercase tracking-widest mb-2"
      style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
      {children}
    </p>
  );
}

function StepBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="font-mono"
      style={{
        width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 'var(--text-h3)', border: 'var(--border-thin)', borderRadius: 'var(--radius-sm)',
        background: 'var(--color-surface-2)',
        color: disabled ? 'var(--color-text-faint)' : 'var(--color-text-muted)',
      }}>
      {children}
    </button>
  );
}

// Free-text while focused — no forced 0/1 injected mid-edit, no digits
// silently appended to a coerced value. The field is purely local string
// state until blur, when it's parsed and committed (or reverted to the last
// good value if left empty/invalid); nothing about the caller's number
// changes on every keystroke, which is what caused typing "8" after
// clearing the field to produce "18" (a stray "1" from the old
// parseInt('') || 1 default got baked into the controlled value first).
function NumericField({
  value, onCommit, min, allowDecimal = false, width = '4.5rem',
}: {
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  allowDecimal?: boolean;
  width?: string;
}) {
  const [draft, setDraft] = useState(String(value));

  // Re-sync from the parent's committed value — e.g. after a starting-weight
  // commit gets snapped to the nearest dumbbell, `value` comes back
  // different from what was typed, and the field should reflect that rather
  // than the raw typed number. Only fires on a real value change, so it
  // never interferes with in-progress typing (the parent hasn't re-rendered
  // with a new value yet at that point).
  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') { setDraft(String(value)); return; }
    const parsed = allowDecimal ? parseFloat(trimmed) : parseInt(trimmed, 10);
    if (isNaN(parsed)) { setDraft(String(value)); return; }
    const clamped = min != null ? Math.max(min, parsed) : parsed;
    onCommit(clamped);
  };

  return (
    <input
      type="number" inputMode={allowDecimal ? 'decimal' : 'numeric'} value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      className="font-mono" data-numeric
      style={{
        width, padding: '0.5rem 0.75rem', textAlign: 'center',
        fontSize: 'var(--text-body)', background: 'var(--color-surface-2)',
        border: 'var(--border-thin)', borderRadius: 'var(--radius-md)',
        color: 'var(--color-text)', outline: 'none',
      }}
    />
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ accentColor: 'var(--color-accent)', width: '1rem', height: '1rem' }} />
      <span className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
        {label}
      </span>
    </label>
  );
}

function RestPresets({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {REST_PRESETS.map(s => (
          <button key={s} type="button" onClick={() => onChange(s)}
            className="font-mono" data-numeric
            style={{
              fontSize: 'var(--text-meta)', padding: '0.375rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: value === s ? '1px solid var(--color-accent)' : 'var(--border-thin)',
              background: value === s ? 'var(--color-accent-dim)' : 'transparent',
              color: value === s ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}>
            {s}s
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <NumericField value={value} onCommit={onChange} min={0} width="5rem" />
        <span className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
          seconds{value === 0 ? ' (no rest)' : ''}
        </span>
      </div>
    </div>
  );
}

// ── ExerciseConfigSheet ──────────────────────────────────────────

type ConfigTarget =
  | { mode: 'add'; exerciseId: string }
  | { mode: 'edit'; index: number };

// ── SubstituteConfigSheet ─────────────────────────────────────────

type SubConfigTarget =
  | { mode: 'add'; exerciseId: string }
  | { mode: 'edit'; index: number };

function SubstituteConfigSheet({
  target, mainExercise, mainExerciseName, substitutes, exerciseMap, onSave, onClose,
}: {
  target: SubConfigTarget;
  mainExercise: TemplateExercise;
  mainExerciseName: string;
  substitutes: SubstituteConfig[];
  exerciseMap: Map<string, Exercise>;
  onSave: (sub: SubstituteConfig, index?: number) => void;
  onClose: () => void;
}) {
  const { unit, toDisplay, toKg } = useUnit();
  const exerciseId = target.mode === 'add' ? target.exerciseId : substitutes[target.index].exerciseId;
  const exercise = exerciseMap.get(exerciseId);
  const existingSub = target.mode === 'edit' ? substitutes[target.index] : undefined;

  const [draft, setDraft] = useState<SubstituteConfig>(() => {
    // Defensive fallback for substitutes saved before isBodyweight/isTimed
    // existed on this type — they inherited the slot's flags at runtime, so
    // that's the closest true value to seed the toggle from.
    if (existingSub) {
      return {
        ...existingSub,
        isBodyweight: existingSub.isBodyweight ?? mainExercise.isBodyweight,
        isTimed: existingSub.isTimed ?? mainExercise.isTimed,
      };
    }
    return {
      exerciseId,
      sets: mainExercise.sets,
      repRange: exercise?.defaultRepRange ?? mainExercise.repRange,
      startingWeightKg: exercise?.startingWeightKg ?? 0,
      restSeconds: exercise?.restSeconds ?? mainExercise.restSeconds,
      isBodyweight: exercise?.isBodyweight ?? false,
      isTimed: exercise?.isTimed ?? false,
    };
  });

  return (
    <>
      <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-[70] mx-auto flex flex-col"
        style={{
          maxWidth: 'var(--max-content-width)', background: 'var(--color-surface)',
          borderRadius: '6px 6px 0 0', maxHeight: '80dvh', overflow: 'hidden',
        }}>

        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: 'var(--border-thin)' }}>
          <div>
            <p className="font-body font-medium" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
              {exercise?.name ?? exerciseId}
            </p>
            <p className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-faint)' }}>
              Substitute for {mainExerciseName}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 flex flex-col gap-5">

          <div>
            <FieldLabel>Sets</FieldLabel>
            <div className="flex items-center gap-3">
              <StepBtn onClick={() => setDraft(d => ({ ...d, sets: Math.max(1, d.sets - 1) }))} disabled={draft.sets <= 1}>−</StepBtn>
              <span className="font-mono" data-numeric
                style={{ fontSize: 'var(--text-h3)', color: 'var(--color-text)', minWidth: '2rem', textAlign: 'center' }}>
                {draft.sets}
              </span>
              <StepBtn onClick={() => setDraft(d => ({ ...d, sets: Math.min(10, d.sets + 1) }))} disabled={draft.sets >= 10}>+</StepBtn>
            </div>
          </div>

          <div>
            <FieldLabel>Rep range</FieldLabel>
            <div className="flex items-center gap-2">
              <NumericField value={draft.repRange[0]} min={1}
                onCommit={v => setDraft(d => ({ ...d, repRange: [v, d.repRange[1]] }))} />
              <span style={{ color: 'var(--color-text-muted)' }}>–</span>
              <NumericField value={draft.repRange[1]} min={1}
                onCommit={v => setDraft(d => ({ ...d, repRange: [d.repRange[0], v] }))} />
            </div>
            {draft.repRange[0] > draft.repRange[1] && (
              <p className="font-body mt-1"
                style={{ fontSize: 'var(--text-micro)', color: 'var(--color-regression)' }}>
                {draft.repRange[0]}–{draft.repRange[1]} doesn't make sense — the first number should be lower.
              </p>
            )}
          </div>

          {!draft.isBodyweight && (
            <div>
              <FieldLabel>Starting weight ({unit})</FieldLabel>
              <NumericField
                value={toDisplay(draft.startingWeightKg)}
                allowDecimal
                min={0}
                width="6rem"
                onCommit={v => setDraft(d => ({ ...d, startingWeightKg: toKg(v) }))}
              />
            </div>
          )}

          <div>
            <FieldLabel>Rest</FieldLabel>
            <RestPresets value={draft.restSeconds} onChange={v => setDraft(d => ({ ...d, restSeconds: v }))} />
          </div>

          <div className="flex gap-6">
            <ToggleField label="Bodyweight" checked={draft.isBodyweight}
              onChange={v => setDraft(d => ({ ...d, isBodyweight: v, startingWeightKg: v ? 0 : d.startingWeightKg }))} />
            <ToggleField label="Timed" checked={draft.isTimed}
              onChange={v => setDraft(d => ({ ...d, isTimed: v }))} />
          </div>

          <div className="pb-2" />
        </div>

        <div className="px-4 pb-6 pt-3 flex-shrink-0" style={{ borderTop: 'var(--border-thin)' }}>
          <button
            onClick={() => onSave(draft, target.mode === 'edit' ? target.index : undefined)}
            className="w-full py-4 font-display uppercase tracking-wide"
            style={{
              fontSize: 'var(--text-h2)', background: 'var(--color-accent)',
              color: '#fff', borderRadius: 'var(--radius-md)', border: 'none',
            }}>
            {target.mode === 'add' ? 'Add Substitute' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

function ExerciseConfigSheet({
  target, templateId, exercises, exerciseMap, onSave, onClose,
}: {
  target: ConfigTarget;
  templateId: string;
  exercises: TemplateExercise[];
  exerciseMap: Map<string, Exercise>;
  onSave: (entry: TemplateExercise, index?: number) => void;
  onClose: () => void;
}) {
  const { unit, toDisplay, toKg } = useUnit();
  const exerciseId = target.mode === 'add' ? target.exerciseId : exercises[target.index].exerciseId;
  const exercise = exerciseMap.get(exerciseId);
  const existingEntry = target.mode === 'edit' ? exercises[target.index] : undefined;

  const [draft, setDraft] = useState<TemplateExercise>(() => {
    if (existingEntry) return { ...existingEntry, substitutes: existingEntry.substitutes ?? [] };
    return {
      exerciseId,
      sets: 3,
      repRange: exercise?.defaultRepRange ?? [8, 12],
      startingWeightKg: exercise?.startingWeightKg ?? 0,
      restSeconds: exercise?.restSeconds ?? 60,
      isBodyweight: exercise?.isBodyweight ?? false,
      isTimed: exercise?.isTimed ?? false,
      isSuperset: false,
      substitutes: [],
    };
  });

  const [subPickerOpen, setSubPickerOpen] = useState(false);
  const [subConfigTarget, setSubConfigTarget] = useState<SubConfigTarget | null>(null);
  const excludeIdsForSub = [draft.exerciseId, ...(draft.substitutes ?? []).map(s => s.exerciseId)];

  const handleSubConfigSave = (sub: SubstituteConfig, index?: number) => {
    if (index !== undefined) {
      setDraft(d => ({ ...d, substitutes: (d.substitutes ?? []).map((s, i) => i === index ? sub : s) }));
    } else {
      setDraft(d => ({ ...d, substitutes: [...(d.substitutes ?? []), sub] }));
    }
    setSubConfigTarget(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex flex-col"
        style={{
          maxWidth: 'var(--max-content-width)', background: 'var(--color-surface)',
          borderRadius: '6px 6px 0 0', maxHeight: '85dvh', overflow: 'hidden',
        }}>

        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: 'var(--border-thin)' }}>
          <p className="font-body font-medium" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
            {exercise?.name ?? exerciseId}
          </p>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 flex flex-col gap-5">

          <div>
            <FieldLabel>Sets</FieldLabel>
            <div className="flex items-center gap-3">
              <StepBtn onClick={() => setDraft(d => ({ ...d, sets: Math.max(1, d.sets - 1) }))} disabled={draft.sets <= 1}>−</StepBtn>
              <span className="font-mono" data-numeric
                style={{ fontSize: 'var(--text-h3)', color: 'var(--color-text)', minWidth: '2rem', textAlign: 'center' }}>
                {draft.sets}
              </span>
              <StepBtn onClick={() => setDraft(d => ({ ...d, sets: Math.min(10, d.sets + 1) }))} disabled={draft.sets >= 10}>+</StepBtn>
            </div>
          </div>

          <div>
            <FieldLabel>{draft.isTimed ? 'Duration range (sec)' : 'Rep range'}</FieldLabel>
            <div className="flex items-center gap-2">
              <NumericField value={draft.repRange[0]} min={1}
                onCommit={v => setDraft(d => ({ ...d, repRange: [v, d.repRange[1]] }))} />
              <span style={{ color: 'var(--color-text-muted)' }}>–</span>
              <NumericField value={draft.repRange[1]} min={1}
                onCommit={v => setDraft(d => ({ ...d, repRange: [d.repRange[0], v] }))} />
            </div>
            {draft.repRange[0] > draft.repRange[1] && (
              <p className="font-body mt-1"
                style={{ fontSize: 'var(--text-micro)', color: 'var(--color-regression)' }}>
                {draft.repRange[0]}–{draft.repRange[1]} doesn't make sense — the first number should be lower.
              </p>
            )}
          </div>

          {!draft.isBodyweight && (
            <div>
              <FieldLabel>Starting weight ({unit})</FieldLabel>
              <NumericField
                value={toDisplay(draft.startingWeightKg)}
                allowDecimal
                min={0}
                width="6rem"
                onCommit={v => setDraft(d => ({ ...d, startingWeightKg: toKg(v) }))}
              />
            </div>
          )}

          <div>
            <FieldLabel>Rest</FieldLabel>
            <RestPresets value={draft.restSeconds} onChange={v => setDraft(d => ({ ...d, restSeconds: v }))} />
          </div>

          <div className="flex gap-6">
            <ToggleField label="Bodyweight" checked={draft.isBodyweight}
              onChange={v => setDraft(d => ({ ...d, isBodyweight: v, startingWeightKg: v ? 0 : d.startingWeightKg }))} />
            <ToggleField label="Timed" checked={draft.isTimed}
              onChange={v => setDraft(d => ({ ...d, isTimed: v }))} />
          </div>

          <div>
            <FieldLabel>Substitutes</FieldLabel>
            {(draft.substitutes ?? []).length === 0 && (
              <p className="font-body mb-1" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)' }}>
                None configured
              </p>
            )}
            {(draft.substitutes ?? []).map((sub, i) => {
              const subEx = exerciseMap.get(sub.exerciseId);
              return (
                <div key={sub.exerciseId} className="flex items-center gap-2 py-2"
                  style={{ borderBottom: 'var(--border-thin)' }}>
                  <button
                    type="button"
                    onClick={() => setSubConfigTarget({ mode: 'edit', index: i })}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                      {subEx?.name ?? sub.exerciseId}
                    </p>
                    <p className="font-mono" data-numeric
                      style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
                      {sub.sets}×{formatRepRange(sub.repRange[0], sub.repRange[1])}
                      {' · '}{(subEx?.isBodyweight ?? false) ? 'BW' : `${toDisplay(sub.startingWeightKg)}${unit}`}
                      {' · '}{sub.restSeconds}s
                    </p>
                  </button>
                  <button
                    onClick={() => setDraft(d => ({ ...d, substitutes: (d.substitutes ?? []).filter((_, j) => j !== i) }))}
                    style={{ color: 'var(--color-text-faint)', padding: '0.25rem' }}>
                    <Trash size={16} />
                  </button>
                </div>
              );
            })}
            <button onClick={() => setSubPickerOpen(true)}
              className="flex items-center gap-2 py-2 mt-1"
              style={{ color: 'var(--color-accent)', fontSize: 'var(--text-meta)' }}>
              <Plus size={14} weight="bold" />
              <span className="font-body">Add substitute</span>
            </button>
          </div>

          <div className="pb-2" />
        </div>

        <div className="px-4 pb-6 pt-3 flex-shrink-0" style={{ borderTop: 'var(--border-thin)' }}>
          <button
            onClick={() => onSave(draft, target.mode === 'edit' ? target.index : undefined)}
            className="w-full py-4 font-display uppercase tracking-wide"
            style={{
              fontSize: 'var(--text-h2)', background: 'var(--color-accent)',
              color: '#fff', borderRadius: 'var(--radius-md)', border: 'none',
            }}>
            {target.mode === 'add' ? 'Add Exercise' : 'Save Changes'}
          </button>
        </div>
      </div>

      <ExercisePickerDrawer
        open={subPickerOpen}
        onClose={() => setSubPickerOpen(false)}
        onSelect={subId => {
          setSubPickerOpen(false);
          setSubConfigTarget({ mode: 'add', exerciseId: subId });
        }}
        excludeIds={excludeIdsForSub}
        returnTo={`/template/${templateId}/edit`}
      />

      {subConfigTarget && (
        <SubstituteConfigSheet
          target={subConfigTarget}
          mainExercise={draft}
          mainExerciseName={exercise?.name ?? exerciseId}
          substitutes={draft.substitutes ?? []}
          exerciseMap={exerciseMap}
          onSave={handleSubConfigSave}
          onClose={() => setSubConfigTarget(null)}
        />
      )}
    </>
  );
}

// ── DraggableExerciseRow ─────────────────────────────────────────

function DraggableExerciseRow({
  entry, index, total, exerciseMap, nextEntry,
  onRemove, onToggleSuperset, onEdit, onDragEnd,
}: {
  entry: TemplateExercise;
  index: number;
  total: number;
  exerciseMap: Map<string, Exercise>;
  nextEntry?: TemplateExercise;
  onRemove: () => void;
  onToggleSuperset: () => void;
  onEdit: () => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  const { unit, toDisplay } = useUnit();
  const exercise = exerciseMap.get(entry.exerciseId);
  const name = exercise?.name ?? entry.exerciseId;
  const isLast = index === total - 1;

  const isPairedWithNext =
    !isLast &&
    entry.isSuperset &&
    nextEntry?.isSuperset === true &&
    entry.supersetGroupId != null &&
    entry.supersetGroupId === nextEntry.supersetGroupId;

  return (
    <Reorder.Item
      value={entry}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      style={{ listStyle: 'none' }}
    >
      <div style={{
        borderBottom: isPairedWithNext ? 'none' : 'var(--border-thin)',
        borderLeft: entry.isSuperset ? '2px solid var(--color-accent)' : '2px solid transparent',
        paddingLeft: entry.isSuperset ? '0.5rem' : undefined,
      }}>
        <div className="flex items-center gap-2 py-3">
          <div onPointerDown={e => controls.start(e)}
            style={{ color: 'var(--color-text-faint)', cursor: 'grab', touchAction: 'none', padding: '0.25rem', flexShrink: 0 }}>
            <DotsSixVertical size={18} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
              {name}
            </p>
            <p className="font-mono" data-numeric
              style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
              {entry.sets}×{formatRepRange(entry.repRange[0], entry.repRange[1], entry.isTimed)}
              {' · '}{entry.isBodyweight ? 'BW' : `${toDisplay(entry.startingWeightKg)}${unit}`}
              {' · '}{entry.restSeconds}s
            </p>
            {(entry.substitutes?.length ?? 0) > 0 && (
              <p className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-faint)' }}>
                {entry.substitutes!.length} sub{entry.substitutes!.length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          <button onClick={onEdit} aria-label="Configure"
            style={{ color: 'var(--color-text-muted)', padding: '0.25rem', flexShrink: 0 }}>
            <PencilSimple size={18} />
          </button>

          <button onClick={onRemove} aria-label="Remove"
            style={{ color: 'var(--color-text-faint)', padding: '0.25rem', flexShrink: 0 }}>
            <Trash size={18} />
          </button>
        </div>

        {!isLast && (
          <div className="flex items-center justify-center" style={{
            padding: '4px 0', borderBottom: 'var(--border-thin)',
            borderLeft: isPairedWithNext ? '2px solid var(--color-accent)' : '2px solid transparent',
            paddingLeft: isPairedWithNext ? '0.5rem' : undefined,
          }}>
            <button onClick={onToggleSuperset} className="font-body" style={{
              fontSize: 'var(--text-micro)', letterSpacing: '0.08em', padding: '3px 10px',
              borderRadius: '999px',
              background: isPairedWithNext ? 'var(--color-accent-dim)' : 'transparent',
              color: isPairedWithNext ? 'var(--color-accent)' : 'var(--color-text-faint)',
              border: isPairedWithNext ? '1px solid var(--color-accent)' : '1px dashed var(--color-border)',
            }}>
              {isPairedWithNext ? '× SUPERSET' : '+ SUPERSET'}
            </button>
          </div>
        )}
      </div>
    </Reorder.Item>
  );
}

// ── StretchConfigSheet ───────────────────────────────────────────

type StretchConfigTarget =
  | { mode: 'add'; exerciseId: string; phase: 'pre' | 'post' }
  | { mode: 'edit'; phase: 'pre' | 'post'; index: number };

function StretchConfigSheet({
  target, stretches, stretchExMap, onSave, onClose,
}: {
  target: StretchConfigTarget;
  stretches: { pre: DayStretch[]; post: DayStretch[] };
  stretchExMap: Map<string, Exercise>;
  onSave: (item: DayStretch, target: StretchConfigTarget) => void;
  onClose: () => void;
}) {
  const { unit, toDisplay, toKg } = useUnit();
  const existingItem = target.mode === 'edit'
    ? (target.phase === 'pre' ? stretches.pre : stretches.post)[target.index]
    : undefined;
  const exerciseId = target.mode === 'add' ? target.exerciseId : existingItem!.exerciseId;
  const stretchEx = stretchExMap.get(exerciseId);

  const [draft, setDraft] = useState<DayStretch>(() => {
    if (existingItem) return { ...existingItem };
    return {
      id: nanoid(),
      exerciseId,
      sets: 1,
      repRange: stretchEx?.defaultRepRange ?? [30, 30],
      startingWeightKg: 0,
      restSeconds: stretchEx?.restSeconds ?? 0,
      isBodyweight: stretchEx?.isBodyweight ?? true,
      isTimed: stretchEx?.isTimed ?? false,
    };
  });

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex flex-col"
        style={{
          maxWidth: 'var(--max-content-width)', background: 'var(--color-surface)',
          borderRadius: '6px 6px 0 0', maxHeight: '80dvh', overflow: 'hidden',
        }}>

        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: 'var(--border-thin)' }}>
          <p className="font-body font-medium" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
            {stretchEx?.name ?? exerciseId}
          </p>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 flex flex-col gap-5">

          <div>
            <FieldLabel>Sets</FieldLabel>
            <div className="flex items-center gap-3">
              <StepBtn onClick={() => setDraft(d => ({ ...d, sets: Math.max(1, d.sets - 1) }))} disabled={draft.sets <= 1}>−</StepBtn>
              <span className="font-mono" data-numeric
                style={{ fontSize: 'var(--text-h3)', color: 'var(--color-text)', minWidth: '2rem', textAlign: 'center' }}>
                {draft.sets}
              </span>
              <StepBtn onClick={() => setDraft(d => ({ ...d, sets: Math.min(10, d.sets + 1) }))} disabled={draft.sets >= 10}>+</StepBtn>
            </div>
          </div>

          <div>
            <FieldLabel>{draft.isTimed ? 'Duration range (sec)' : 'Rep range'}</FieldLabel>
            <div className="flex items-center gap-2">
              <NumericField value={draft.repRange[0]} min={1}
                onCommit={v => setDraft(d => ({ ...d, repRange: [v, d.repRange[1]] }))} />
              <span style={{ color: 'var(--color-text-muted)' }}>–</span>
              <NumericField value={draft.repRange[1]} min={1}
                onCommit={v => setDraft(d => ({ ...d, repRange: [d.repRange[0], v] }))} />
            </div>
            {draft.repRange[0] > draft.repRange[1] && (
              <p className="font-body mt-1"
                style={{ fontSize: 'var(--text-micro)', color: 'var(--color-regression)' }}>
                {draft.repRange[0]}–{draft.repRange[1]} doesn't make sense — the first number should be lower.
              </p>
            )}
          </div>

          {!draft.isBodyweight && (
            <div>
              <FieldLabel>Starting weight ({unit})</FieldLabel>
              <NumericField
                value={toDisplay(draft.startingWeightKg)}
                allowDecimal
                min={0}
                width="6rem"
                onCommit={v => setDraft(d => ({ ...d, startingWeightKg: toKg(v) }))}
              />
            </div>
          )}

          <div>
            <FieldLabel>Rest between sets</FieldLabel>
            <RestPresets value={draft.restSeconds} onChange={v => setDraft(d => ({ ...d, restSeconds: v }))} />
            {draft.restSeconds === 0 && (
              <p className="font-body mt-1"
                style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-faint)' }}>
                No rest — tap a value to add rest between sets
              </p>
            )}
          </div>

          <div className="flex gap-6">
            <ToggleField label="Bodyweight" checked={draft.isBodyweight}
              onChange={v => setDraft(d => ({ ...d, isBodyweight: v, startingWeightKg: v ? 0 : d.startingWeightKg }))} />
            <ToggleField label="Timed" checked={draft.isTimed}
              onChange={v => setDraft(d => ({ ...d, isTimed: v }))} />
          </div>

          <div className="pb-2" />
        </div>

        <div className="px-4 pb-6 pt-3 flex-shrink-0" style={{ borderTop: 'var(--border-thin)' }}>
          <button
            onClick={() => onSave(draft, target)}
            className="w-full py-4 font-display uppercase tracking-wide"
            style={{
              fontSize: 'var(--text-h2)', background: 'var(--color-accent)',
              color: '#fff', borderRadius: 'var(--radius-md)', border: 'none',
            }}>
            {target.mode === 'add' ? 'Add Stretch' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── DraggableStretchRow ──────────────────────────────────────────

function DraggableStretchRow({
  item, stretchExMap, onRemove, onEdit, onDragEnd,
}: {
  item: DayStretch;
  stretchExMap: Map<string, Exercise>;
  onRemove: () => void;
  onEdit: () => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  const { unit, toDisplay } = useUnit();
  const ex = stretchExMap.get(item.exerciseId);

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      style={{ listStyle: 'none' }}
    >
      <div className="flex items-center gap-2 py-3" style={{ borderBottom: 'var(--border-thin)' }}>
        <div onPointerDown={e => controls.start(e)}
          style={{ color: 'var(--color-text-faint)', cursor: 'grab', touchAction: 'none', padding: '0.25rem', flexShrink: 0 }}>
          <DotsSixVertical size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
            {ex?.name ?? item.exerciseId}
          </p>
          <p className="font-mono" data-numeric
            style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
            {item.sets > 1 ? `${item.sets}×` : ''}{formatRepRange(item.repRange[0], item.repRange[1], item.isTimed)}
            {!item.isBodyweight && item.startingWeightKg > 0 && ` · ${toDisplay(item.startingWeightKg)}${unit}`}
            {item.restSeconds > 0 && ` · ${item.restSeconds}s rest`}
          </p>
        </div>

        <button onClick={onEdit} aria-label="Configure"
          style={{ color: 'var(--color-text-muted)', padding: '0.25rem', flexShrink: 0 }}>
          <PencilSimple size={18} />
        </button>

        <button onClick={onRemove} aria-label="Remove"
          style={{ color: 'var(--color-text-faint)', padding: '0.25rem', flexShrink: 0 }}>
          <Trash size={18} />
        </button>
      </div>
    </Reorder.Item>
  );
}

// ── DraggableStretchSection ──────────────────────────────────────

function DraggableStretchSection({
  label, phase, items, stretchExMap,
  onReorder, onDragEnd, onRemove, onEdit, onAdd,
}: {
  label: string;
  phase: 'pre' | 'post';
  items: DayStretch[];
  stretchExMap: Map<string, Exercise>;
  onReorder: (newOrder: DayStretch[]) => void;
  onDragEnd: () => void;
  onRemove: (i: number) => void;
  onEdit: (i: number) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <p className="font-body uppercase tracking-widest mb-2"
        style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
        {label}
      </p>

      <Reorder.Group axis="y" values={items} onReorder={onReorder}
        style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item, i) => (
          <DraggableStretchRow
            key={`${phase}-${item.id}`}
            item={item}
            stretchExMap={stretchExMap}
            onRemove={() => onRemove(i)}
            onEdit={() => onEdit(i)}
            onDragEnd={onDragEnd}
          />
        ))}
      </Reorder.Group>

      <button onClick={onAdd} className="flex items-center gap-2 py-3"
        style={{ color: 'var(--color-accent)', fontSize: 'var(--text-meta)' }}>
        <Plus size={16} weight="bold" />
        <span className="font-body">Add stretch</span>
      </button>
    </>
  );
}

// ── TemplateEditor ───────────────────────────────────────────────

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stretchPickerPhase, setStretchPickerPhase] = useState<'pre' | 'post' | null>(null);
  const [configTarget, setConfigTarget] = useState<ConfigTarget | null>(null);
  const [stretchConfigTarget, setStretchConfigTarget] = useState<StretchConfigTarget | null>(null);

  const allExercises = useExercises();
  const exerciseMap = new Map(allExercises.map(e => [e.id, e]));

  const allStretches = useStretches();
  const stretchExMap = new Map(allStretches.map(s => [s.id, s]));

  const [liveTemplate, reloadTemplate] = useTemplate(id ?? '');
  const [stretches, reloadStretches] = useDayStretches(id ?? '');

  // Local exercise state for smooth drag
  const [localExercises, setLocalExercises] = useState<TemplateExercise[]>([]);
  const latestExRef = useRef<TemplateExercise[]>([]);

  // Local stretch state for smooth drag
  const [localPreStretches, setLocalPreStretches] = useState<DayStretch[]>([]);
  const [localPostStretches, setLocalPostStretches] = useState<DayStretch[]>([]);
  const latestPreRef = useRef<DayStretch[]>([]);
  const latestPostRef = useRef<DayStretch[]>([]);

  useEffect(() => {
    if (liveTemplate) {
      setLocalExercises(liveTemplate.exercises);
      latestExRef.current = liveTemplate.exercises;
    }
  }, [liveTemplate]);

  useEffect(() => {
    setLocalPreStretches(stretches.pre);
    setLocalPostStretches(stretches.post);
    latestPreRef.current = stretches.pre;
    latestPostRef.current = stretches.post;
  }, [stretches]);

  const baseTemplate = liveTemplate ?? (id ? defaultTemplateMap.get(id) : undefined);

  if (!baseTemplate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4 px-4"
        style={{ background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Template not found.</p>
        <button onClick={() => navigate('/')} style={{ color: 'var(--color-accent)' }}>← Home</button>
      </div>
    );
  }

  // ── Exercise mutations ──────────────────────────────────────────

  const persist = (exercises: TemplateExercise[]) => {
    setLocalExercises(exercises);
    latestExRef.current = exercises;
    void saveTemplate({ ...baseTemplate, exercises } as WorkoutTemplate).then(reloadTemplate);
  };

  const clearSupersetAt = (exs: TemplateExercise[], index: number): TemplateExercise[] => {
    const groupId = exs[index].supersetGroupId;
    if (!groupId) return exs;
    return exs.map(e => e.supersetGroupId === groupId ? { ...e, isSuperset: false, supersetGroupId: undefined } : e);
  };

  const remove = (index: number) => {
    let ex = [...localExercises];
    ex = clearSupersetAt(ex, index);
    persist(ex.filter((_, i) => i !== index));
  };

  const toggleSuperset = (index: number) => {
    if (index >= localExercises.length - 1) return;
    let ex = [...localExercises];
    const a = ex[index], b = ex[index + 1];
    const paired = a.isSuperset && b.isSuperset && a.supersetGroupId != null && a.supersetGroupId === b.supersetGroupId;
    if (paired) {
      ex[index]     = { ...a, isSuperset: false, supersetGroupId: undefined };
      ex[index + 1] = { ...b, isSuperset: false, supersetGroupId: undefined };
    } else {
      ex = clearSupersetAt(ex, index);
      ex = clearSupersetAt(ex, index + 1);
      const gid = `${baseTemplate.id}-${nanoid(6)}`;
      ex[index]     = { ...ex[index],     isSuperset: true, supersetGroupId: gid };
      ex[index + 1] = { ...ex[index + 1], isSuperset: true, supersetGroupId: gid };
    }
    persist(ex);
  };

  const handleConfigSave = (entry: TemplateExercise, index?: number) => {
    if (index !== undefined) {
      persist(localExercises.map((e, i) => i === index ? entry : e));
    } else {
      persist([...localExercises, entry]);
    }
    setConfigTarget(null);
  };

  const handleReorder = (newOrder: TemplateExercise[]) => {
    setLocalExercises(newOrder);
    latestExRef.current = newOrder;
  };

  const handleDragEnd = () => {
    const sanitized = sanitizeSupersets(latestExRef.current);
    setLocalExercises(sanitized);
    latestExRef.current = sanitized;
    void saveTemplate({ ...baseTemplate, exercises: sanitized } as WorkoutTemplate).then(reloadTemplate);
  };

  // ── Stretch mutations ───────────────────────────────────────────

  const persistStretches = (pre: DayStretch[], post: DayStretch[]) => {
    setLocalPreStretches(pre);
    setLocalPostStretches(post);
    latestPreRef.current = pre;
    latestPostRef.current = post;
    void saveDayStretches(id ?? '', pre, post).then(reloadStretches);
  };

  const removeStretch = (phase: 'pre' | 'post', index: number) => {
    if (phase === 'pre') {
      persistStretches(localPreStretches.filter((_, i) => i !== index), localPostStretches);
    } else {
      persistStretches(localPreStretches, localPostStretches.filter((_, i) => i !== index));
    }
  };

  const handleStretchConfigSave = (item: DayStretch, target: StretchConfigTarget) => {
    if (target.mode === 'add') {
      if (target.phase === 'pre') {
        persistStretches([...localPreStretches, item], localPostStretches);
      } else {
        persistStretches(localPreStretches, [...localPostStretches, item]);
      }
    } else {
      if (target.phase === 'pre') {
        persistStretches(localPreStretches.map((s, i) => i === target.index ? item : s), localPostStretches);
      } else {
        persistStretches(localPreStretches, localPostStretches.map((s, i) => i === target.index ? item : s));
      }
    }
    setStretchConfigTarget(null);
  };

  const handlePreStretchReorder = (newOrder: DayStretch[]) => {
    setLocalPreStretches(newOrder);
    latestPreRef.current = newOrder;
  };

  const handlePreStretchDragEnd = () => {
    void saveDayStretches(id ?? '', latestPreRef.current, latestPostRef.current).then(reloadStretches);
  };

  const handlePostStretchReorder = (newOrder: DayStretch[]) => {
    setLocalPostStretches(newOrder);
    latestPostRef.current = newOrder;
  };

  const handlePostStretchDragEnd = () => {
    void saveDayStretches(id ?? '', latestPreRef.current, latestPostRef.current).then(reloadStretches);
  };

  const currentIds = localExercises.map(e => e.exerciseId);

  return (
    <div className="flex flex-col min-h-dvh mx-auto"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}>

      <header className="flex items-center gap-3 px-4 sticky top-0 z-40"
        style={{ height: 'var(--header-height)', borderBottom: 'var(--border-thin)', background: 'var(--color-bg)' }}>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft size={22} />
        </button>
        <span className="font-display"
          style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)', letterSpacing: '0.03em' }}>
          {baseTemplate.shortLabel}
        </span>
        <span className="font-body ml-1"
          style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
          {localExercises.length} exercises
        </span>
      </header>

      <div className="flex-1 px-4 py-3">

        <DraggableStretchSection
          label="Pre-Workout Stretches"
          phase="pre"
          items={localPreStretches}
          stretchExMap={stretchExMap}
          onReorder={handlePreStretchReorder}
          onDragEnd={handlePreStretchDragEnd}
          onRemove={i => removeStretch('pre', i)}
          onEdit={i => setStretchConfigTarget({ mode: 'edit', phase: 'pre', index: i })}
          onAdd={() => setStretchPickerPhase('pre')}
        />

        <p className="font-body uppercase tracking-widest mt-5 mb-1"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
          Exercises
        </p>

        <Reorder.Group axis="y" values={localExercises} onReorder={handleReorder}
          style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {localExercises.map((entry, index) => (
            <DraggableExerciseRow
              key={`${entry.exerciseId}-${index}`}
              entry={entry}
              index={index}
              total={localExercises.length}
              exerciseMap={exerciseMap}
              nextEntry={localExercises[index + 1]}
              onRemove={() => remove(index)}
              onToggleSuperset={() => toggleSuperset(index)}
              onEdit={() => setConfigTarget({ mode: 'edit', index })}
              onDragEnd={handleDragEnd}
            />
          ))}
        </Reorder.Group>

        <button onClick={() => setPickerOpen(true)}
          className="flex items-center gap-2 w-full py-4 mt-2"
          style={{ color: 'var(--color-accent)', fontSize: 'var(--text-body)' }}>
          <Plus size={18} weight="bold" />
          <span className="font-body">Add exercise</span>
        </button>

        <div className="mt-4" style={{ borderTop: 'var(--border-thin)', paddingTop: '1rem' }}>
          <DraggableStretchSection
            label="Post-Workout Stretches"
            phase="post"
            items={localPostStretches}
            stretchExMap={stretchExMap}
            onReorder={handlePostStretchReorder}
            onDragEnd={handlePostStretchDragEnd}
            onRemove={i => removeStretch('post', i)}
            onEdit={i => setStretchConfigTarget({ mode: 'edit', phase: 'post', index: i })}
            onAdd={() => setStretchPickerPhase('post')}
          />
        </div>

        <div className="pb-8" />
      </div>

      <ExercisePickerDrawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={exerciseId => {
          setPickerOpen(false);
          setConfigTarget({ mode: 'add', exerciseId });
        }}
        excludeIds={currentIds}
        returnTo={`/template/${baseTemplate.id}/edit`}
      />

      <StretchPickerDrawer
        open={stretchPickerPhase !== null}
        onClose={() => setStretchPickerPhase(null)}
        onSelect={exercise => {
          if (stretchPickerPhase) {
            setStretchConfigTarget({ mode: 'add', exerciseId: exercise.id, phase: stretchPickerPhase });
            setStretchPickerPhase(null);
          }
        }}
        excludeIds={[...localPreStretches.map(s => s.exerciseId), ...localPostStretches.map(s => s.exerciseId)]}
      />

      {configTarget && (
        <ExerciseConfigSheet
          target={configTarget}
          templateId={baseTemplate.id}
          exercises={localExercises}
          exerciseMap={exerciseMap}
          onSave={handleConfigSave}
          onClose={() => setConfigTarget(null)}
        />
      )}

      {stretchConfigTarget && (
        <StretchConfigSheet
          target={stretchConfigTarget}
          stretches={{ pre: localPreStretches, post: localPostStretches }}
          stretchExMap={stretchExMap}
          onSave={handleStretchConfigSave}
          onClose={() => setStretchConfigTarget(null)}
        />
      )}
    </div>
  );
}
