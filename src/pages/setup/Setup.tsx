import { useState } from 'react';
import { nanoid } from 'nanoid';
import { CaretLeft } from '@phosphor-icons/react';
import { useAuth } from '@/context/AuthContext';
import { useExercises, useStretches } from '@/hooks/useExercises';
import { useUnit } from '@/hooks/useUnit';
import { supabase } from '@/lib/supabase';
import { ReviewScreen } from './ReviewScreen';
import {
  EMPTY_FORM, SAFETY_FLAG_OPTIONS, generatePlan, applyPlan,
  type SetupForm, type Experience, type BodyComp, type Location, type ProposedAction,
} from './setupApi';

const TOTAL_STEPS = 8;

// ─── Shared field bits ──────────────────────────────────────────

const inputStyle = {
  background: 'var(--color-surface)',
  border: 'var(--border-thin)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-text)',
  fontSize: 'var(--text-body)',
  outline: 'none',
} as const;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body mb-1 uppercase tracking-widest" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
      {children}
    </p>
  );
}

function StepTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="font-display mb-2" style={{ fontSize: 'clamp(1.75rem, 8vw, 2.5rem)', color: 'var(--color-text)', letterSpacing: '0.02em' }}>
      {children}
    </h1>
  );
}

function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left py-4 px-4 font-body"
      style={{
        fontSize: 'var(--text-body)',
        background: active ? 'var(--color-accent-dim)' : 'var(--color-surface)',
        border: active ? '1px solid var(--color-accent)' : 'var(--border-thin)',
        borderRadius: 'var(--radius-md)',
        color: active ? 'var(--color-accent)' : 'var(--color-text)',
      }}
    >
      {children}
    </button>
  );
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value: number | null; onChange: (v: number | null) => void; placeholder: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        placeholder={placeholder}
        className="w-full px-4 py-3 font-body"
        style={inputStyle}
      />
    </div>
  );
}

// ─── Wizard ─────────────────────────────────────────────────────

type Phase = 'intake' | 'generating' | 'review' | 'error';

export default function Setup() {
  const { user, completeSetup } = useAuth();
  const exercises = useExercises();
  const stretches = useStretches();
  const { unit, toDisplay, toKg } = useUnit();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SetupForm>(EMPTY_FORM);
  const [phase, setPhase] = useState<Phase>('intake');
  const [reply, setReply] = useState('');
  const [actions, setActions] = useState<ProposedAction[]>([]);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<SetupForm>) => setForm((f) => ({ ...f, ...p }));

  const canAdvance = (() => {
    switch (step) {
      case 0: return form.goals.trim().length > 0;
      case 2: return form.experience != null;
      case 3: return form.bodyComp != null;
      case 6: return form.location != null;
      default: return true;
    }
  })();

  const next = () => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const skip = async () => {
    try { await completeSetup(); } catch { /* AuthContext already surfaces this via needsSetup staying true */ }
  };

  const generate = async () => {
    if (!user) return;
    setPhase('generating');
    setError(null);
    try {
      const result = await generatePlan(user.id, form, exercises, stretches);
      setReply(result.reply);
      setActions(result.proposedActions);
      setPhase('review');

      if (form.weightKg != null) {
        try {
          await supabase.from('body_stats').insert({
            id: nanoid(), user_id: user.id, date: Date.now(), weight_kg: form.weightKg,
          });
        } catch { /* nice-to-have only — never block setup on this */ }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong generating your plan.');
      setPhase('error');
    }
  };

  const confirm = async () => {
    if (!user) return;
    setApplying(true);
    setError(null);
    try {
      await applyPlan(user.id, actions);
      setApplied(true);
      await completeSetup();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply the plan. You can try again.');
    } finally {
      setApplying(false);
    }
  };

  const startOver = () => {
    setPhase('intake');
    setStep(0);
    setActions([]);
    setReply('');
    setError(null);
  };

  // ── Generating / error states ───────────────────────────────

  if (phase === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-dvh px-6" style={{ background: 'var(--color-bg)' }}>
        <span className="font-display tracking-widest" style={{ fontSize: 'var(--text-h1)', color: 'var(--color-text)' }}>
          REUGYM
        </span>
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
        />
        <p className="font-body text-center" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
          Building your program — gym and home versions, based on your goals…
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-dvh px-6 text-center" style={{ background: 'var(--color-bg)' }}>
        <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-regression)' }}>
          {error}
        </p>
        <button
          onClick={() => void generate()}
          className="py-3 px-6 font-display uppercase tracking-wide"
          style={{ background: 'var(--color-accent)', color: '#fff', borderRadius: 'var(--radius-md)', border: 'none', fontSize: 'var(--text-body)' }}
        >
          Try again
        </button>
        <button onClick={() => void skip()} className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
          Skip and set up manually
        </button>
      </div>
    );
  }

  if (phase === 'review') {
    return (
      <ReviewScreen
        reply={reply}
        actions={actions}
        applying={applying}
        applied={applied}
        error={error}
        location={form.location}
        onConfirm={() => void confirm()}
        onStartOver={startOver}
      />
    );
  }

  // ── Intake steps ─────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-dvh mx-auto" style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}>
      <header className="flex items-center justify-between px-4" style={{ height: 'var(--header-height)' }}>
        {step > 0 ? (
          <button onClick={back} aria-label="Back" style={{ color: 'var(--color-text-muted)' }}>
            <CaretLeft size={22} />
          </button>
        ) : <span />}
        <span className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-faint)' }}>
          {step + 1} / {TOTAL_STEPS}
        </span>
        <button onClick={() => void skip()} className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
          Skip
        </button>
      </header>

      <main className="flex-1 flex flex-col gap-6 px-6 py-4">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <StepTitle>What are your goals?</StepTitle>
            <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
              Tell us what you're working toward — as much or as little detail as you want.
            </p>
            <textarea
              value={form.goals}
              onChange={(e) => patch({ goals: e.target.value })}
              placeholder="e.g. lose fat, build visible arms, improve my vertical jump"
              rows={4}
              className="w-full px-4 py-3 font-body"
              style={inputStyle}
              autoFocus
            />
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <StepTitle>A few stats</StepTitle>
            <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
              All optional — helps tailor volume and intensity.
            </p>
            <NumberField
              label={`Weight (${unit})`}
              value={form.weightKg != null ? toDisplay(form.weightKg) : null}
              onChange={(v) => patch({ weightKg: v == null ? null : toKg(v) })}
              placeholder={unit === 'lbs' ? 'e.g. 200' : 'e.g. 90'}
            />
            <div>
              <Label>Height</Label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.heightFeet ?? ''}
                    onChange={(e) => patch({ heightFeet: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="ft"
                    className="w-full px-4 py-3 font-body"
                    style={inputStyle}
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.heightInches ?? ''}
                    onChange={(e) => patch({ heightInches: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="in"
                    className="w-full px-4 py-3 font-body"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
            <NumberField label="Age" value={form.age} onChange={(v) => patch({ age: v })} placeholder="e.g. 28" />
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <StepTitle>Training experience</StepTitle>
            {([
              ['new', 'Brand new to lifting'],
              ['under1', 'Under 1 year'],
              ['1to3', '1–3 years'],
              ['3plus', '3+ years'],
            ] as [Experience, string][]).map(([value, label]) => (
              <ChoiceButton key={value} active={form.experience === value} onClick={() => patch({ experience: value })}>
                {label}
              </ChoiceButton>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <StepTitle>Body composition</StepTitle>
            <p className="font-body mb-1" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
              No need for an exact number — pick what's closest.
            </p>
            {([
              ['lean', 'Lean / athletic already'],
              ['average', 'Average build'],
              ['some', 'Some extra weight to lose'],
              ['significant', 'A significant amount to lose'],
            ] as [BodyComp, string][]).map(([value, label]) => (
              <ChoiceButton key={value} active={form.bodyComp === value} onClick={() => patch({ bodyComp: value })}>
                {label}
              </ChoiceButton>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <StepTitle>Current lifts</StepTitle>
            <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
              Optional — if you already know some working weights, share them. Otherwise skip ahead.
            </p>
            <textarea
              value={form.currentLifts}
              onChange={(e) => patch({ currentLifts: e.target.value })}
              placeholder={unit === 'lbs' ? 'e.g. bench 135lbs×8, squat 175lbs×6' : 'e.g. bench 60kg×8, squat 80kg×6'}
              rows={3}
              className="w-full px-4 py-3 font-body"
              style={inputStyle}
            />
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-3">
            <StepTitle>Safety check</StepTitle>
            <p className="font-body mb-1" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
              Select anything that applies to you. This just helps keep your program sensible — it's not a medical screening.
            </p>
            {SAFETY_FLAG_OPTIONS.map((flag) => {
              const active = form.safetyFlags.includes(flag);
              return (
                <ChoiceButton
                  key={flag}
                  active={active}
                  onClick={() => patch({
                    safetyFlags: active ? form.safetyFlags.filter((f) => f !== flag) : [...form.safetyFlags, flag],
                  })}
                >
                  {flag}
                </ChoiceButton>
              );
            })}
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col gap-3">
            <StepTitle>Where will you train?</StepTitle>
            {([
              ['gym', 'Gym — with a home backup too'],
              ['home', 'Home, with some equipment'],
              ['bodyweight', 'Bodyweight only'],
            ] as [Location, string][]).map(([value, label]) => (
              <ChoiceButton key={value} active={form.location === value} onClick={() => patch({ location: value })}>
                {label}
              </ChoiceButton>
            ))}
          </div>
        )}

        {step === 7 && (
          <div className="flex flex-col gap-4">
            <StepTitle>Days per week</StepTitle>
            <div className="flex items-center justify-center gap-6 py-4">
              <button
                onClick={() => patch({ daysPerWeek: Math.max(2, form.daysPerWeek - 1) })}
                disabled={form.daysPerWeek <= 2}
                className="w-12 h-12 font-display"
                style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)', border: 'var(--border-thin)', borderRadius: 'var(--radius-md)' }}
              >
                −
              </button>
              <span className="font-mono" data-numeric style={{ fontSize: 'var(--text-weight-large)', color: 'var(--color-text)' }}>
                {form.daysPerWeek}
              </span>
              <button
                onClick={() => patch({ daysPerWeek: Math.min(6, form.daysPerWeek + 1) })}
                disabled={form.daysPerWeek >= 6}
                className="w-12 h-12 font-display"
                style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)', border: 'var(--border-thin)', borderRadius: 'var(--radius-md)' }}
              >
                +
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="px-6 pb-8 pt-2">
        <button
          onClick={() => (step === TOTAL_STEPS - 1 ? void generate() : next())}
          disabled={!canAdvance}
          className="w-full py-4 font-display uppercase tracking-wide"
          style={{
            fontSize: 'var(--text-h2)',
            background: canAdvance ? 'var(--color-accent)' : 'var(--color-surface-2)',
            color: canAdvance ? '#fff' : 'var(--color-text-faint)',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            letterSpacing: '0.05em',
          }}
        >
          {step === TOTAL_STEPS - 1 ? 'Build my program' : 'Next'}
        </button>
      </footer>
    </div>
  );
}
