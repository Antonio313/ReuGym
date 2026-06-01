import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { useStretches } from '@/hooks/useExercises';
import type { Exercise, ExerciseCategory } from '@/types';

const CATEGORY_ORDER: ExerciseCategory[] = ['push', 'pull', 'legs', 'core', 'glutes', 'back', 'general'];
const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  push: 'PUSH', pull: 'PULL', legs: 'LEGS', core: 'CORE', glutes: 'GLUTES', back: 'BACK', general: 'GENERAL',
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (stretch: Exercise) => void;
  excludeIds?: string[];
};

export function StretchPickerDrawer({ open, onClose, onSelect, excludeIds = [] }: Props) {
  const allStretches = useStretches();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const excludeSet = new Set(excludeIds);

  const filtered = search.trim()
    ? allStretches.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : allStretches;

  if (!open) return null;

  const handleCreate = () => {
    onClose();
    navigate('/exercise/new?isStretch=true');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="mt-auto flex flex-col"
        style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', borderRadius: '12px 12px 0 0', maxHeight: '75dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: 'var(--border-thin)' }}>
          <span className="font-display" style={{ fontSize: 'var(--text-h3)', letterSpacing: '0.05em' }}>ADD STRETCH</span>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>✕</button>
        </div>

        {/* Search */}
        <div className="px-4 py-3" style={{ borderBottom: 'var(--border-thin)' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stretches…"
            className="w-full px-3 py-2 rounded-md font-body"
            style={{ background: 'var(--color-surface-2)', border: 'var(--border-thin)', color: 'var(--color-text)', fontSize: 'var(--text-body)', outline: 'none' }}
          />
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {search.trim() ? (
            filtered.length === 0 ? (
              <p className="px-4 py-8 text-center font-body" style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-body)' }}>
                No stretches found
              </p>
            ) : (
              filtered.map((s) => <StretchRow key={s.id} stretch={s} already={excludeSet.has(s.id)} onSelect={() => { onSelect(s); onClose(); }} />)
            )
          ) : (
            CATEGORY_ORDER.map((cat) => {
              const catStretches = filtered.filter((s) => s.category === cat);
              if (catStretches.length === 0) return null;
              return (
                <div key={cat}>
                  <p className="font-body font-medium uppercase tracking-widest px-4 py-1.5 sticky top-0"
                    style={{ fontSize: 'var(--text-micro)', color: 'var(--color-accent)', background: 'var(--color-surface)', zIndex: 1 }}>
                    {CATEGORY_LABELS[cat]}
                  </p>
                  {catStretches.map((s) => (
                    <StretchRow key={s.id} stretch={s} already={excludeSet.has(s.id)} onSelect={() => { onSelect(s); onClose(); }} />
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Create new */}
        <div className="px-4 py-3" style={{ borderTop: 'var(--border-thin)' }}>
          <button
            className="w-full py-3 rounded-md font-body flex items-center justify-center gap-2"
            style={{ background: 'var(--color-surface-2)', border: '1px dashed var(--color-border-hover)', color: 'var(--color-text-muted)', fontSize: 'var(--text-body)' }}
            onClick={handleCreate}
          >
            <Plus size={14} weight="bold" />
            Create new stretch
          </button>
        </div>
      </div>
    </div>
  );
}

function StretchRow({ stretch, already, onSelect }: { stretch: Exercise; already: boolean; onSelect: () => void }) {
  const dr = stretch.defaultRepRange;
  const repsDisplay = dr
    ? (stretch.isTimed ? `${dr[0]}–${dr[1]}s` : `${dr[0]}–${dr[1]} reps`)
    : '';

  return (
    <button
      className="w-full flex items-start px-4 py-3 text-left"
      style={{ borderBottom: 'var(--border-thin)', opacity: already ? 0.35 : 1 }}
      disabled={already}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>{stretch.name}</p>
        <p className="font-body mt-0.5" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
          {repsDisplay}
          {(stretch.restSeconds ?? 0) > 0 && ` · ${stretch.restSeconds}s rest`}
        </p>
      </div>
      {already ? (
        <span style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-micro)', marginLeft: '0.5rem' }}>Added</span>
      ) : (
        <span style={{ color: 'var(--color-accent)', fontSize: 'var(--text-meta)', marginLeft: '0.5rem' }}>+ Add</span>
      )}
    </button>
  );
}
