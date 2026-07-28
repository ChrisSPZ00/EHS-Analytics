import { ImportWizard } from '@/components/import/import-wizard';
import { loadImportContext } from './actions';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const context = await loadImportContext();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Import incidents</h1>
        <p className="text-sm text-muted-foreground">
          Bring across the spreadsheet you already keep. You will see a full validation report
          before anything is written, and you can hand that report to your client as-is.
        </p>
      </div>
      <ImportWizard context={context} />
    </div>
  );
}
