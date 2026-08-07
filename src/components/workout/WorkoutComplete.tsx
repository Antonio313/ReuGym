import { motion, useReducedMotion, type Variants } from 'motion/react';
import { useUnit } from '@/hooks/useUnit';

export type CompletionStats = {
  durationSeconds: number;
  exercisesCompleted: number;
  totalSets: number;
  prsHit: number;
  totalVolumeKg: number;
};

type Props = {
  stats: CompletionStats;
  onHome: () => void;
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function WorkoutComplete({ stats, onHome }: Props) {
  const reduceMotion = useReducedMotion();
  const { unit, toDisplay } = useUnit();

  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.08, delayChildren: reduceMotion ? 0 : 0.05 } },
  };
  const item: Variants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0, 0, 0.2, 1] } },
  };

  return (
    <motion.div
      className="flex flex-col min-h-dvh mx-auto px-4 py-8 gap-8 items-center justify-center"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {/* Title */}
      <motion.div className="text-center" variants={item}>
        <p
          className="font-body uppercase tracking-widest mb-2"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          Session Complete
        </p>
        <h1
          className="font-display"
          style={{
            fontSize: 'clamp(2.5rem, 10vw, 4rem)',
            color: 'var(--color-accent)',
            letterSpacing: '0.02em',
            lineHeight: 1,
          }}
        >
          WORKOUT
        </h1>
        <h1
          className="font-display"
          style={{
            fontSize: 'clamp(2.5rem, 10vw, 4rem)',
            color: 'var(--color-text)',
            letterSpacing: '0.02em',
            lineHeight: 1,
          }}
        >
          COMPLETE
        </h1>
      </motion.div>

      {/* Duration */}
      <motion.div className="text-center" variants={item}>
        <span
          className="font-mono"
          data-numeric
          style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', color: 'var(--color-text)' }}
        >
          {formatDuration(stats.durationSeconds)}
        </span>
      </motion.div>

      {/* Stats grid */}
      <motion.div className="w-full grid grid-cols-2 gap-3" variants={item}>
        <StatCard label="Exercises" value={String(stats.exercisesCompleted)} />
        <StatCard label="Sets" value={String(stats.totalSets)} />
        <StatCard
          label="PRs"
          value={String(stats.prsHit)}
          highlight={stats.prsHit > 0}
        />
        <StatCard
          label="Volume"
          value={`${toDisplay(stats.totalVolumeKg).toLocaleString()}${unit}`}
        />
      </motion.div>

      {/* Home button */}
      <motion.button
        type="button"
        onClick={onHome}
        variants={item}
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        className="w-full py-4 font-display uppercase tracking-wide"
        style={{
          fontSize: 'var(--text-h2)',
          background: 'var(--color-accent)',
          color: '#fff',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          letterSpacing: '0.05em',
        }}
      >
        Home
      </motion.button>
    </motion.div>
  );
}

function StatCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="flex flex-col items-center py-4 px-3"
      style={{
        background: 'var(--color-surface)',
        border: highlight ? '1px solid var(--color-accent)' : 'var(--border-thin)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <span
        className="font-mono"
        data-numeric
        style={{ fontSize: 'var(--text-h1)', color: highlight ? 'var(--color-accent)' : 'var(--color-text)' }}
      >
        {value}
      </span>
      <span
        className="font-body uppercase tracking-widest mt-1"
        style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
      >
        {label}
      </span>
    </div>
  );
}
