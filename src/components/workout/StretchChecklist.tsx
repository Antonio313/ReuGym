import { useState } from 'react';
import { CheckCircle, Circle } from '@phosphor-icons/react';
import { staticStretches } from '@/data/stretches';
import type { StretchItem } from '@/types';

type Props = {
  onFinish: () => void;
};

function StretchItem({
  item,
  checked,
  onToggle,
}: {
  item: StretchItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-start gap-3 py-3 text-left"
      style={{ borderBottom: 'var(--border-thin)' }}
    >
      <span className="mt-0.5 shrink-0" style={{ color: checked ? 'var(--color-success)' : 'var(--color-text-faint)' }}>
        {checked ? <CheckCircle size={20} weight="fill" /> : <Circle size={20} />}
      </span>
      <span className="flex-1 min-w-0">
        <span
          className="font-body block"
          style={{
            fontSize: 'var(--text-body)',
            color: checked ? 'var(--color-text-faint)' : 'var(--color-text)',
            textDecoration: checked ? 'line-through' : 'none',
          }}
        >
          {item.name}
        </span>
        <span
          className="font-mono"
          data-numeric
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          {item.duration}
          {item.note && (
            <span style={{ color: 'var(--color-text-faint)' }}> · {item.note}</span>
          )}
        </span>
      </span>
    </button>
  );
}

export function StretchChecklist({ onFinish }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const done = checked.size;
  const total = staticStretches.length;

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <div className="px-4 pt-10 pb-4">
        <h1
          className="font-display leading-none"
          style={{ fontSize: 'var(--text-display)', color: 'var(--color-text)' }}
        >
          COOL DOWN
        </h1>
        <p
          className="font-mono mt-2"
          data-numeric
          style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
        >
          {done} / {total} done
        </p>

        {/* Progress bar — success green */}
        <div
          className="mt-3 h-0.5 w-full overflow-hidden"
          style={{ background: 'var(--color-surface-2)' }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${total > 0 ? (done / total) * 100 : 0}%`,
              background: 'var(--color-success)',
              transitionDuration: 'var(--duration-base)',
            }}
          />
        </div>
      </div>

      {/* Stretch list */}
      <div className="flex-1 overflow-y-auto px-4">
        <p
          className="font-body font-medium uppercase tracking-widest mb-1"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          Hold each stretch 30–60 seconds
        </p>
        {staticStretches.map((item) => (
          <StretchItem
            key={item.id}
            item={item}
            checked={checked.has(item.id)}
            onToggle={() => toggle(item.id)}
          />
        ))}
      </div>

      {/* Finish button */}
      <div className="px-4 py-6" style={{ borderTop: 'var(--border-thin)' }}>
        <button
          onClick={onFinish}
          className="w-full py-4 font-display tracking-wide uppercase"
          style={{
            fontSize: 'var(--text-h2)',
            background: 'var(--color-success)',
            color: '#0A0A0A',
            borderRadius: 'var(--radius-md)',
            border: 'none',
          }}
        >
          Done →
        </button>
      </div>
    </div>
  );
}
