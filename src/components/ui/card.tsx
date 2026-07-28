import * as React from 'react';

import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-card shadow-sm', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('space-y-1 border-b border-border p-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('text-base font-semibold', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex items-center gap-2 border-t border-border p-4', className)} {...props} />
  );
}
