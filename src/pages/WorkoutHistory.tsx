import { ClockCounterClockwise } from '@phosphor-icons/react';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';

export default function WorkoutHistory() {
  return (
    <PageShell>
      <Header />
      <main className="px-4 pt-4">
        <h1
          className="font-display mb-4"
          style={{ fontSize: 'var(--text-h1)', color: 'var(--color-text)' }}
        >
          History
        </h1>
        <EmptyState
          icon={<ClockCounterClockwise size={32} />}
          title="No sessions yet"
          description="Complete your first workout and it'll appear here."
        />
      </main>
    </PageShell>
  );
}
