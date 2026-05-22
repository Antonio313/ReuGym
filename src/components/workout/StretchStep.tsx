import { useState, useEffect, useRef } from 'react';
import { VideoReference } from '@/components/workout/VideoReference';
import type { Exercise } from '@/types';

type Props = {
  stretch: Exercise;
  restSeconds: number;
  index: number;
  total: number;
  phase: 'pre' | 'post';
  nextStretch?: Exercise;
  nextRestSeconds?: number;
  onNext: () => void;
};

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function StretchStep({ stretch, restSeconds, index, total, phase, nextStretch, onNext }: Props) {
  const [isResting, setIsResting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parsedDuration = stretch.isTimed ? stretch.defaultRepRange[1] : null;
  const [timerSeconds, setTimerSeconds] = useState(parsedDuration ?? 0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLast = index === total - 1;

  useEffect(() => {
    const dur = stretch.isTimed ? stretch.defaultRepRange[1] : null;
    setIsResting(false);
    setSecondsLeft(0);
    setTimerSeconds(dur ?? 0);
    setTimerRunning(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
  }, [stretch.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isResting || secondsLeft !== 0) return;
    setIsResting(false);
    onNext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResting, secondsLeft]);

  useEffect(() => {
    if (!timerRunning || timerSeconds !== 0) return;
    setTimerRunning(false);
  }, [timerRunning, timerSeconds]);

  const startStretchTimer = () => {
    if (timerRunning) return;
    setTimerRunning(true);
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) { clearInterval(timerIntervalRef.current!); timerIntervalRef.current = null; return 0; }
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
    if (isLast || restSeconds <= 0) { onNext(); return; }
    setIsResting(true);
    setSecondsLeft(restSeconds);
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) { clearInterval(intervalRef.current!); intervalRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSkipRest = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsResting(false);
    onNext();
  };

  const repsDisplay = stretch.isTimed
    ? `${stretch.defaultRepRange[0]}–${stretch.defaultRepRange[1]}s`
    : `${stretch.defaultRepRange[0]}–${stretch.defaultRepRange[1]} reps`;

  const phaseLabel = phase === 'pre' ? 'Pre-Workout' : 'Post-Workout';

  return (
    <div
      className="flex flex-col min-h-dvh mx-auto px-4 py-6 gap-6"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}
    >
      <div className="flex items-center justify-between">
        <p className="font-body uppercase tracking-widest" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
          {phaseLabel}
        </p>
        <p className="font-mono" data-numeric style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
          {index + 1} / {total}
        </p>
      </div>

      {isResting ? (
        <div className="flex flex-col items-center gap-6 flex-1">
          <p className="font-display tracking-widest" style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text-muted)', letterSpacing: '0.15em' }}>
            REST
          </p>
          <span className="font-mono" data-numeric style={{ fontSize: 'clamp(3rem, 15vw, 6rem)', color: secondsLeft <= 3 ? 'var(--color-accent)' : 'var(--color-text)', lineHeight: 1, transition: 'color 300ms' }}>
            {formatTime(secondsLeft)}
          </span>

          {nextStretch && (
            <div className="w-full text-center">
              <p className="font-body mb-1" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>Up next</p>
              <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>{nextStretch.name}</p>
              <p className="font-mono mt-1" data-numeric style={{ fontSize: 'var(--text-h3)', color: 'var(--color-accent)' }}>
                {nextStretch.isTimed
                  ? `${nextStretch.defaultRepRange[0]}–${nextStretch.defaultRepRange[1]}s`
                  : `${nextStretch.defaultRepRange[0]}–${nextStretch.defaultRepRange[1]} reps`}
              </p>
              {nextStretch.notes && (
                <p className="font-body mt-1" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  {nextStretch.notes}
                </p>
              )}
              {nextStretch.videoUrl && (
                <div className="mt-3 flex justify-center">
                  <VideoReference videoUrl={nextStretch.videoUrl} />
                </div>
              )}
            </div>
          )}

          <button type="button" onClick={handleSkipRest} className="font-body px-8 py-3"
            style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', border: 'var(--border-thin)', borderRadius: 'var(--radius-md)', background: 'transparent' }}>
            Skip Rest
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1">
            <div style={{ height: '2px', background: 'var(--color-border)', marginBottom: '1.5rem' }} />
            <h2 className="font-display leading-tight mb-3" style={{ fontSize: 'clamp(1.75rem, 7vw, 2.5rem)', color: 'var(--color-text)', letterSpacing: '0.02em' }}>
              {stretch.name.toUpperCase()}
            </h2>
            <p className="font-mono mb-4" data-numeric style={{ fontSize: 'var(--text-h2)', color: 'var(--color-accent)' }}>
              {repsDisplay}
            </p>
            {stretch.notes && (
              <p className="font-body mb-4" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                {stretch.notes}
              </p>
            )}
            {stretch.videoUrl && (
              <div className="mb-4">
                <VideoReference videoUrl={stretch.videoUrl} />
              </div>
            )}

            {parsedDuration !== null && (
              <div className="flex items-center gap-4 px-4 py-4 mt-2"
                style={{ background: 'var(--color-surface)', border: 'var(--border-thin)', borderRadius: 'var(--radius-md)' }}>
                <span className="font-mono flex-1" data-numeric style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', color: timerRunning && timerSeconds <= 5 ? 'var(--color-accent)' : 'var(--color-text)', lineHeight: 1, transition: 'color 300ms' }}>
                  {formatTime(timerSeconds)}
                </span>
                {timerSeconds === 0 || !timerRunning ? (
                  timerSeconds === 0 ? (
                    <button type="button" onClick={resetStretchTimer} className="font-body px-4 py-2"
                      style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', border: 'var(--border-thin)', borderRadius: 'var(--radius-sm)', background: 'transparent' }}>
                      Reset
                    </button>
                  ) : (
                    <button type="button" onClick={startStretchTimer} className="font-body px-4 py-2"
                      style={{ fontSize: 'var(--text-meta)', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)' }}>
                      Start
                    </button>
                  )
                ) : (
                  <button type="button" onClick={resetStretchTimer} className="font-body px-4 py-2"
                    style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', border: 'var(--border-thin)', borderRadius: 'var(--radius-sm)', background: 'transparent' }}>
                    Reset
                  </button>
                )}
              </div>
            )}
            <div style={{ height: '2px', background: 'var(--color-border)', marginTop: '1.5rem' }} />
          </div>

          <button type="button" onClick={handleDone} className="w-full py-4 font-display uppercase tracking-wide"
            style={{ fontSize: 'var(--text-h2)', background: 'var(--color-accent)', color: '#fff', borderRadius: 'var(--radius-md)', border: 'none', letterSpacing: '0.05em' }}>
            Done
          </button>
        </>
      )}
    </div>
  );
}
