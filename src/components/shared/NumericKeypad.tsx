import { ArrowLeft } from '@phosphor-icons/react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
  onDone: () => void;
};

const ROWS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', '⌫'],
];

export function NumericKeypad({ value, onChange, decimal = false, onDone }: Props) {
  const handleKey = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (!decimal || value.includes('.')) return;
      onChange(value === '' ? '0.' : value + '.');
      return;
    }
    // Prevent leading zeros (e.g. "007")
    if (value === '0' && key !== '.') {
      onChange(key);
      return;
    }
    onChange(value + key);
  };

  return (
    <div className="w-full">
      {/* Display row */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: 'var(--border-thin)' }}
      >
        <span
          className="font-mono"
          style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', color: 'var(--color-text)', minWidth: '4ch' }}
        >
          {value || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}
        </span>
        <button
          type="button"
          onClick={onDone}
          className="font-body font-medium px-4 py-2"
          style={{
            fontSize: 'var(--text-body)',
            color: 'var(--color-accent)',
            background: 'var(--color-accent-dim)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-accent)',
          }}
        >
          Done
        </button>
      </div>

      {/* Key grid */}
      <div className="grid grid-cols-3 gap-px p-1" style={{ background: 'var(--color-border)' }}>
        {ROWS.flat().map((key) => {
          const isDisabled = key === '.' && (!decimal || value.includes('.'));
          const isBlank = key === '.' && !decimal;

          return (
            <button
              key={key}
              type="button"
              disabled={isDisabled}
              onClick={() => !isBlank && handleKey(key)}
              className="flex items-center justify-center py-4"
              style={{
                background: 'var(--color-surface)',
                fontSize: key === '⌫' ? '1rem' : 'var(--text-h2)',
                fontFamily: key === '⌫' ? 'inherit' : 'var(--font-mono)',
                color: isDisabled || isBlank
                  ? 'var(--color-text-faint)'
                  : 'var(--color-text)',
                cursor: isBlank ? 'default' : 'pointer',
              }}
            >
              {key === '⌫' ? <ArrowLeft size={20} /> : isBlank ? '' : key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
