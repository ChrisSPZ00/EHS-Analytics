'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

/**
 * "One-click PDF" via the browser's own print-to-PDF.
 *
 * Deliberately not a server-side PDF library: the charts are client-rendered SVG, so
 * printing the real page gives a report that always matches what the user is looking at,
 * with selectable text and no separate rendering path to drift out of sync. It also
 * avoids shipping a headless browser to produce a document the client can already make.
 */
export function PrintButton({ auto }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    // Let charts finish their entry animation before the print snapshot.
    const timer = setTimeout(() => window.print(), 900);
    return () => clearTimeout(timer);
  }, [auto]);

  return (
    <Button size="sm" onClick={() => window.print()} className="print:hidden">
      Print / Save as PDF
    </Button>
  );
}
