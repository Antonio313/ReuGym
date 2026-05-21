import { useState, useEffect, useRef } from 'react';
import { VideoReference } from '@/components/workout/VideoReference';
import type { DayStretch } from '@/types';

type Props = {
  stretch: DayStretch;
  index: number;
  total: number;
  phase: 'pre' | 'post';
  nextStretch?: DayStretch;
  onNext: () => void;
};

// Parse seconds from strings like "45s/side", "60 seconds", "20–30 seconds" (takes max)
function parseTimerSeconds(reps: string): number | null {
  const match = reps.match(/(\d+)(?:\s*[–\-]\s*(\d+))?\s*s(?:ec(?:ond)?s?)?(?:\/|\s|$)/i);
  if (!match) return null;
  return match[2] ? parseInt(match[2], 10) : parseInt(match[1], 10);
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function StretchStep({ stretch, index, total, phase, nextStretch, onNext }: Props) {
  const [isResting, setIsResting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parsedDuration = parseTimerSeconds(stretch.reps);
  const [timerSeconds, setTimerSeconds] = useState(parsedDuration ?? 0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLast = index === total - 1;

  // Reset all state when stretch changes
  useEffect(() => {
    const dur = parseTimerSeconds(stretch.reps);
    setIsResting(false);
    setSecondsLeft(0);
    setTimerSeconds(dur ?? 0);
    setTimerRunning(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
  }, [stretch.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rest countdown reaches 0 → advance (outside updater to avoid setState-during-render)
  useEffect(() => {
    if (!isResting || secondsLeft !== 0) return;
    setIsResting(false);
    onNext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResting, secondsLeft]);

  // Stretch timer reaches 0 → stop running
  useEffect(() => {
    if (!timerRunning || timerSeconds !== 0) return;
    setTimerRunning(false);
  }, [timerRunning, timerSeconds]);

  const startStretchTimer = () => {
    if (timerRunning) return;
    setTimerRunning(true);
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          timerIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetStretchTimer = () => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    setTimerRunning(false);
    setTimerSeconds(parsedDuration ?? 0);
  };

  const handleDone = () => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    // Last stretch: skip rest entirely
    if (isLast || stretch.restSeconds <= 0) {
      onNext();
      return;
    }
    setIsResting(true);
    setSecondsLeft(stretch.restSeconds);
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSkipRest = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsResting(false);
    onNext();
  };

  const phaseLabel = phase === 'pre' ? 'Pre-Workout' : 'Post-Workout';

  return (
    <div
      className="flex flex-col min-h-dvh mx-auto px-4 py-6 gap-6"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}
    >
      {/* Phase + counter */}
      <div className="flex items-center justify-between">
        <p
          className="font-body uppercase tracking-widest"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          {phaseLabel}
        </p>
        <p
          className="font-mono"
          data-numeric
          style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
        >
          {index + 1} / {total}
        </p>
      </div>

      {isResting ? (
        /* Rest countdown */
        <div className="flex flex-col items-center gap-6 flex-1">
          <p
            className="font-display tracking-widest"
            style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text-muted)', letterSpacing: '0.15em' }}
          >
            REST
          </p>
          <span
            className="font-mono"
            data-numeric
            style={{
              fontSize: 'clamp(3rem, 15vw, 6rem)',
              color: secondsLeft <= 3 ? 'var(--color-accent)' : 'var(--color-text)',
              lineHeight: 1,
              transition: 'color 300ms',
            }}
          >
            {formatTime(secondsLeft)}
          </span>

          {/* Next stretch preview */}
          {nextStretch && (
            <div className="w-full text-center">
              <p
                className="font-body mb-1"
                style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
              >
                Up next
              </p>
              <p
                className="font-body"
                style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}
              >
                {nextStretch.name}
              </p>
              <p
                className="font-mono mt-1"
                data-numeric
                style={{ fontSize: 'var(--text-h3)', color: 'var(--color-accent)' }}
              >
                {nextStretch.reps}
              </p>
              {nextStretch.note && (
                <p
                  className="font-body mt-1"
                  style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}
                >
                  {nextStretch.note}
                </p>
              )}
              {nextStretch.videoUrl && (
                <div className="mt-3 flex justify-center">
                  <VideoReference videoUrl={nextStretch.videoUrl} />
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleSkipRest}
            className="font-body px-8 py-3"
            style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-muted)',
              border: 'var(--border-thin)',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
            }}
          >
            Skip Rest
          </button>
        </div>
      ) : (
        /* Active stretch */
        <>
          <div className="flex-1">
            <div style={{ height: '2px', background: 'var(--color-border)', marginBottom: '1.5rem' }} />

            <h2
              className="font-display leading-tight mb-3"
              style={{ fontSize: 'clamp(1.75rem, 7vw, 2.5rem)', color: 'var(--color-text)', letterSpacing: '0.02em' }}
            >
              {stretch.name.toUpperCase()}
            </h2>

            <p
              className="font-mono mb-4"
              data-numeric
              style={{ fontSize: 'var(--text-h2)', color: 'var(--color-accent)' }}
            >
              {stretch.reps}
            </p>

            {stretch.note && (
              <p
                className="font-body mb-4"
                style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}
              >
                {stretch.note}
              </p>
            )}

            {stretch.videoUrl && (
              <div className="mb-4">
                <VideoReference videoUrl={stretch.videoUrl} />
              </div>
            )}

            {/* Optional stretch timer for timed stretches */}
            {parsedDuration !== null && (
              <div
                className="flex items-center gap-4 px-4 py-4 mt-2"
                style={{
                  background: 'var(--color-surface)',
                  border: 'var(--border-thin)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <span
                  className="font-mono flex-1"
                  data-numeric
                  style={{
                    fontSize: 'clamp(2rem, 8vw, 3rem)',
                    color: timerRunning && timerSeconds <= 5 ? 'var(--color-accent)' : 'var(--color-text)',
                    lineHeight: 1,
                    transition: 'color 300ms',
                  }}
                >
                  {formatTime(timerSeconds)}
                </span>
                {timerSeconds === 0 ? (
                  <button
                    type="button"
                    onClick={resetStretchTimer}
                    className="font-body px-4 py-2"
                    style={{
                      fontSize: 'var(--text-meta)',
                      color: 'var(--color-text-muted)',
                      border: 'var(--border-thin)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'transparent',
                    }}
                  >
                    Reset
                  </button>
                ) : timerRunning ? (
                  <button
                    type="button"
                    onClick={resetStretchTimer}
                    className="font-body px-4 py-2"
                    style={{
                      fontSize: 'var(--text-meta)',
                      color: 'var(--color-text-muted)',
                      border: 'var(--border-thin)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'transparent',
                    }}
                  >
                    Reset
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startStretchTimer}
                    className="font-body px-4 py-2"
                    style={{
                      fontSize: 'var(--text-meta)',
                      background: 'var(--color-accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    Start
                  </button>
                )}
              </div>
            )}

            <div style={{ height: '2px', background: 'var(--color-border)', marginTop: '1.5rem' }} />
          </div>

          <button
            type="button"
            onClick={handleDone}
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
            Done
          </button>
        </>
      )}
    </div>
  );
}
