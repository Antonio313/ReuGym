import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClockCounterClockwise, Trophy, Export, Upload, DeviceMobile } from '@phosphor-icons/react';
import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { getLocalSession } from '@/lib/auth';
import { getDB } from '@/data/db';
import { initialSync } from '@/lib/sync';
import { exportData, importFromJson, migrateFromIndexedDB, type ImportResult } from '@/lib/dataTransfer';
import { useExercises } from '@/hooks/useExercises';
import { useTemplates } from '@/hooks/useTemplates';
import { useLoadoutNameOverrides } from '@/hooks/useLoadouts';
import { templateMap as defaultTemplateMap } from '@/data/templates';
import type { WorkoutSession } from '@/types';

// ─── Helpers ────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function formatDate(ts: number): string {
  return dateFormatter.format(new Date(ts));
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

// ─── Types ──────────────────────────────────────────────────────

type EnrichedSession = {
  session: WorkoutSession;
  workSetCount: number;
  prCount: number;
  exerciseIds: string[];
};

// ─── Session card ────────────────────────────────────────────────

function SessionCard({
  data,
  exerciseMap,
  templateLabel,
  loadoutLabel,
}: {
  data: EnrichedSession;
  exerciseMap: Map<string, string>;
  templateLabel: string;
  loadoutLabel?: string;
}) {
  const { session, workSetCount, prCount, exerciseIds } = data;
  const navigate = useNavigate();

  const MAX_SHOWN = 3;
  const shownIds = exerciseIds.slice(0, MAX_SHOWN);
  const overflow = exerciseIds.length - MAX_SHOWN;

  const goToSession = () => navigate(`/session/${session.id}`);

  return (
    <div
      className="px-4 py-4 cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={goToSession}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToSession(); } }}
      style={{ borderBottom: 'var(--border-thin)' }}
    >
      {/* Top row: day label (+ loadout, if not the default) + date */}
      <div className="flex items-baseline justify-between mb-2">
        <span className="flex items-baseline gap-2">
          <span
            className="font-display"
            style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)', letterSpacing: '0.05em' }}
          >
            {templateLabel}
          </span>
          {loadoutLabel && (
            <span
              className="font-body uppercase tracking-widest"
              style={{ fontSize: 'var(--text-micro)', color: 'var(--color-accent)' }}
            >
              {loadoutLabel}
            </span>
          )}
        </span>
        <span
          className="font-body"
          style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
        >
          {formatDate(session.startedAt)}
        </span>
      </div>

      {/* Exercise list — tappable links */}
      <p
        className="font-body mb-3"
        style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}
      >
        {shownIds.map((id, i) => (
          <span key={id}>
            {i > 0 && <span style={{ color: 'var(--color-text-faint)' }}> · </span>}
            <Link
              to={`/exercise/${id}`}
              onClick={(e) => e.stopPropagation()}
              style={{ color: 'var(--color-text-muted)' }}
            >
              {exerciseMap.get(id) ?? id}
            </Link>
          </span>
        ))}
        {overflow > 0 && (
          <span style={{ color: 'var(--color-text-faint)' }}> +{overflow} more</span>
        )}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        <span
          className="font-mono"
          data-numeric
          style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
        >
          {workSetCount} sets
        </span>

        {prCount > 0 && (
          <span
            className="flex items-center gap-1 font-body"
            style={{ fontSize: 'var(--text-meta)', color: 'var(--color-accent)' }}
          >
            <Trophy size={13} weight="fill" />
            {prCount} PR{prCount > 1 ? 's' : ''}
          </span>
        )}

        {session.durationSeconds != null && (
          <span
            className="font-mono"
            data-numeric
            style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
          >
            {formatDuration(session.durationSeconds)}
          </span>
        )}
      </div>

      {session.notes && (
        <p
          className="font-body mt-2"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-faint)', fontStyle: 'italic', lineHeight: 1.5 }}
        >
          {session.notes}
        </p>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────

export default function WorkoutHistory() {
  const allExercises = useExercises();
  const exerciseMap = new Map(allExercises.map((e) => [e.id, e.name]));

  const liveTemplates = useTemplates() ?? [];
  const liveTemplateMap = new Map(liveTemplates.map((t) => [t.id, t]));
  const loadoutNameOverrides = useLoadoutNameOverrides();

  const getTemplateLabel = (templateId: string): string => {
    const live = liveTemplateMap.get(templateId);
    if (live) return live.shortLabel;
    return defaultTemplateMap.get(templateId)?.shortLabel ?? templateId.toUpperCase();
  };

  // Only surfaced for a non-default loadout — an unmodified day's sessions
  // look exactly as they always have.
  const getLoadoutLabel = (templateId: string): string | undefined => {
    const meta = defaultTemplateMap.get(templateId);
    if (!meta || meta.loadoutSlot === 1) return undefined;
    return loadoutNameOverrides.get(templateId) ?? meta.name;
  };

  const [enrichedSessions, setEnrichedSessions] = useState<EnrichedSession[] | undefined>(undefined);
  const [transferState, setTransferState] = useState<'idle' | 'exporting' | 'importing' | 'migrating'>('idle');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refreshRef = useRef(0);

  const handleExport = async () => {
    const user = getLocalSession();
    if (!user) return;
    setTransferState('exporting');
    try {
      await exportData(user.id);
    } finally {
      setTransferState('idle');
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const user = getLocalSession();
    if (!user) return;
    setTransferState('importing');
    setImportError(null);
    setImportResult(null);
    setShowImportMenu(false);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = await importFromJson(json, user.id);
      // Pull all imported data from Supabase into Dexie so the UI reflects it
      await initialSync(user.id);
      setImportResult(result);
      refreshRef.current += 1;
      setEnrichedSessions(undefined);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import file.');
    } finally {
      setTransferState('idle');
    }
  };

  const handleMigrate = async () => {
    const user = getLocalSession();
    if (!user) return;
    setTransferState('migrating');
    setImportError(null);
    setImportResult(null);
    setShowImportMenu(false);
    try {
      const result = await migrateFromIndexedDB(user.id);
      // Pull migrated data from Supabase into Dexie so the UI reflects it
      await initialSync(user.id);
      setImportResult(result);
      setEnrichedSessions(undefined);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Migration failed.');
    } finally {
      setTransferState('idle');
    }
  };

  useEffect(() => {
    const user = getLocalSession();
    if (!user) { setEnrichedSessions([]); return; }

    const load = async () => {
      const db = getDB(user.id);

      const sessionRows = await db.sessions
        .where('userId').equals(user.id)
        .filter((s) => s.completedAt != null)
        .toArray();
      sessionRows.sort((a, b) => b.startedAt - a.startedAt);

      if (sessionRows.length === 0) { setEnrichedSessions([]); return; }

      const sessionIds = new Set(sessionRows.map((s) => s.id));
      const allSets = await db.sets
        .where('userId').equals(user.id)
        .filter((s) => sessionIds.has(s.sessionId))
        .toArray();

      const setsBySession = new Map<string, typeof allSets>();
      for (const s of allSets) {
        const arr = setsBySession.get(s.sessionId) ?? [];
        arr.push(s);
        setsBySession.set(s.sessionId, arr);
      }

      const enriched: EnrichedSession[] = sessionRows.map((row) => {
        const session: WorkoutSession = {
          id:              row.id,
          templateId:      row.templateId,
          startedAt:       row.startedAt,
          completedAt:     row.completedAt,
          durationSeconds: row.durationSeconds,
          notes:           row.notes,
        };
        const sets = setsBySession.get(session.id) ?? [];
        const workSets = sets.filter((s) => !s.isWarmup);
        const prCount = workSets.filter((s) => s.isPR).length;

        const seenIds = new Set<string>();
        const exerciseIds: string[] = [];
        const sorted = [...sets].sort((a, b) => a.completedAt - b.completedAt);
        for (const s of sorted) {
          if (!seenIds.has(s.exerciseId)) {
            seenIds.add(s.exerciseId);
            exerciseIds.push(s.exerciseId);
          }
        }

        return { session, workSetCount: workSets.length, prCount, exerciseIds };
      });

      setEnrichedSessions(enriched);
    };

    void load();
  }, []);

  const loading = enrichedSessions === undefined;
  const empty = !loading && enrichedSessions.length === 0;

  return (
    <PageShell>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4"
        style={{
          height: 'var(--header-height)',
          background: 'var(--color-bg)',
          borderBottom: 'var(--border-thin)',
        }}
      >
        <span
          className="font-display tracking-widest"
          style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)' }}
        >
          HISTORY
        </span>

        <div className="flex items-center gap-3">
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={transferState !== 'idle'}
            className="flex items-center gap-1.5 font-body"
            style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
            title="Export backup"
          >
            <Export size={16} />
            <span>{transferState === 'exporting' ? 'Exporting…' : 'Export'}</span>
          </button>

          {/* Import menu trigger */}
          <div className="relative">
            <button
              onClick={() => setShowImportMenu((v) => !v)}
              disabled={transferState !== 'idle'}
              className="flex items-center gap-1.5 font-body"
              style={{ fontSize: 'var(--text-meta)', color: 'var(--color-accent)' }}
            >
              <Upload size={16} />
              <span>
                {transferState === 'importing' ? 'Importing…' : transferState === 'migrating' ? 'Migrating…' : 'Import'}
              </span>
            </button>

            {showImportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowImportMenu(false)} />
                <div
                  className="absolute right-0 top-full mt-1 flex flex-col z-50"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  minWidth: '13rem',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}
              >
                <button
                  onClick={() => { setShowImportMenu(false); fileInputRef.current?.click(); }}
                  className="flex items-center gap-2 px-4 py-3 font-body text-left"
                  style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', borderBottom: 'var(--border-thin)' }}
                >
                  <Upload size={15} />
                  From file
                </button>
                <button
                  onClick={handleMigrate}
                  className="flex items-center gap-2 px-4 py-3 font-body text-left"
                  style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}
                >
                  <DeviceMobile size={15} />
                  From this browser
                </button>
                <p className="px-4 pb-3 font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-faint)', lineHeight: 1.4 }}>
                  "From this browser" migrates data from the old app stored locally on this device.
                </p>
              </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileImport}
        style={{ display: 'none' }}
      />

      {/* Import result / error banner */}
      {importResult && (
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: 'var(--color-surface)', borderBottom: 'var(--border-thin)' }}
        >
          <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-success)' }}>
            Imported {importResult.sessions} sessions · {importResult.sets} sets
            {importResult.bodyStats > 0 ? ` · ${importResult.bodyStats} body stats` : ''}
          </p>
          <button onClick={() => setImportResult(null)} style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-meta)' }}>✕</button>
        </div>
      )}
      {importError && (
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: 'var(--color-surface)', borderBottom: 'var(--border-thin)' }}
        >
          <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-regression)' }}>
            {importError}
          </p>
          <button onClick={() => setImportError(null)} style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-meta)' }}>✕</button>
        </div>
      )}

      <main>
        {loading && (
          <div>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="px-4 py-4"
                style={{ borderBottom: 'var(--border-thin)', opacity: 0.4 }}
              >
                <div
                  className="mb-2"
                  style={{ height: '1.25rem', width: '6rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}
                />
                <div
                  className="mb-3"
                  style={{ height: '0.875rem', width: '80%', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}
                />
                <div
                  style={{ height: '0.75rem', width: '40%', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
            ))}
          </div>
        )}

        {empty && (
          <div className="px-4 pt-16">
            <EmptyState
              icon={<ClockCounterClockwise size={32} />}
              title="No sessions yet"
              description="Complete your first workout and it'll appear here."
            />
          </div>
        )}

        {!loading && !empty && enrichedSessions.map((data) => (
          <SessionCard
            key={data.session.id}
            data={data}
            exerciseMap={exerciseMap}
            templateLabel={getTemplateLabel(data.session.templateId)}
            loadoutLabel={getLoadoutLabel(data.session.templateId)}
          />
        ))}
      </main>
    </PageShell>
  );
}
