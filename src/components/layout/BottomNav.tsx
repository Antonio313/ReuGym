import { NavLink } from 'react-router-dom';
import { House, ClockCounterClockwise, Barbell, ChartBar } from '@phosphor-icons/react';

const navItems = [
  { to: '/',          label: 'Home',      Icon: House },
  { to: '/history',   label: 'History',   Icon: ClockCounterClockwise },
  { to: '/exercises', label: 'Exercises', Icon: Barbell },
  { to: '/stats',     label: 'Stats',     Icon: ChartBar },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        height: 'var(--bottom-nav-height)',
        background: 'var(--color-bg)',
        borderTop: 'var(--border-thin)',
        maxWidth: 'var(--max-content-width)',
        margin: '0 auto',
      }}
    >
      {navItems.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className="flex flex-1 flex-col items-center justify-center gap-0.5"
          style={({ isActive }) => ({
            color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
            transition: 'color var(--duration-base) var(--ease-out)',
          })}
        >
          <Icon size={22} weight="regular" />
          <span style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.03em' }}>
            {label}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
