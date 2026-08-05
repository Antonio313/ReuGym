import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { Plus, TrendDown, TrendUp, Image as ImageIcon, X } from '@phosphor-icons/react';
import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ProgressPhotoGrid } from '@/components/stats/ProgressPhotoGrid';
import { getLocalSession } from '@/lib/auth';
import { getDB } from '@/data/db';
import { enqueueSync } from '@/lib/sync';
import { uploadProgressPhoto } from '@/lib/photos';
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
  const PAD = { top: 8, right: 8, bottom: 20, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values = withWeight.map((s) => kgToLbs(s.weightKg!));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

  const coords = withWeight.map((s, i) => ({
    x: PAD.left + (i / (withWeight.length - 1)) * innerW,
    y: PAD.top + innerH - ((kgToLbs(s.weightKg!) - minVal) / range) * innerH,
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

function kgToLbs(kg: number): number {
  return Math.round(kg * 2.2046 * 10) / 10;
}

function lbsToKg(lbs: number): number {
  return lbs / 2.2046;
}

function LogForm({
  latest,
  onSaved,
  onCancel,
}: {
  latest: BodyStat | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  // Input is in lbs; DB stores kg
  const latestLbs = latest?.weightKg != null ? kgToLbs(latest.weightKg).toString() : '';
  const [weightLbsStr, setWeightLbsStr] = useState(latestLbs);
  const [waistStr, setWaistStr] = useState(latest?.waistCm?.toString() ?? '');
  const [chestStr, setChestStr] = useState(latest?.chestCm?.toString() ?? '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<{ file: File; previewUrl: string }[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePickPhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = Array.from(files).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setPhotos((prev) => [...prev, ...next]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSave = async () => {
    const lbs = parseFloat(weightLbsStr);
    if (!weightLbsStr || isNaN(lbs)) return;

    setSaving(true);
    setUploadError(null);
    const entry: BodyStat = {
      id: nanoid(),
      date: startOfToday(),
      weightKg: lbsToKg(lbs),
      waistCm: waistStr ? parseFloat(waistStr) : undefined,
      chestCm: chestStr ? parseFloat(chestStr) : undefined,
      notes: notes.trim() || undefined,
    };
    const user = getLocalSession();
    if (user) {
      let photoPaths: string[] = [];
      if (photos.length > 0) {
        try {
          photoPaths = await Promise.all(photos.map((p) => uploadProgressPhoto(user.id, entry.id, p.file)));
        } catch {
          setUploadError('Photo upload failed — entry saved without photos.');
        }
      }
      entry.photoPaths = photoPaths;

      const db = getDB(user.id);
      await db.bodyStats.put({ ...entry, userId: user.id, photoPaths });
      await enqueueSync(user.id, 'body_stats', 'upsert', {
        id:          entry.id,
        user_id:     user.id,
        date:        entry.date,
        weight_kg:   entry.weightKg ?? null,
        waist_cm:    entry.waistCm ?? null,
        chest_cm:    entry.chestCm ?? null,
        notes:       entry.notes ?? null,
        photo_paths: photoPaths,
      });
    }
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

      {/* Weight — required, input in lbs */}
      <div>
        <p className="font-body mb-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Weight (lbs) *
        </p>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={weightLbsStr}
          onChange={(e) => setWeightLbsStr(e.target.value)}
          placeholder="e.g. 215.0"
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

      {/* Progress photo */}
      <div>
        <p className="font-body mb-1" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Progress photo
        </p>
        {isOnline ? (
          <>
            <div className="flex gap-2 flex-wrap">
              {photos.map((p, i) => (
                <div key={p.previewUrl} className="relative" style={{ width: '4.5rem', height: '4.5rem' }}>
                  <img
                    src={p.previewUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    style={{ borderRadius: 'var(--radius-md)', border: 'var(--border-thin)' }}
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label="Remove photo"
                    className="absolute flex items-center justify-center"
                    style={{
                      top: '-6px', right: '-6px', width: '1.25rem', height: '1.25rem',
                      background: 'var(--color-regression)', borderRadius: '50%', color: '#fff',
                    }}
                  >
                    <X size={12} weight="bold" />
                  </button>
                </div>
              ))}
              <label
                className="flex flex-col items-center justify-center gap-1 cursor-pointer"
                style={{
                  width: '4.5rem', height: '4.5rem',
                  border: '1px dashed var(--color-border-hover)', borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <ImageIcon size={18} />
                <span className="font-body" style={{ fontSize: 'var(--text-micro)' }}>Add</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => { handlePickPhotos(e.target.files); e.target.value = ''; }}
                />
              </label>
            </div>
            {uploadError && (
              <p className="font-body mt-2" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-regression)' }}>
                {uploadError}
              </p>
            )}
          </>
        ) : (
          <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)' }}>
            Connect to the internet to add photos
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !weightLbsStr}
          className="flex-1 py-3 font-display uppercase tracking-wide"
          style={{
            fontSize: 'var(--text-body)',
            background: saving || !weightLbsStr ? 'var(--color-surface-2)' : 'var(--color-accent)',
            color: saving || !weightLbsStr ? 'var(--color-text-muted)' : '#fff',
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

  const [stats, setStats] = useState<BodyStat[] | undefined>(undefined);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const user = getLocalSession();
    if (!user) { setStats([]); return; }
    const db = getDB(user.id);
    db.bodyStats
      .where('userId').equals(user.id)
      .toArray()
      .then((rows) => {
        rows.sort((a, b) => b.date - a.date);
        setStats(rows.map((r) => ({
          id:         r.id,
          date:       r.date,
          weightKg:   r.weightKg,
          waistCm:    r.waistCm,
          chestCm:    r.chestCm,
          notes:      r.notes,
          photoPaths: r.photoPaths,
        })));
      });
  }, [refreshToken]);

  const loading = stats === undefined;
  const latest = stats?.[0] ?? null;
  const previous = stats?.[1] ?? null;

  const latestLbs = latest?.weightKg != null ? kgToLbs(latest.weightKg) : null;
  const previousLbs = previous?.weightKg != null ? kgToLbs(previous.weightKg) : null;
  const weightDelta =
    latestLbs != null && previousLbs != null
      ? +(latestLbs - previousLbs).toFixed(1)
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
          onSaved={() => { setFormOpen(false); setRefreshToken((n) => n + 1); }}
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
                  {latestLbs}
                  <span style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', marginLeft: '0.3rem' }}>lbs</span>
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
                    {weightDelta > 0 ? '+' : ''}{weightDelta} lbs
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

        {/* Progress photos */}
        {!loading && stats && stats.some((s) => (s.photoPaths?.length ?? 0) > 0) && (
          <div className="py-5" style={{ borderBottom: 'var(--border-thin)' }}>
            <p className="font-body uppercase tracking-widest mb-3" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
              Progress Photos
            </p>
            <ProgressPhotoGrid stats={stats} />
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
                    {kgToLbs(stat.weightKg)} lbs
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
