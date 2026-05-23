import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignOut } from '@phosphor-icons/react';
import { useAuth } from '@/context/AuthContext';

type HeaderProps = {
  subtitle?: ReactNode;
};

export function Header({ subtitle }: HeaderProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = () => {
    signOut();
    navigate('/signin');
  };

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4"
      style={{
        height: 'var(--header-height)',
        background: 'var(--color-bg)',
        borderBottom: 'var(--border-thin)',
      }}
    >
      <div className="flex flex-col justify-center">
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
      </div>
      <button
        onClick={handleLogout}
        aria-label="Log out"
        style={{ color: 'var(--color-text-faint)', padding: '0.25rem' }}
      >
        <SignOut size={20} />
      </button>
    </header>
  );
}
