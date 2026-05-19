import type { ReactNode } from 'react';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && (
        <div style={{ color: 'var(--color-text-faint)', fontSize: '2rem' }}>{icon}</div>
      )}
      <p
        className="font-body font-medium"
        style={{ fontSize: 'var(--text-h3)', color: 'var(--color-text-muted)' }}
      >
        {title}
      </p>
      {description && (
        <p
          className="font-body"
          style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-faint)', maxWidth: '22ch' }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
