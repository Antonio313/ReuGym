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

      {/* Countdown */}
      <span
        className="font-mono"
        data-numeric
        style={{
          fontSize: 'clamp(3rem, 15vw, 6rem)',
          color: secondsRemaining <= 5 ? 'var(--color-accent)' : 'var(--color-text)',
          lineHeight: 1,
          transition: 'color 300ms',
        }}
      >
        {formatTime(secondsRemaining)}
      </span>

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
      <button
        type="button"
        onClick={onSkip}
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
      </button>
    </div>
  );
}
