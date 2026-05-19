import type { ReactNode } from 'react';

type PageShellProps = {
  children: ReactNode;
  withNav?: boolean;
};

export function PageShell({ children, withNav = true }: PageShellProps) {
  return (
    <div
      className="relative mx-auto min-h-dvh w-full"
      style={{
        maxWidth: 'var(--max-content-width)',
        paddingBottom: withNav ? 'var(--bottom-nav-height)' : 0,
        background: 'var(--color-bg)',
      }}
    >
      {children}
    </div>
  );
}
