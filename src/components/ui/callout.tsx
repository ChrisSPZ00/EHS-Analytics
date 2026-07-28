import * as React from 'react';

import { cn } from '@/lib/utils';

const tones = {
  info: 'border-border bg-muted text-foreground',
  danger: 'border-danger-border bg-danger-bg text-danger',
  warning: 'border-warning-border bg-warning-bg text-warning',
  success: 'border-success-border bg-success-bg text-success',
} as const;

export function Callout({
  tone = 'info',
  title,
  children,
  className,
  action,
}: {
  tone?: keyof typeof tones;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-md border px-3 py-2 text-sm', tones[tone], className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className={cn(title && 'mt-0.5')}>{children}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

/** Tells a first-time user what to do next, rather than just saying "no data". */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {children ? (
        <div className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{children}</div>
      ) : null}
      {action ? <div className="mt-4 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}
