import { ChartBar } from '@phosphor-icons/react';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';

export default function BodyStats() {
  return (
    <PageShell>
      <Header />
      <main className="px-4 pt-4">
        <h1
          className="font-display mb-4"
          style={{ fontSize: 'var(--text-h1)', color: 'var(--color-text)' }}
        >
          Body Stats
        </h1>
        <EmptyState
          icon={<ChartBar size={32} />}
          title="No stats logged"
          description="Log your weight and measurements here each week."
        />
      </main>
    </PageShell>
  );
}
