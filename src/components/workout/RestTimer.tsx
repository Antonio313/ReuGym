import { motion, useReducedMotion } from 'motion/react';
import { VideoReference } from '@/components/workout/VideoReference';
import type { Exercise } from '@/types';

type Props = {
  secondsRemaining: number;
  totalSeconds: number;
  nextLabel: string;
  nextExercise?: Exercise;
  nextTargetWeight?: number | null;
  nextTargetReps?: [number, number];
  onSkip: () => void;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RestTimer({ secondsRemaining, totalSeconds, nextLabel, nextExercise, nextTargetWeight, nextTargetReps, onSkip }: Props) {
  const progress = totalSeconds > 0 ? secondsRemaining / totalSeconds : 0;
  const reduceMotion = useReducedMotion();
  const urgent = secondsRemaining <= 5 && secondsRemaining > 0;

  return (
    <div
      className="flex flex-col items-center justify-center min-h-dvh px-6 gap-8"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Label */}
      <p
        className="font-display tracking-widest"
        style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text-muted)', letterSpacing: '0.15em' }}
      >
        REST
      </p>

      {/* Progress bar */}
      <div
        className="w-full"
        style={{
          height: '4px',
          background: 'var(--color-surface-2)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: 'var(--color-accent)',
            transition: 'width 1s linear',
            borderRadius: '2px',
          }}
        />
      </div>

      {/* Countdown — a fresh element each tick gives the number a subtle pulse-in,
          stronger in the final few seconds; skipped entirely for reduced-motion. */}
      <motion.span
        key={secondsRemaining}
        className="font-mono"
        data-numeric
        initial={reduceMotion ? false : { scale: urgent ? 1.18 : 1.06, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
        style={{
          fontSize: 'clamp(3rem, 15vw, 6rem)',
          color: urgent ? 'var(--color-accent)' : 'var(--color-text)',
          lineHeight: 1,
          transition: 'color var(--duration-base) var(--ease-out)',
          display: 'inline-block',
        }}
      >
        {formatTime(secondsRemaining)}
      </motion.span>

      {/* Next set label + exercise details */}
      <div className="text-center w-full">
        <p
          className="font-body"
          style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
        >
          Up next
        </p>
        <p
          className="font-body mt-1"
          style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}
        >
          {nextLabel}
        </p>

        {/* Next exercise weight/reps */}
        {nextExercise && nextTargetReps && (
          <p
            className="font-mono mt-2"
            data-numeric
            style={{ fontSize: 'var(--text-h3)', color: 'var(--color-accent)' }}
          >
            {nextTargetWeight == null
              ? `Bodyweight · ${nextTargetReps[0]}–${nextTargetReps[1]} reps`
              : `${nextTargetWeight}kg × ${nextTargetReps[0]}–${nextTargetReps[1]}`}
          </p>
        )}

        {/* Form video */}
        {nextExercise?.videoUrl && (
          <div className="mt-4 flex justify-center">
            <VideoReference videoUrl={nextExercise.videoUrl} />
          </div>
        )}
      </div>

      {/* Skip */}
      <motion.button
        type="button"
        onClick={onSkip}
        whileTap={reduceMotion ? undefined : { scale: 0.96 }}
        transition={{ duration: 0.12, ease: [0.32, 0.72, 0, 1] }}
        className="font-body px-8 py-3"
        style={{
          fontSize: 'var(--text-body)',
          color: 'var(--color-text-muted)',
          border: 'var(--border-thin)',
          borderRadius: 'var(--radius-md)',
          background: 'transparent',
        }}
      >
        Skip
      </motion.button>
    </div>
  );
}
