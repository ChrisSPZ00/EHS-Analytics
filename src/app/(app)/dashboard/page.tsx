import { EmptyState } from '@/components/ui/callout';

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Incident Dashboard</h1>
      <EmptyState title="Phase 3">
        <p>
          KPI cards, trend charts and the hierarchy-of-controls maturity signal land here.
          Every metric will show its formula, its inputs and its citation.
        </p>
      </EmptyState>
    </div>
  );
}
