import { useEffect, useState } from 'react';
import { CaretLeft, CaretRight, X } from '@phosphor-icons/react';
import { getSignedPhotoUrls } from '@/lib/photos';
import type { BodyStat } from '@/types';

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

type PhotoEntry = { path: string; date: number; notes?: string };

// `stats` is expected reverse-chronological (newest first), matching how BodyStats loads it.
export function ProgressPhotoGrid({ stats }: { stats: BodyStat[] }) {
  const entries: PhotoEntry[] = stats.flatMap((s) =>
    (s.photoPaths ?? []).map((path) => ({ path, date: s.date, notes: s.notes })),
  );

  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (entries.length === 0) return;
    let cancelled = false;
    getSignedPhotoUrls(entries.map((e) => e.path)).then((map) => {
      if (!cancelled) setUrls(map);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  if (entries.length === 0) return null;

  const open = openIndex != null ? entries[openIndex] : null;

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {entries.map((e, i) => {
          const url = urls.get(e.path);
          return (
            <button
              key={e.path}
              onClick={() => setOpenIndex(i)}
              className="relative aspect-square overflow-hidden"
              style={{ borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', border: 'var(--border-thin)' }}
            >
              {url ? (
                <img src={url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full animate-pulse" style={{ background: 'var(--color-surface-2)' }} />
              )}
            </button>
          );
        })}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setOpenIndex(null)}
        >
          <div className="flex items-center justify-between px-4 py-4 flex-shrink-0">
            <div>
              <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                {dateFormatter.format(new Date(open.date))}
              </p>
              {open.notes && (
                <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  {open.notes}
                </p>
              )}
            </div>
            <button onClick={() => setOpenIndex(null)} aria-label="Close" style={{ color: 'var(--color-text-muted)' }}>
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center px-4 min-h-0" onClick={(e) => e.stopPropagation()}>
            {urls.get(open.path) && (
              <img src={urls.get(open.path)} alt="" className="max-w-full max-h-full object-contain" style={{ borderRadius: 'var(--radius-md)' }} />
            )}
          </div>

          <div className="flex items-center justify-between px-4 py-5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              disabled={openIndex === 0}
              onClick={() => setOpenIndex((idx) => (idx != null ? Math.max(0, idx - 1) : idx))}
              style={{ color: openIndex === 0 ? 'var(--color-text-faint)' : 'var(--color-text-muted)' }}
              aria-label="Previous photo"
            >
              <CaretLeft size={22} />
            </button>
            <span className="font-mono" data-numeric style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)' }}>
              {(openIndex ?? 0) + 1} / {entries.length}
            </span>
            <button
              disabled={openIndex === entries.length - 1}
              onClick={() => setOpenIndex((idx) => (idx != null ? Math.min(entries.length - 1, idx + 1) : idx))}
              style={{ color: openIndex === entries.length - 1 ? 'var(--color-text-faint)' : 'var(--color-text-muted)' }}
              aria-label="Next photo"
            >
              <CaretRight size={22} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
