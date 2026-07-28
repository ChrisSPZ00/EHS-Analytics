import * as React from 'react';

import { cn } from '@/lib/utils';

const controlClasses =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(controlClasses, className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(controlClasses, 'pr-8', className)} {...props} />
  ),
);
Select.displayName = 'Select';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(controlClasses, 'h-auto min-h-20 py-2', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      className={cn('block text-sm font-medium text-foreground', className)}
      {...props}
    />
  );
}

/** Label + control + optional hint/error, the standard vertical form row. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
