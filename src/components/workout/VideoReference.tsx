import { useState } from 'react';
import { parseVideoUrl } from '@/lib/videoHelper';

type Props = { videoUrl: string };

export function VideoReference({ videoUrl }: Props) {
  const [open, setOpen] = useState(false);
  const info = parseVideoUrl(videoUrl);

  if (!info) {
    return (
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-body"
        style={{
          fontSize: 'var(--text-meta)',
          color: 'var(--color-accent)',
          border: '1px solid var(--color-accent)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.3rem 0.75rem',
          background: 'transparent',
          textDecoration: 'none',
        }}
      >
        ▶ Open reference video
      </a>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 font-body"
        style={{
          fontSize: 'var(--text-meta)',
          color: 'var(--color-accent)',
          border: '1px solid var(--color-accent)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.3rem 0.75rem',
          background: 'transparent',
        }}
      >
        ▶ Form video ↓
      </button>
    );
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="font-body mb-2"
        style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
      >
        ✕ Close
      </button>

      {info.platform === 'youtube' ? (
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 'var(--radius-md)' }}>
          <iframe
            src={info.embedUrl}
            title="Form video"
            allow="autoplay; encrypted-media"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: 'var(--radius-md)',
            }}
          />
        </div>
      ) : (
        <div
          className="flex items-center gap-3 p-4"
          style={{
            background: 'var(--color-surface)',
            border: 'var(--border-thin)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>♪</span>
          <a
            href={info.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body font-medium"
            style={{ fontSize: 'var(--text-body)', color: 'var(--color-accent)', textDecoration: 'none' }}
          >
            Open TikTok video →
          </a>
        </div>
      )}
    </div>
  );
}
