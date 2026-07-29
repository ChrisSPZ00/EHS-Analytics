'use client';

import { useState, useTransition } from 'react';

import { deleteObligation } from '@/app/(app)/compliance/actions';
import { Button } from '@/components/ui/button';

/**
 * Deleting an obligation takes its calendar entries with it, completed ones included —
 * that is a cascade in the schema, not a choice made here. So the button asks first, and
 * says what goes.
 */
export function DeleteObligationButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Delete
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-danger-border bg-danger-bg px-2 py-1">
      <span className="text-xs text-danger">Delete this and every dated entry, including completed ones?</span>
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => deleteObligation(id))}
      >
        {pending ? 'Deleting…' : 'Delete'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
