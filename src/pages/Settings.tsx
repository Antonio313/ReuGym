import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen } from '@phosphor-icons/react';
import { PageShell } from '@/components/layout/PageShell';
import { useAuth } from '@/context/AuthContext';
import type { WeightUnit } from '@/lib/auth';

const UNITS: { id: WeightUnit; label: string }[] = [
  { id: 'kg', label: 'Kilograms (kg)' },
  { id: 'lbs', label: 'Pounds (lbs)' },
];

export default function Settings() {
  const navigate = useNavigate();
  const { user, setWeightUnit, openOnboarding } = useAuth();
  const [saving, setSaving] = useState<WeightUnit | null>(null);

  const handleSelect = async (unit: WeightUnit) => {
    if (!user || unit === user.weightUnit) return;
    setSaving(unit);
    try {
      await setWeightUnit(unit);
    } finally {
      setSaving(null);
    }
  };

  return (
    <PageShell>
      <header
        className="flex items-center gap-3 px-4 sticky top-0 z-40"
        style={{
          height: 'var(--header-height)',
          borderBottom: 'var(--border-thin)',
          background: 'var(--color-bg)',
        }}
      >
        <button onClick={() => navigate(-1)} style={{ color: 'var(--color-text-muted)' }} aria-label="Go back">
          <ArrowLeft size={22} />
        </button>
        <h1
          className="font-display"
          style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)', letterSpacing: '0.02em' }}
        >
          SETTINGS
        </h1>
      </header>

      <main className="px-4 py-5">
        <p
          className="font-body uppercase tracking-widest mb-3"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          Weight Unit
        </p>

        <div className="flex flex-col gap-2">
          {UNITS.map(({ id, label }) => {
            const active = user?.weightUnit === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => void handleSelect(id)}
                disabled={saving !== null}
                className="flex items-center justify-between w-full py-4 px-4 font-body"
                style={{
                  fontSize: 'var(--text-body)',
                  background: active ? 'var(--color-accent-dim)' : 'var(--color-surface)',
                  border: active ? '1px solid var(--color-accent)' : 'var(--border-thin)',
                  borderRadius: 'var(--radius-md)',
                  color: active ? 'var(--color-accent)' : 'var(--color-text)',
                }}
              >
                {label}
                {saving === id && (
                  <span className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
                    Saving…
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p
          className="font-body mt-3"
          style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)' }}
        >
          Applies to lifting weights and Body Stats.
        </p>

        <p
          className="font-body uppercase tracking-widest mb-3 mt-8"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          Help
        </p>

        <button
          type="button"
          onClick={openOnboarding}
          className="flex items-center gap-3 w-full py-4 px-4 font-body"
          style={{
            fontSize: 'var(--text-body)',
            background: 'var(--color-surface)',
            border: 'var(--border-thin)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text)',
          }}
        >
          <BookOpen size={20} style={{ color: 'var(--color-text-muted)' }} />
          Replay welcome guide
        </button>
      </main>
    </PageShell>
  );
}
