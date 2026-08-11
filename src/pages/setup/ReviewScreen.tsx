import { CheckCircle, Trophy } from '@phosphor-icons/react';
import { templateMap as defaultTemplateMap } from '@/data/templates';
import type { ProposedAction, Location } from './setupApi';

type Props = {
  reply: string;
  actions: ProposedAction[];
  applying: boolean;
  applied: boolean;
  error: string | null;
  location: Location | null;
  onConfirm: () => void;
  onStartOver: () => void;
};

function dayLabel(templateId: string, isSplit: boolean): string {
  const isHome = templateId.endsWith('-l2');
  const baseId = isHome ? templateId.slice(0, -3) : templateId;
  const shortLabel = defaultTemplateMap.get(baseId)?.shortLabel ?? baseId.toUpperCase();
  if (!isSplit) return shortLabel;
  return `${shortLabel} — ${isHome ? 'Home' : 'Gym'}`;
}

export function ReviewScreen({ reply, actions, applying, applied, error, location, onConfirm, onStartOver }: Props) {
  const isSplit = location === 'gym';

  const groups = new Map<string, ProposedAction[]>();
  const order: string[] = [];
  for (const action of actions) {
    if (action.kind !== 'add_to_template' && action.kind !== 'add_stretch') continue;
    const tid = action.templateId as string;
    if (!groups.has(tid)) { groups.set(tid, []); order.push(tid); }
    groups.get(tid)!.push(action);
  }

  const totalExercises = [...groups.values()].reduce((sum, g) => sum + g.length, 0);

  return (
    <div className="flex flex-col gap-6 px-6 py-8 mx-auto min-h-dvh" style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}>
      <div>
        <h1 className="font-display mb-2" style={{ fontSize: 'clamp(2rem, 9vw, 3rem)', color: 'var(--color-text)', letterSpacing: '0.02em' }}>
          YOUR PROGRAM
        </h1>
        {reply && (
          <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            {reply}
          </p>
        )}
      </div>

      {totalExercises === 0 ? (
        <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-regression)' }}>
          Something went wrong generating a plan — no exercises came back. You can try again or skip and set up manually.
        </p>
      ) : (
        <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
          {totalExercises} exercises across {order.length} template{order.length === 1 ? '' : 's'}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {order.map((tid) => {
          const group = groups.get(tid)!;
          return (
            <div key={tid} style={{ background: 'var(--color-surface)', border: 'var(--border-thin)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <div className="px-4 py-3" style={{ borderBottom: 'var(--border-thin)', background: 'var(--color-surface-2)' }}>
                <span className="font-display" style={{ fontSize: 'var(--text-h3)', color: 'var(--color-text)', letterSpacing: '0.04em' }}>
                  {dayLabel(tid, isSplit)}
                </span>
              </div>
              <ul className="px-4 py-3 flex flex-col gap-1.5">
                {group.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                    <span style={{ color: 'var(--color-text-faint)', marginTop: '0.05em', flexShrink: 0 }}>·</span>
                    {action.label}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-regression)' }}>
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 mt-2">
        {applied ? (
          <span className="flex items-center justify-center gap-2 font-body font-medium py-4" style={{ fontSize: 'var(--text-body)', color: 'var(--color-success)' }}>
            <CheckCircle size={20} weight="fill" />
            Applied — taking you in…
          </span>
        ) : (
          <>
            <button
              onClick={onConfirm}
              disabled={applying || totalExercises === 0}
              className="w-full py-4 font-display uppercase tracking-wide flex items-center justify-center gap-2"
              style={{
                fontSize: 'var(--text-h2)',
                background: applying || totalExercises === 0 ? 'var(--color-surface-2)' : 'var(--color-accent)',
                color: applying || totalExercises === 0 ? 'var(--color-text-faint)' : '#fff',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                letterSpacing: '0.05em',
              }}
            >
              <Trophy size={20} weight={applying ? 'regular' : 'fill'} />
              {applying ? 'Setting up…' : "Let's go"}
            </button>
            <button
              onClick={onStartOver}
              disabled={applying}
              className="font-body"
              style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}
            >
              Start over
            </button>
          </>
        )}
      </div>
    </div>
  );
}
