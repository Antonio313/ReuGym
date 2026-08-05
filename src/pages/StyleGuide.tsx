import { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { NumericKeypad } from '@/components/shared/NumericKeypad';
import { PRBadge } from '@/components/workout/PRBadge';
import { Trophy, Barbell } from '@phosphor-icons/react';

const motionTokens: Array<{ name: string; var: string; value: string }> = [
  { name: 'duration-fast',  var: '--duration-fast',  value: '120ms' },
  { name: 'duration-base',  var: '--duration-base',  value: '200ms' },
  { name: 'duration-slow',  var: '--duration-slow',  value: '350ms' },
  { name: 'ease-snap',      var: '--ease-snap',      value: 'cubic-bezier(0.32, 0.72, 0, 1)' },
  { name: 'ease-out',       var: '--ease-out',       value: 'cubic-bezier(0, 0, 0.2, 1)' },
  { name: 'ease-spring',    var: '--ease-spring',    value: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
];

const colors: Array<{ name: string; var: string; hex: string }> = [
  { name: 'bg',         var: '--color-bg',         hex: '#0A0A0A' },
  { name: 'surface',    var: '--color-surface',     hex: '#1A1A1A' },
  { name: 'surface-2',  var: '--color-surface-2',   hex: '#242424' },
  { name: 'border',     var: '--color-border',      hex: '#2A2A2A' },
  { name: 'text',       var: '--color-text',        hex: '#F5F5F0' },
  { name: 'text-muted', var: '--color-text-muted',  hex: '#DCDCD8' },
  { name: 'text-faint', var: '--color-text-faint',  hex: '#B8B8B4' },
  { name: 'accent',     var: '--color-accent',      hex: '#FF4D00' },
  { name: 'success',    var: '--color-success',     hex: '#4DFF91' },
  { name: 'regression', var: '--color-regression',  hex: '#FF4D4D' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2
        className="font-body font-medium uppercase tracking-widest"
        style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', borderBottom: 'var(--border-thin)', paddingBottom: '0.5rem' }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function StyleGuide() {
  const [keypadValue, setKeypadValue] = useState('80');
  const [prShown, setPrShown] = useState(false);
  const [springed, setSpringed] = useState(false);

  return (
    <div
      className="mx-auto flex flex-col gap-10 px-4 py-8"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)', minHeight: '100dvh' }}
    >
      <div>
        <span
          className="font-display tracking-[0.05em]"
          style={{ fontSize: 'var(--text-display)', color: 'var(--color-text)' }}
        >
          STYLE
        </span>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-meta)' }}>
          Design reference — /style route only
        </p>
      </div>

      {/* Colors */}
      <Section title="Colors">
        <div className="grid grid-cols-2 gap-2">
          {colors.map(({ name, var: v, hex }) => (
            <div
              key={name}
              className="flex items-center gap-2 rounded p-2"
              style={{ background: 'var(--color-surface)' }}
            >
              <div
                className="h-6 w-6 shrink-0 rounded-sm border"
                style={{ background: `var(${v})`, borderColor: 'var(--color-border)' }}
              />
              <div className="min-w-0">
                <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>
                  {name}
                </p>
                <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {hex}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Typography */}
      <Section title="Typography">
        <div className="flex flex-col gap-4">
          <div>
            <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
              Anton — Display
            </p>
            <p
              className="font-display"
              style={{ fontSize: 'var(--text-display)', color: 'var(--color-text)', lineHeight: 1 }}
            >
              PUSH
            </p>
          </div>
          <div>
            <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
              Anton — H1
            </p>
            <p className="font-display" style={{ fontSize: 'var(--text-h1)', color: 'var(--color-text)' }}>
              History
            </p>
          </div>
          <div>
            <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
              JetBrains Mono — Weight display
            </p>
            <p
              className="font-mono"
              data-numeric
              style={{ fontSize: 'var(--text-weight-display)', color: 'var(--color-text)', lineHeight: 1 }}
            >
              100
            </p>
          </div>
          <div>
            <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
              Inter Tight — Body / Meta / Micro
            </p>
            <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
              Body — The quick brown fox
            </p>
            <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
              Meta — 3 × 8–10 reps · Last: Mon Jun 3
            </p>
            <p className="font-body" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-faint)' }}>
              Micro — REST · PR · WARMUP
            </p>
          </div>
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </Section>

      {/* Input */}
      <Section title="Input">
        <Input placeholder="e.g. 80" type="number" />
        <Input placeholder="Notes..." />
      </Section>

      {/* Badges */}
      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <span
            className="font-body font-medium uppercase"
            style={{
              fontSize: 'var(--text-micro)',
              color: 'var(--color-pr)',
              border: '1px solid var(--color-pr)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
              letterSpacing: '0.06em',
            }}
          >
            PR
          </span>
          <span
            className="font-body font-medium uppercase"
            style={{
              fontSize: 'var(--text-micro)',
              color: 'var(--color-match)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
              letterSpacing: '0.06em',
            }}
          >
            Match
          </span>
          <span
            className="font-body font-medium uppercase"
            style={{
              fontSize: 'var(--text-micro)',
              color: 'var(--color-regression)',
              border: '1px solid var(--color-regression)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
              letterSpacing: '0.06em',
            }}
          >
            Regression
          </span>
          <span
            className="font-body font-medium uppercase"
            style={{
              fontSize: 'var(--text-micro)',
              color: 'var(--color-text-muted)',
              border: 'var(--border-thin)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
              letterSpacing: '0.06em',
            }}
          >
            Warmup
          </span>
          <Badge>shadcn badge</Badge>
          <Badge variant="secondary">secondary</Badge>
          <Badge variant="outline">outline</Badge>
          <Badge variant="destructive">destructive</Badge>
        </div>
      </Section>

      {/* Card */}
      <Section title="Card">
        <div
          className="flex flex-col gap-2 p-4"
          style={{
            background: 'var(--color-surface)',
            border: 'var(--border-medium)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <span
            className="font-display"
            style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', color: 'var(--color-text)' }}
          >
            PUSH
          </span>
          <span style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
            6 exercises
          </span>
          <span style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)' }}>
            Last: Mon, Jun 3
          </span>
          <button
            className="mt-2 self-start"
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
          </button>
        </div>
      </Section>

      {/* Empty State */}
      <Section title="Empty State">
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <EmptyState
            icon={<Trophy size={28} />}
            title="No PRs yet"
            description="Log your first set and we'll track your personal records."
          />
        </div>
      </Section>

      {/* Skeleton */}
      <Section title="Skeleton">
        <SkeletonCard height="4rem" />
        <SkeletonCard height="2rem" />
        <SkeletonCard height="6rem" />
      </Section>

      {/* Numeric Keypad */}
      <Section title="Numeric Keypad">
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <NumericKeypad
            value={keypadValue}
            onChange={setKeypadValue}
            decimal
            onDone={() => {}}
          />
        </div>
      </Section>

      {/* Motion */}
      <Section title="Motion">
        <div className="grid grid-cols-2 gap-2 mb-4">
          {motionTokens.map(({ name, value }) => (
            <div key={name} className="rounded p-2" style={{ background: 'var(--color-surface)' }}>
              <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>
                {name}
              </p>
              <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-6 p-4" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          {/* PR celebration — the one deliberately bold moment in the app */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => { setPrShown(false); requestAnimationFrame(() => setPrShown(true)); }}
              className="font-body px-3 py-1.5"
              style={{ fontSize: 'var(--text-meta)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)' }}
            >
              Trigger PR
            </button>
            <div style={{ height: '1.5rem' }}>
              <PRBadge show={prShown} />
            </div>
          </div>

          {/* ease-spring demo */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setSpringed((s) => !s)}
              className="font-body px-3 py-1.5"
              style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', border: 'var(--border-thin)', borderRadius: 'var(--radius-sm)' }}
            >
              ease-spring
            </button>
            <motion.div
              animate={{ scale: springed ? 1.3 : 1 }}
              transition={{ type: 'spring', stiffness: 350, damping: 14 }}
              style={{ width: '1.5rem', height: '1.5rem', borderRadius: '50%', background: 'var(--color-accent)' }}
            />
          </div>
        </div>
      </Section>

      {/* Icon samples */}
      <Section title="Phosphor Icons">
        <div className="flex gap-4" style={{ color: 'var(--color-text-muted)' }}>
          <Barbell size={24} />
          <Trophy size={24} />
        </div>
      </Section>
    </div>
  );
}
