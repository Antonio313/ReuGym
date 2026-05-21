import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStretchLibrary } from '@/hooks/useStretchLibrary';
import type { DayStretch } from '@/types';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (stretch: DayStretch) => void;
};

export function StretchPickerDrawer({ open, onClose, onSelect }: Props) {
  const library = useStretchLibrary();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = library.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="mt-auto flex flex-col"
        style={{
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          borderRadius: '12px 12px 0 0',
          maxHeight: '75dvh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: 'var(--border-thin)' }}
        >
          <span className="font-display" style={{ fontSize: 'var(--text-h3)', letterSpacing: '0.05em' }}>
            ADD STRETCH
          </span>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3" style={{ borderBottom: 'var(--border-thin)' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stretches..."
            className="w-full px-3 py-2 rounded-md font-body"
            style={{
              background: 'var(--color-surface-2)',
              border: 'var(--border-thin)',
              color: 'var(--color-text)',
              fontSize: 'var(--text-body)',
              outline: 'none',
            }}
            autoFocus
          />
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 && (
            <p
              className="px-4 py-8 text-center font-body"
              style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-body)' }}
            >
              No stretches found
            </p>
          )}
          {filtered.map((stretch) => (
            <button
              key={stretch.id}
              className="w-full flex items-start px-4 py-3 text-left"
              style={{ borderBottom: 'var(--border-thin)' }}
              onClick={() => { onSelect(stretch); onClose(); }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                  {stretch.name}
                </p>
                <p className="font-body mt-0.5" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
                  {stretch.reps}
                  {stretch.restSeconds > 0 && ` · ${stretch.restSeconds}s rest`}
                </p>
              </div>
              <span style={{ color: 'var(--color-accent)', fontSize: 'var(--text-meta)', marginLeft: '0.5rem' }}>
                + Add
              </span>
            </button>
          ))}
        </div>

        {/* Create new */}
        <div className="px-4 py-3" style={{ borderTop: 'var(--border-thin)' }}>
          <button
            className="w-full py-3 rounded-md font-body"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px dashed var(--color-border-hover)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-body)',
            }}
            onClick={() => navigate('/stretch/new')}
          >
            + Create new stretch
          </button>
        </div>
      </div>
    </div>
  );
}
