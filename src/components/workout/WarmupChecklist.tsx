import { useState } from 'react';
import { CheckCircle, Circle } from '@phosphor-icons/react';
import { generalWarmup, dayWarmups } from '@/data/warmups';
import type { ExerciseCategory, WarmupItem } from '@/types';

type Props = {
  category: ExerciseCategory;
  onStart: () => void;
};

const DAY_LABELS: Record<ExerciseCategory, string> = {
  push:   'PUSH DAY ADD-ONS',
  pull:   'PULL DAY ADD-ONS',
  legs:   'LEG DAY ADD-ONS',
  core:   'CORE DAY ADD-ONS',
  glutes: 'GLUTE DAY ADD-ONS',
  back:   'BACK DAY ADD-ONS',
};

function CheckItem({
  item,
  checked,
  onToggle,
}: {
  item: WarmupItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-start gap-3 py-3 text-left"
      style={{ borderBottom: 'var(--border-thin)' }}
    >
      <span className="mt-0.5 shrink-0" style={{ color: checked ? 'var(--color-accent)' : 'var(--color-text-faint)' }}>
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
          {item.reps}
          {item.note && (
            <span style={{ color: 'var(--color-text-faint)' }}> · {item.note}</span>
          )}
        </span>
      </span>
    </button>
  );
}

export function WarmupChecklist({ category, onStart }: Props) {
  const specific = dayWarmups[category];
  const allItems = [...generalWarmup, ...specific];
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const done = checked.size;
  const total = allItems.length;

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <div className="px-4 pt-10 pb-4">
        <h1
          className="font-display leading-none"
          style={{ fontSize: 'var(--text-display)', color: 'var(--color-text)' }}
        >
          WARM UP
        </h1>
        <p
          className="font-mono mt-2"
          data-numeric
          style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
        >
          {done} / {total} done
        </p>

        {/* Progress bar */}
        <div
          className="mt-3 h-0.5 w-full overflow-hidden"
          style={{ background: 'var(--color-surface-2)' }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${total > 0 ? (done / total) * 100 : 0}%`,
              background: 'var(--color-accent)',
              transitionDuration: 'var(--duration-base)',
            }}
          />
        </div>
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto px-4">
        {/* General */}
        <p
          className="font-body font-medium uppercase tracking-widest mb-1"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          General
        </p>
        {generalWarmup.map((item) => (
          <CheckItem
            key={item.id}
            item={item}
            checked={checked.has(item.id)}
            onToggle={() => toggle(item.id)}
          />
        ))}

        {/* Day-specific */}
        <p
          className="font-body font-medium uppercase tracking-widest mt-6 mb-1"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-accent)' }}
        >
          {DAY_LABELS[category]}
        </p>
        {specific.map((item) => (
          <CheckItem
            key={item.id}
            item={item}
            checked={checked.has(item.id)}
            onToggle={() => toggle(item.id)}
          />
        ))}
      </div>

      {/* Start button */}
      <div className="px-4 py-6" style={{ borderTop: 'var(--border-thin)' }}>
        <button
          onClick={onStart}
          className="w-full py-4 font-display tracking-wide uppercase"
          style={{
            fontSize: 'var(--text-h2)',
            background: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
          }}
        >
          Start Workout →
        </button>
      </div>
    </div>
  );
}
