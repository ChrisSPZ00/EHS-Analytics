import { EmptyState } from '@/components/ui/callout';

export default function CompliancePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Compliance Calendar</h1>
      <EmptyState title="Phase 4">
        <p>
          The obligation register, recurrence engine and calendar views land here. The schema
          behind them is already in place.
        </p>
      </EmptyState>
    </div>
  );
}
