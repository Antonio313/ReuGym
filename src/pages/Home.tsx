import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { PencilSimple, ChatCircle } from '@phosphor-icons/react';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { AIChatDrawer } from '@/components/workout/AIChatDrawer';
import { useTemplate } from '@/hooks/useTemplates';
import { useActiveLoadoutId, useLoadoutName } from '@/hooks/useLoadouts';
import { templateMap as defaultTemplateMap, DAY_CATEGORIES } from '@/data/templates';
import { getLocalSession } from '@/lib/auth';
import { getDB } from '@/data/db';
import type { ExerciseCategory } from '@/types';

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

function formatToday(): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

type DayCardProps = {
  category: ExerciseCategory;
  lastSessions: Record<string, number>;
  variants: Variants;
};

function DayCard({ category, lastSessions, variants }: DayCardProps) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const activeId = useActiveLoadoutId(category);
  const meta = defaultTemplateMap.get(activeId);
  const loadoutName = useLoadoutName(activeId);
  const [liveTemplate] = useTemplate(activeId);
  // Falls back to the static count only while the live query is still
  // loading (undefined) — once it resolves, it's the source of truth,
  // including a genuine 0 if the user has emptied this day.
  const exerciseCount = liveTemplate?.exercises.length ?? meta?.exercises.length ?? 0;
  const [showEmptyWarning, setShowEmptyWarning] = useState(false);
  const lastSessionDate = lastSessions[activeId];
  // Loadout 1's id is always the bare category — anything else means the
  // user has switched this day away from its default, which is worth
  // surfacing clearly so Start never runs a loadout they don't expect.
  const isNonDefaultLoadout = activeId !== category;

  const handleStart = () => {
    if (exerciseCount === 0) {
      setShowEmptyWarning(true);
      setTimeout(() => setShowEmptyWarning(false), 3000);
      return;
    }
    navigate(`/workout/${activeId}`);
  };

  return (
    <motion.div
      variants={variants}
      className="relative flex flex-col gap-2 p-4"
      style={{
        background: 'var(--color-surface)',
        border: 'var(--border-medium)',
        borderRadius: 'var(--radius-md)',
        minHeight: '9rem',
      }}
    >
      {/* Edit icon */}
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/template/${activeId}/edit`); }}
        className="absolute top-3 right-3"
        style={{ color: 'var(--color-text-faint)' }}
        aria-label={`Edit ${meta?.name ?? category}`}
      >
        <PencilSimple size={16} />
      </button>

      {/* Day label */}
      <span
        className="font-display leading-none"
        style={{
          fontSize: 'clamp(2rem, 8vw, 3rem)',
          color: 'var(--color-text)',
          letterSpacing: '-0.01em',
        }}
      >
        {meta?.shortLabel ?? category.toUpperCase()}
      </span>

      {/* Active loadout — only shown when it's not the day's default */}
      {isNonDefaultLoadout && (
        <span
          className="font-body uppercase tracking-widest"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-accent)' }}
        >
          {loadoutName}
        </span>
      )}

      {/* Exercise count */}
      <span
        className="font-body"
        style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
      >
        {exerciseCount} exercise{exerciseCount === 1 ? '' : 's'}
      </span>

      {/* Last session / empty-day warning */}
      <span
        className="font-body"
        style={{
          fontSize: 'var(--text-meta)',
          color: showEmptyWarning ? 'var(--color-regression)' : 'var(--color-text-faint)',
        }}
      >
        {showEmptyWarning
          ? 'No exercises yet — tap the pencil to add some.'
          : lastSessionDate ? `Last: ${formatDate(lastSessionDate)}` : 'Never done'}
      </span>

      {/* Start button */}
      <motion.button
        onClick={handleStart}
        whileTap={reduceMotion ? undefined : { scale: 0.96 }}
        transition={{ duration: 0.12, ease: [0.32, 0.72, 0, 1] }}
        className="mt-auto self-start font-body font-medium"
        style={{
          fontSize: 'var(--text-meta)',
          color: 'var(--color-accent)',
          border: '1px solid var(--color-accent)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.35rem 0.85rem',
          background: 'transparent',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Start
      </motion.button>
    </motion.div>
  );
}

export default function Home() {
  const isSunday = new Date().getDay() === 0;
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const cardContainer: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } },
  };
  const cardItem: Variants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0, 0, 0.2, 1] } },
  };

  const [aiOpen, setAiOpen] = useState(false);
  const [lastSessions, setLastSessions] = useState<Record<string, number>>({});

  useEffect(() => {
    const user = getLocalSession();
    if (!user) return;
    const db = getDB(user.id);
    db.sessions
      .where('userId').equals(user.id)
      .filter((s) => s.completedAt != null)
      .toArray()
      .then((rows) => {
        rows.sort((a, b) => b.startedAt - a.startedAt);
        const results: Record<string, number> = {};
        for (const row of rows) {
          if (!results[row.templateId]) results[row.templateId] = row.completedAt!;
        }
        setLastSessions(results);
      });
  }, []);

  return (
    <PageShell>
      <Header subtitle={formatToday()} />

      <main className="flex flex-col gap-3 p-4">
        {/* Day cards grid */}
        <motion.div
          className="grid grid-cols-2 gap-3"
          variants={cardContainer}
          initial="hidden"
          animate="visible"
        >
          {DAY_CATEGORIES.map((category) => (
            <DayCard
              key={category}
              category={category}
              lastSessions={lastSessions}
              variants={cardItem}
            />
          ))}
        </motion.div>

        {/* Sunday body stats CTA */}
        {isSunday && (
          <button
            onClick={() => navigate('/stats')}
            className="w-full py-3 font-body font-medium"
            style={{
              fontSize: 'var(--text-meta)',
              color: 'var(--color-text-muted)',
              border: 'var(--border-thin)',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              letterSpacing: '0.02em',
            }}
          >
            Log today's body stats →
          </button>
        )}
      </main>

      {/* Floating AI chat button */}
      <motion.button
        onClick={() => setAiOpen(true)}
        aria-label="Open AI assistant"
        whileTap={reduceMotion ? undefined : { scale: 0.92 }}
        transition={{ duration: 0.12, ease: [0.32, 0.72, 0, 1] }}
        style={{
          position: 'fixed',
          bottom: 'calc(var(--bottom-nav-height) + 1rem)',
          right: '1rem',
          width: '3rem',
          height: '3rem',
          borderRadius: '50%',
          background: 'var(--color-accent)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(255, 77, 0, 0.35)',
          zIndex: 30,
        }}
      >
        <ChatCircle size={22} weight="fill" />
      </motion.button>

      <AIChatDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onActionsApplied={() => setAiOpen(false)}
      />
    </PageShell>
  );
}
