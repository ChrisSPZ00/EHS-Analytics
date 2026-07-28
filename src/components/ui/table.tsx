import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Tables scroll horizontally inside their own container rather than pushing the page
 * wide. Phase 5 adds the below-md card layout; the wrapper is the seam for that.
 */
export function TableWrap({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('w-full overflow-x-auto rounded-lg border border-border', className)}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return <table className={cn('w-full caption-bottom text-sm', className)} {...props} />;
}

export function THead({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('bg-muted/60 [&_tr]:border-b', className)} {...props} />;
}

export function TBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TR({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr className={cn('border-b border-border transition-colors', className)} {...props} />;
}

export function TH({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'whitespace-nowrap px-3 py-2 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('px-3 py-2 align-middle', className)} {...props} />;
}
