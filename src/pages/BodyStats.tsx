import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { nanoid } from 'nanoid';
import { Plus, TrendDown, TrendUp } from '@phosphor-icons/react';
import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { db } from '@/data/db';
import type { BodyStat } from '@/types';

// ─── Helpers ────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDate(ts: number) {
  return dateFormatter.format(new Date(ts));
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ─── Chart ──────────────────────────────────────────────────────

function WeightChart({ stats }: { stats: BodyStat[] }) {
  const withWeight = stats.filter((s) => s.weightKg != null);
  if (withWeight.length < 2) return null;

  const W = 400;
  const H = 90;
  const PAD = { top: 8, right: 8, bottom: 20, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values = withWeight.map((s) => s.weightKg!);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

  const coords = withWeight.map((s, i) => ({
    x: PAD.left + (i / (withWeight.length - 1)) * innerW,
    y: PAD.top + innerH - ((s.weightKg! - minVal) / range) * innerH,
    label: shortDate.format(new Date(s.date)),
  }));

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-hidden>
      {[minVal, maxVal].map((v) => {
        const y = PAD.top + innerH - ((v - minVal) / range) * innerH;
        return (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--color-border)" strokeWidth="1" />
            <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize="9" fill="var(--color-text-faint)" fontFamily="var(--font-mono)">{v}</text>
          </g>
        );
      })}
      <polyline points={polyline} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <polygon
        points={`${PAD.left},${PAD.top + innerH} ${polyline} ${W - PAD.right},${PAD.top + innerH}`}
        fill="var(--color-accent)" opacity="0.08"
      />
      {coords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--color-accent)" />)}
      {[coords[0], coords[coords.length - 1]].map((c, i) => (
        <text key={i} x={c.x} y={H - 2} textAnchor={i === 0 ? 'start' : 'end'} fontSize="9" fill="var(--color-text-faint)" fontFamily="var(--font-body)">{c.label}</text>
      ))}
    </svg>
  );
}

// ─── Log form ────────────────────────────────────────────────────

function LogForm({
  latest,
  onSaved,
  onCancel,
}: {
  latest: BodyStat | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [weightStr, setWeightStr] = useState(latest?.weightKg?.toString() ?? '');
  const [waistStr, setWaistStr] = useState(latest?.waistCm?.toString() ?? '');
  const [chestStr, setChestStr] = useState(latest?.chestCm?.toString() ?? '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const weight = parseFloat(weightStr);
    if (!weightStr || isNaN(weight)) return;

    setSaving(true);
    const entry: BodyStat = {
      id: nanoid(),
      date: startOfToday(),
      weightKg: weight,
      waistCm: waistStr ? parseFloat(waistStr) : undefined,
      chestCm: chestStr ? parseFloat(chestStr) : undefined,
      notes: notes.trim() || undefined,
    };
    await db.bodyStats.add(entry);
    setSaving(false);
    onSaved();
  };

  const inputStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-thin)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text)',
    fontSize: 'var(--text-body)',
    outline: 'none',
  };

  return (
    <div
      className="flex flex-col gap-4 px-4 py-5"
      style={{ borderBottom: 'var(--border-thin)', background: 'var(--color-surface)' }}
    >
      <p className="font-body uppercase tracking-widest" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
        Log Entry — {formatDate(Date.now())}
      </p>

      {/* Weight — required */}
      <div>
        <p className="font-body mb-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Weight (kg) *
        </p>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={weightStr}
          onChange={(e) => setWeightStr(e.target.value)}
          placeholder="e.g. 96.0"
          className="w-full font-mono px-3 py-3"
          data-numeric
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Waist */}
        <div>
          <p className="font-body mb-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Waist (cm)
          </p>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={waistStr}
            onChange={(e) => setWaistStr(e.target.value)}
            placeholder={latest?.waistCm?.toString() ?? '—'}
            className="w-full font-mono px-3 py-3"
            data-numeric
            style={inputStyle}
          />
        </div>

        {/* Chest */}
        <div>
          <p className="font-body mb-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Chest (cm)
          </p>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={chestStr}
            onChange={(e) => setChestStr(e.target.value)}
            placeholder={latest?.chestCm?.toString() ?? '—'}
            className="w-full font-mono px-3 py-3"
            data-numeric
            style={inputStyle}
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="font-body mb-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Notes
        </p>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
          className="w-full font-body px-3 py-3"
          style={inputStyle}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !weightStr}
          className="flex-1 py-3 font-display uppercase tracking-wide"
          style={{
            fontSize: 'var(--text-body)',
            background: saving || !weightStr ? 'var(--color-surface-2)' : 'var(--color-accent)',
            color: saving || !weightStr ? 'var(--color-text-muted)' : '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-3 font-body"
          style={{
            fontSize: 'var(--text-body)',
            color: 'var(--color-text-muted)',
            border: 'var(--border-thin)',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────

export default function BodyStats() {
  const [formOpen, setFormOpen] = useState(false);

  const stats = useLiveQuery(
    () => db.bodyStats.orderBy('date').reverse().toArray(),
    [],
  );

  const loading = stats === undefined;
  const latest = stats?.[0] ?? null;
  const previous = stats?.[1] ?? null;

  const weightDelta =
    latest?.weightKg != null && previous?.weightKg != null
      ? +(latest.weightKg - previous.weightKg).toFixed(1)
      : null;

  const chronological = stats ? [...stats].reverse() : [];

  return (
    <PageShell>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4"
        style={{ height: 'var(--header-height)', background: 'var(--color-bg)', borderBottom: 'var(--border-thin)' }}
      >
        <span className="font-display tracking-widest" style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)' }}>
          BODY STATS
        </span>
        {!formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-1.5 font-body px-3 py-1.5"
            style={{
              fontSize: 'var(--text-meta)',
              color: 'var(--color-accent)',
              border: '1px solid var(--color-accent)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-accent-dim)',
            }}
          >
            <Plus size={14} weight="bold" />
            Add
          </button>
        )}
      </header>

      {/* Log form */}
      {formOpen && (
        <LogForm
          latest={latest}
          onSaved={() => setFormOpen(false)}
          onCancel={() => setFormOpen(false)}
        />
      )}

      <main className="px-4 pb-8">

        {/* Current stats */}
        {!loading && latest && (
          <div className="py-5" style={{ borderBottom: 'var(--border-thin)' }}>
            <p className="font-body uppercase tracking-widest mb-3" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
              Current — {formatDate(latest.date)}
            </p>
            <div className="flex gap-6 flex-wrap">
              {/* Weight */}
              <div>
                <p className="font-mono" data-numeric style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', color: 'var(--color-text)', lineHeight: 1 }}>
                  {latest.weightKg}
                  <span style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', marginLeft: '0.3rem' }}>kg</span>
                </p>
                {weightDelta !== null && (
                  <p
                    className="flex items-center gap-1 font-mono mt-1"
                    data-numeric
                    style={{
                      fontSize: 'var(--text-meta)',
                      color: weightDelta < 0 ? 'var(--color-success)' : weightDelta > 0 ? 'var(--color-regression)' : 'var(--color-text-muted)',
                    }}
                  >
                    {weightDelta < 0 ? <TrendDown size={14} weight="bold" /> : weightDelta > 0 ? <TrendUp size={14} weight="bold" /> : null}
                    {weightDelta > 0 ? '+' : ''}{weightDelta}kg
                  </p>
                )}
              </div>

              {/* Waist */}
              {latest.waistCm != null && (
                <div>
                  <p className="font-body uppercase tracking-widest mb-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>Waist</p>
                  <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)' }}>
                    {latest.waistCm}<span style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', marginLeft: '0.2rem' }}>cm</span>
                  </p>
                </div>
              )}

              {/* Chest */}
              {latest.chestCm != null && (
                <div>
                  <p className="font-body uppercase tracking-widest mb-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>Chest</p>
                  <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)' }}>
                    {latest.chestCm}<span style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', marginLeft: '0.2rem' }}>cm</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Weight trend chart */}
        {!loading && chronological.length >= 2 && (
          <div className="py-5" style={{ borderBottom: 'var(--border-thin)' }}>
            <p className="font-body uppercase tracking-widest mb-3" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
              Weight Trend
            </p>
            <WeightChart stats={chronological} />
          </div>
        )}

        {/* History */}
        <div className="pt-4">
          <p className="font-body uppercase tracking-widest mb-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
            History
          </p>

          {!loading && stats!.length === 0 && !formOpen && (
            <div className="pt-8">
              <EmptyState
                icon={<Plus size={28} />}
                title="No stats logged"
                description="Tap Add to log your weight and measurements."
              />
            </div>
          )}

          {stats?.map((stat) => (
            <div
              key={stat.id}
              className="flex items-center justify-between py-3"
              style={{ borderBottom: 'var(--border-thin)' }}
            >
              <div>
                <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                  {formatDate(stat.date)}
                </p>
                {stat.notes && (
                  <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)', fontStyle: 'italic' }}>
                    {stat.notes}
                  </p>
                )}
              </div>
              <div className="text-right">
                {stat.weightKg != null && (
                  <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                    {stat.weightKg}kg
                  </p>
                )}
                <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
                  {[stat.waistCm != null ? `${stat.waistCm}cm waist` : null, stat.chestCm != null ? `${stat.chestCm}cm chest` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </PageShell>
  );
}
