import { useState, useEffect, useRef } from 'react';
import { VideoReference } from '@/components/workout/VideoReference';
import type { DayStretch, Exercise } from '@/types';

type Props = {
  stretch: Exercise;
  assignment: DayStretch;
  index: number;
  total: number;
  phase: 'pre' | 'post';
  nextStretch?: Exercise;
  nextAssignment?: DayStretch;
  onNext: () => void;
  onDefer?: () => void;
  onSkipEntirely?: () => void;
};

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatRepRange(min: number, max: number, isTimed = false): string {
  const unit = isTimed ? 's' : ' reps';
  return min === max ? `${min}${unit}` : `${min}–${max}${unit}`;
}

export function StretchStep({
  stretch, assignment, index, total, phase, nextStretch, nextAssignment, onNext, onDefer, onSkipEntirely,
}: Props) {
  const { sets, repRange, isTimed, restSeconds, startingWeightKg, isBodyweight } = assignment;

  const timerDuration = isTimed ? repRange[1] : null;

  const [currentSet, setCurrentSet] = useState(1);
  const [currentSide, setCurrentSide] = useState<'left' | 'right'>('left');
  const [isResting, setIsResting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(timerDuration ?? 0);
  const [timerRunning, setTimerRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInterSetRestRef = useRef(false);

  const isLast = index === total - 1;

  // Reset everything when the stretch changes
  useEffect(() => {
    setCurrentSet(1);
    setCurrentSide('left');
    setIsResting(false);
    setSecondsLeft(0);
    setTimerSeconds(timerDuration ?? 0);
    setTimerRunning(false);
    isInterSetRestRef.current = false;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
  }, [stretch.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rest timer completion
  useEffect(() => {
    if (!isResting || secondsLeft !== 0) return;
    setIsResting(false);
    if (isInterSetRestRef.current) {
      isInterSetRestRef.current = false;
      setCurrentSet(s => s + 1);
      setTimerSeconds(timerDuration ?? 0);
      setTimerRunning(false);
    } else {
      onNext();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResting, secondsLeft]);

  // Stretch timer auto-stop
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
    setTimerSeconds(timerDuration ?? 0);
  };

  const startRestCountdown = (secs: number) => {
    setIsResting(true);
    setSecondsLeft(secs);
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) { clearInterval(intervalRef.current!); intervalRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleDone = () => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    setTimerRunning(false);

    // Per-side: do the other side immediately, no rest, same set number —
    // only once both sides are done does this set count toward advancing.
    if (assignment.isPerSide && currentSide === 'left') {
      setCurrentSide('right');
      setTimerSeconds(timerDuration ?? 0);
      return;
    }
    if (assignment.isPerSide) {
      setCurrentSide('left'); // reset for the next set's round
    }

    if (currentSet < sets) {
      // More sets remaining — rest, then increment set
      isInterSetRestRef.current = true;
      if (restSeconds > 0) {
        startRestCountdown(restSeconds);
      } else {
        setCurrentSet(s => s + 1);
        setTimerSeconds(timerDuration ?? 0);
      }
    } else {
      // Last set — advance to next stretch
      isInterSetRestRef.current = false;
      if (isLast || restSeconds <= 0) { onNext(); return; }
      startRestCountdown(restSeconds);
    }
  };

  const handleSkipRest = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsResting(false);
    if (isInterSetRestRef.current) {
      isInterSetRestRef.current = false;
      setCurrentSet(s => s + 1);
      setTimerSeconds(timerDuration ?? 0);
      setTimerRunning(false);
    } else {
      onNext();
    }
  };

  const repsDisplay = formatRepRange(repRange[0], repRange[1], isTimed);
  const phaseLabel = phase === 'pre' ? 'Pre-Workout' : 'Post-Workout';

  return (
    <div className="flex flex-col min-h-dvh mx-auto px-4 py-6 gap-6"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}>

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
            {isInterSetRestRef.current ? `REST · SET ${currentSet + 1} OF ${sets}` : 'REST'}
          </p>
          <span className="font-mono" data-numeric style={{ fontSize: 'clamp(3rem, 15vw, 6rem)', color: secondsLeft <= 3 ? 'var(--color-accent)' : 'var(--color-text)', lineHeight: 1, transition: 'color 300ms' }}>
            {formatTime(secondsLeft)}
          </span>

          {!isInterSetRestRef.current && nextStretch && nextAssignment && (
            <div className="w-full text-center">
              <p className="font-body mb-1" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>Up next</p>
              <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>{nextStretch.name}</p>
              <p className="font-mono mt-1" data-numeric style={{ fontSize: 'var(--text-h3)', color: 'var(--color-accent)' }}>
                {formatRepRange(nextAssignment.repRange[0], nextAssignment.repRange[1], nextAssignment.isTimed)}
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

            {/* Title + set counter */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <h2 className="font-display leading-tight" style={{ fontSize: 'clamp(1.75rem, 7vw, 2.5rem)', color: 'var(--color-text)', letterSpacing: '0.02em' }}>
                {stretch.name.toUpperCase()}
              </h2>
              {sets > 1 && (
                <span className="font-mono flex-shrink-0" data-numeric style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text-muted)' }}>
                  {currentSet}<span style={{ color: 'var(--color-text-faint)' }}>/{sets}</span>
                </span>
              )}
            </div>

            {assignment.isPerSide && (
              <p className="font-display uppercase tracking-widest mb-3"
                style={{ fontSize: 'var(--text-h3)', color: 'var(--color-accent)', letterSpacing: '0.08em' }}>
                {currentSide} side
              </p>
            )}

            <p className="font-mono mb-4" data-numeric style={{ fontSize: 'var(--text-h2)', color: 'var(--color-accent)' }}>
              {repsDisplay}
              {!isBodyweight && startingWeightKg > 0 && (
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-body)' }}>
                  {' · '}{startingWeightKg}kg
                </span>
              )}
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

            {/* Count-down timer for timed exercises */}
            {timerDuration !== null && (
              <div className="flex items-center gap-4 px-4 py-4 mt-2"
                style={{ background: 'var(--color-surface)', border: 'var(--border-thin)', borderRadius: 'var(--radius-md)' }}>
                <span className="font-mono flex-1" data-numeric style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', color: timerRunning && timerSeconds <= 5 ? 'var(--color-accent)' : 'var(--color-text)', lineHeight: 1, transition: 'color 300ms' }}>
                  {formatTime(timerSeconds)}
                </span>
                {timerSeconds === 0 ? (
                  <button type="button" onClick={resetStretchTimer} className="font-body px-4 py-2"
                    style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', border: 'var(--border-thin)', borderRadius: 'var(--radius-sm)', background: 'transparent' }}>
                    Reset
                  </button>
                ) : !timerRunning ? (
                  <button type="button" onClick={startStretchTimer} className="font-body px-4 py-2"
                    style={{ fontSize: 'var(--text-meta)', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)' }}>
                    Start
                  </button>
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
            {assignment.isPerSide && currentSide === 'left'
              ? 'Done · Left'
              : currentSet < sets ? `Done · Set ${currentSet} of ${sets}` : 'Done'}
          </button>

          {/* Defer — machine/space needed for this stretch is occupied */}
          {onDefer && (
            <button type="button" onClick={onDefer} className="w-full py-3 font-body"
              style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)', border: 'var(--border-thin)', borderRadius: 'var(--radius-md)', background: 'transparent' }}>
              Machine in use — skip for now
            </button>
          )}

          {/* Outright skip — won't come back to this one this session */}
          {onSkipEntirely && (
            <button type="button" onClick={onSkipEntirely} className="w-full py-2 font-body"
              style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-faint)', border: 'none', background: 'transparent', textDecoration: 'underline' }}>
              Can't do this stretch — skip it entirely
            </button>
          )}
        </>
      )}
    </div>
  );
}
