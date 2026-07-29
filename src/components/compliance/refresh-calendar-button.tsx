'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { refreshComplianceCalendar } from '@/app/(app)/compliance/actions';
import { Button } from '@/components/ui/button';

/**
 * Extends the calendar to the end of every obligation's generation window.
 *
 * The window is measured from today, so a calendar generated a year ago has a year less
 * of future in it than it did. This is the manual crank for that, and it is safe to press
 * repeatedly: the generator cannot create a date that already exists, and it never
 * touches an entry anybody has completed or annotated.
 */
export function RefreshCalendarButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {result ? <span className="text-xs text-muted-foreground">{result}</span> : null}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            const response = await refreshComplianceCalendar();
            if (!response.ok) {
              setResult(response.message ?? 'Could not extend the calendar.');
              return;
            }
            setResult(
              response.created === 0
                ? 'Already up to date'
                : `${response.created} date${response.created === 1 ? '' : 's'} added`,
            );
            router.refresh();
          })
        }
      >
        {pending ? 'Extending…' : 'Extend calendar'}
      </Button>
    </div>
  );
}
