import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { PageShell } from '@/components/layout/PageShell';
import { useExercises, useStretches } from '@/hooks/useExercises';
import type { ExerciseCategory } from '@/types';

function formatRepRange(min: number, max: number, isTimed = false): string {
  const unit = isTimed ? 's' : '';
  return min === max ? `${min}${unit}` : `${min}–${max}${unit}`;
}

const CATEGORY_ORDER: ExerciseCategory[] = ['push', 'pull', 'legs', 'core', 'glutes', 'back'];
const STRETCH_CATEGORY_ORDER: ExerciseCategory[] = ['push', 'pull', 'legs', 'core', 'glutes', 'back', 'general'];
const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  push: 'PUSH', pull: 'PULL', legs: 'LEGS', core: 'CORE', glutes: 'GLUTES', back: 'BACK', general: 'GENERAL',
};

type Tab = 'exercises' | 'stretches';

export default function ExerciseLibrary() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'stretches' ? 'stretches' : 'exercises';

  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');

  const allExercises = useExercises();
  const allStretches = useStretches();

  const filteredExercises = query.trim()
    ? allExercises.filter((e) =>
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        e.muscles.some((m) => m.toLowerCase().includes(query.toLowerCase())),
      )
    : allExercises;

  const filteredStretches = query.trim()
    ? allStretches.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : allStretches;

  const isSearching = query.trim().length > 0;

  return (
    <PageShell>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4"
        style={{ height: 'var(--header-height)', background: 'var(--color-bg)', borderBottom: 'var(--border-thin)' }}
      >
        <span className="font-display tracking-widest" style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)' }}>
          {tab === 'exercises' ? 'EXERCISES' : 'STRETCHES'}
        </span>
        <button
          onClick={() => tab === 'exercises' ? navigate('/exercise/new?returnTo=/exercises') : navigate('/exercise/new?isStretch=true&returnTo=/exercises?tab=stretches')}
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
          New
        </button>
      </header>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: 'var(--border-thin)' }}>
        {(['exercises', 'stretches'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setQuery('');
              setSearchParams(t === 'stretches' ? { tab: 'stretches' } : {}, { replace: true });
            }}
            className="flex-1 py-3 font-body uppercase tracking-widest"
            style={{
              fontSize: 'var(--text-micro)',
              color: tab === t ? 'var(--color-accent)' : 'var(--color-text-muted)',
              borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent',
              background: 'transparent',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="px-4 py-3" style={{ borderBottom: 'var(--border-thin)' }}>
        <div
          className="flex items-center gap-2 px-3"
          style={{ background: 'var(--color-surface)', border: 'var(--border-thin)', borderRadius: 'var(--radius-md)' }}
        >
          <MagnifyingGlass size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'exercises' ? 'Search by name or muscle…' : 'Search stretches…'}
            className="flex-1 py-2.5 font-body bg-transparent"
            style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', outline: 'none', border: 'none' }}
          />
        </div>
      </div>

      <main className="pb-4">
        {tab === 'exercises' ? (
          isSearching ? (
            filteredExercises.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
                  No exercises match "{query}"
                </p>
                <button
                  onClick={() => navigate('/exercise/new')}
                  className="mt-4 font-body"
                  style={{ fontSize: 'var(--text-meta)', color: 'var(--color-accent)' }}
                >
                  + Create "{query}"
                </button>
              </div>
            ) : (
              filteredExercises.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => navigate(`/exercise/${ex.id}`)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  style={{ borderBottom: 'var(--border-thin)' }}
                >
                  <span>
                    <span className="font-body block" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                      {ex.name}
                    </span>
                    <span className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {ex.muscles.join(' · ')}
                    </span>
                  </span>
                  <span className="font-mono flex-shrink-0" data-numeric style={{ marginLeft: '0.5rem', fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
                    {ex.defaultRepRange ? formatRepRange(ex.defaultRepRange[0], ex.defaultRepRange[1], ex.isTimed) : ''}
                  </span>
                </button>
              ))
            )
          ) : (
            CATEGORY_ORDER.map((cat) => {
              const catExercises = allExercises.filter((e) => e.category === cat);
              if (catExercises.length === 0) return null;
              return (
                <div key={cat}>
                  <p
                    className="font-body font-medium uppercase tracking-widest px-4 py-2 sticky"
                    style={{
                      fontSize: 'var(--text-micro)',
                      color: 'var(--color-accent)',
                      background: 'var(--color-bg)',
                      top: 'var(--header-height)',
                      zIndex: 10,
                      borderBottom: 'var(--border-thin)',
                    }}
                  >
                    {CATEGORY_LABELS[cat]}
                    <span style={{ color: 'var(--color-text-faint)', marginLeft: '0.5rem' }}>
                      {catExercises.length}
                    </span>
                  </p>
                  {catExercises.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => navigate(`/exercise/${ex.id}`)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left"
                      style={{ borderBottom: 'var(--border-thin)' }}
                    >
                      <span>
                        <span className="font-body block" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                          {ex.name}
                        </span>
                        <span className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
                          {ex.muscles.join(' · ')}
                          {ex.isBodyweight && <span style={{ color: 'var(--color-text-faint)' }}> · Bodyweight</span>}
                        </span>
                      </span>
                      <span className="font-mono" data-numeric style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', flexShrink: 0, marginLeft: '0.5rem' }}>
                        {ex.defaultRepRange ? formatRepRange(ex.defaultRepRange[0], ex.defaultRepRange[1], ex.isTimed) : ''}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })
          )
        ) : (
          // ── Stretches tab ────────────────────────────────────
          filteredStretches.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
                {isSearching ? `No stretches match "${query}"` : 'No stretches in library'}
              </p>
              <button
                onClick={() => navigate('/exercise/new?isStretch=true')}
                className="mt-4 font-body"
                style={{ fontSize: 'var(--text-meta)', color: 'var(--color-accent)' }}
              >
                + Create a stretch
              </button>
            </div>
          ) : isSearching ? (
            filteredStretches.map((s) => {
              const repsDisplay = s.defaultRepRange ? formatRepRange(s.defaultRepRange[0], s.defaultRepRange[1], s.isTimed) : '';
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(`/exercise/${s.id}/edit`)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  style={{ borderBottom: 'var(--border-thin)' }}
                >
                  <span>
                    <span className="font-body block" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                      {s.name}
                    </span>
                    <span className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
                      {repsDisplay}{(s.restSeconds ?? 0) > 0 ? ` · ${s.restSeconds}s rest` : ''}{s.notes ? ` · ${s.notes}` : ''}
                    </span>
                  </span>
                  <span style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-meta)', marginLeft: '0.5rem' }}>Edit</span>
                </button>
              );
            })
          ) : (
            STRETCH_CATEGORY_ORDER.map((cat) => {
              const catStretches = allStretches.filter((s) => s.category === cat);
              if (catStretches.length === 0) return null;
              return (
                <div key={cat}>
                  <p
                    className="font-body font-medium uppercase tracking-widest px-4 py-2 sticky"
                    style={{
                      fontSize: 'var(--text-micro)',
                      color: 'var(--color-accent)',
                      background: 'var(--color-bg)',
                      top: 'var(--header-height)',
                      zIndex: 10,
                      borderBottom: 'var(--border-thin)',
                    }}
                  >
                    {CATEGORY_LABELS[cat]}
                    <span style={{ color: 'var(--color-text-faint)', marginLeft: '0.5rem' }}>
                      {catStretches.length}
                    </span>
                  </p>
                  {catStretches.map((s) => {
                    const repsDisplay = s.defaultRepRange ? formatRepRange(s.defaultRepRange[0], s.defaultRepRange[1], s.isTimed) : '';
                    return (
                      <button
                        key={s.id}
                        onClick={() => navigate(`/exercise/${s.id}/edit`)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                        style={{ borderBottom: 'var(--border-thin)' }}
                      >
                        <span>
                          <span className="font-body block" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                            {s.name}
                          </span>
                          <span className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
                            {repsDisplay}{s.notes ? ` · ${s.notes}` : ''}
                          </span>
                        </span>
                        <span style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-meta)', marginLeft: '0.5rem' }}>Edit</span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )
        )}
      </main>
    </PageShell>
  );
}
