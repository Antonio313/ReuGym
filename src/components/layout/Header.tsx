import type { ReactNode } from 'react';

type HeaderProps = {
  subtitle?: ReactNode;
};

export function Header({ subtitle }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 flex flex-col justify-center px-4"
      style={{
        height: 'var(--header-height)',
        background: 'var(--color-bg)',
        borderBottom: 'var(--border-thin)',
      }}
    >
      <span
        className="font-display tracking-[0.05em] uppercase"
        style={{ fontSize: 'var(--text-h2)', color: 'var(--color-text)' }}
      >
        REUGYM
      </span>
      {subtitle && (
        <span
          className="font-body"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          {subtitle}
        </span>
      )}
    </header>
  );
}
