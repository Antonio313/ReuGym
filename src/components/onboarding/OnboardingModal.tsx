import { useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  X, Barbell, DeviceMobile, ListPlus, Play, Sparkle, ChartLineUp, Export,
  ShareNetwork, VideoCamera, CheckCircle, ArrowRight,
} from '@phosphor-icons/react';
import { useAuth } from '@/context/AuthContext';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { isIOS, isRunningAsPWA } from '@/lib/pwa';

type Slide = {
  icon: ReactNode;
  title: string;
  render: () => ReactNode;
};

function Body({ children }: { children: ReactNode }) {
  return (
    <p
      className="font-body"
      style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', lineHeight: 1.6 }}
    >
      {children}
    </p>
  );
}

function Point({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p
        className="font-body font-medium uppercase tracking-widest mb-1"
        style={{ fontSize: 'var(--text-micro)', color: 'var(--color-accent)' }}
      >
        {title}
      </p>
      <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
        {children}
      </p>
    </div>
  );
}

function InstallSlideBody() {
  const { canInstall, promptInstall } = useInstallPrompt();

  if (isRunningAsPWA()) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle size={32} weight="fill" style={{ color: 'var(--color-success)' }} />
        <Body>You're already using the installed app — nothing else to do here.</Body>
      </div>
    );
  }

  if (isIOS()) {
    return (
      <div className="flex flex-col gap-4">
        <Body>
          Install ReuGym to your Home Screen — it launches full-screen, works offline, and won't lose your spot
          mid-workout if Safari reclaims the tab.
        </Body>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span
              className="font-mono flex items-center justify-center flex-shrink-0"
              data-numeric
              style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', background: 'var(--color-surface)', border: 'var(--border-thin)', fontSize: 'var(--text-meta)', color: 'var(--color-text)' }}
            >1</span>
            <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text)' }}>
              Tap the <ShareNetwork size={14} weight="bold" style={{ display: 'inline', verticalAlign: '-2px' }} /> Share icon in Safari's toolbar
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="font-mono flex items-center justify-center flex-shrink-0"
              data-numeric
              style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', background: 'var(--color-surface)', border: 'var(--border-thin)', fontSize: 'var(--text-meta)', color: 'var(--color-text)' }}
            >2</span>
            <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text)' }}>
              Scroll down and tap <span style={{ color: 'var(--color-text-faint)' }}>"Add to Home Screen"</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="font-mono flex items-center justify-center flex-shrink-0"
              data-numeric
              style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', background: 'var(--color-surface)', border: 'var(--border-thin)', fontSize: 'var(--text-meta)', color: 'var(--color-text)' }}
            >3</span>
            <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text)' }}>
              Tap <span style={{ color: 'var(--color-text-faint)' }}>"Add"</span> — launch it from your Home Screen from now on
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Body>
        Install ReuGym as an app — it launches full-screen, works offline, and won't lose your spot mid-workout.
      </Body>
      {canInstall ? (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="flex items-center justify-center gap-2 py-3 font-display uppercase tracking-wide"
          style={{ fontSize: 'var(--text-body)', background: 'var(--color-accent)', color: '#fff', borderRadius: 'var(--radius-md)', border: 'none' }}
        >
          <DeviceMobile size={18} weight="bold" />
          Install App
        </button>
      ) : (
        <Body>
          Look for an install icon in your browser's address bar, or open the browser menu and choose
          "Install ReuGym" / "Add to Home Screen."
        </Body>
      )}
    </div>
  );
}

const slides: Slide[] = [
  {
    icon: <Barbell size={36} weight="fill" />,
    title: 'REUGYM',
    render: () => (
      <Body>
        A personal strength-training tracker — quick set logging, real progress tracking, offline-first,
        no subscriptions, no cloud lock-in. Let's get you set up.
      </Body>
    ),
  },
  {
    icon: <DeviceMobile size={36} weight="fill" />,
    title: 'Install it as an app',
    render: () => <InstallSlideBody />,
  },
  {
    icon: <ListPlus size={36} weight="fill" />,
    title: 'Build your first day',
    render: () => (
      <div className="flex flex-col gap-4">
        <Body>Every workout day starts empty — you build it yourself, once, and it's ready every time after.</Body>
        <Point title="Add exercises">
          From the Home screen, tap the pencil on a day card. Pick exercises from the built-in library or
          create your own, then set sets/reps/rest/starting weight for each.
        </Point>
        <Point title="Supersets & per-side">
          Pair two exercises with no rest between them, or mark one "Per side" (e.g. cable woodchoppers) —
          it'll alternate left/right automatically and track each side separately.
        </Point>
      </div>
    ),
  },
  {
    icon: <Play size={36} weight="fill" />,
    title: 'Logging a workout',
    render: () => (
      <div className="flex flex-col gap-4">
        <Body>Tap "Start" on a day and log each set as you go.</Body>
        <Point title="Warmup sets">
          Toggle "Warmup set" for lighter sets before your working weight — they get a shorter rest and don't
          count toward your set number.
        </Point>
        <Point title="Can't do an exercise?">
          "Skip for now" defers it to the end of the workout (machine's busy). "Skip entirely" drops it for
          the session — both get noted so you can see what happened afterward.
        </Point>
      </div>
    ),
  },
  {
    icon: <Sparkle size={36} weight="fill" />,
    title: 'Smart features',
    render: () => (
      <div className="flex flex-col gap-4">
        <Point title="Weight suggestions">
          Defaults follow your actual logged history and progress — not just what you originally configured —
          so the suggested weight climbs as you do.
        </Point>
        <Point title="Form reference">
          <VideoCamera size={13} weight="bold" style={{ display: 'inline', verticalAlign: '-2px' }} /> Exercises
          with a linked video show an inline reference — no leaving the app mid-set.
        </Point>
        <Point title="kg / lbs">
          Switch units any time in Settings — it applies to every weight shown across the app.
        </Point>
      </div>
    ),
  },
  {
    icon: <ChartLineUp size={36} weight="fill" />,
    title: 'Track your progress',
    render: () => (
      <div className="flex flex-col gap-4">
        <Point title="Body Stats">
          Log weight, waist, chest, and progress photos — with a trend chart over time.
        </Point>
        <Point title="Exercise history">
          Every exercise has its own page with a PR tracker and a progress chart across every session.
        </Point>
        <Point title="Backup your data">
          <Export size={13} weight="bold" style={{ display: 'inline', verticalAlign: '-2px' }} /> Export
          everything to a JSON file from the History page any time, and import it back on any device.
        </Point>
      </div>
    ),
  },
];

export function OnboardingModal() {
  const { showOnboarding, closeOnboarding } = useAuth();
  const [step, setStep] = useState(0);
  const reduceMotion = useReducedMotion();

  if (!showOnboarding) return null;

  const isLast = step === slides.length - 1;
  const slide = slides[step];

  const handleClose = () => {
    setStep(0);
    closeOnboarding();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col mx-auto"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}
    >
      {/* Header: dots + skip */}
      <div className="flex items-center justify-between px-4 flex-shrink-0" style={{ height: 'var(--header-height)' }}>
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === step ? '1.25rem' : '0.375rem',
                height: '0.375rem',
                borderRadius: '999px',
                background: i === step ? 'var(--color-accent)' : 'var(--color-border)',
                transition: 'width 200ms, background 200ms',
              }}
            />
          ))}
        </div>
        <button onClick={handleClose} aria-label="Skip" style={{ color: 'var(--color-text-faint)' }}>
          <X size={22} />
        </button>
      </div>

      {/* Content — key change unmounts the old slide immediately and plays
          the new one's entry transition; no exit animation to orchestrate,
          which sidesteps AnimatePresence's exit-then-mount sequencing. */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <motion.div
          key={step}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
          className="flex flex-col gap-5"
        >
          <div style={{ color: 'var(--color-accent)' }}>{slide.icon}</div>
          <h1
            className="font-display leading-none"
            style={{ fontSize: 'clamp(1.75rem, 8vw, 2.5rem)', color: 'var(--color-text)', letterSpacing: '0.02em' }}
          >
            {slide.title}
          </h1>
          {slide.render()}
        </motion.div>
      </div>

      {/* Footer nav */}
      <div className="flex items-center gap-3 px-6 pb-8 pt-3 flex-shrink-0" style={{ borderTop: 'var(--border-thin)' }}>
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="px-5 py-4 font-body"
            style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', border: 'var(--border-thin)', borderRadius: 'var(--radius-md)', background: 'transparent' }}
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={() => (isLast ? handleClose() : setStep((s) => s + 1))}
          className="flex-1 flex items-center justify-center gap-2 py-4 font-display uppercase tracking-wide"
          style={{ fontSize: 'var(--text-h3)', background: 'var(--color-accent)', color: '#fff', borderRadius: 'var(--radius-md)', border: 'none', letterSpacing: '0.05em' }}
        >
          {isLast ? 'Get Started' : 'Next'}
          {!isLast && <ArrowRight size={18} weight="bold" />}
        </button>
      </div>
    </div>
  );
}
