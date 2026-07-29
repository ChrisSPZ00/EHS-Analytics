import { DUE_STATE_TONE, dueDescription, type DueState } from '@/lib/domain/compliance';
import { cn } from '@/lib/utils';

const TONE_CLASSES = {
  danger: 'bg-danger-bg text-danger border-danger-border',
  warning: 'bg-warning-bg text-warning border-warning-border',
  success: 'bg-success-bg text-success border-success-border',
  info: 'bg-muted text-muted-foreground border-border',
} as const;

const chip = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium';

/**
 * The due state, always as words.
 *
 * Same rule as the hierarchy-of-controls badges: colour reinforces, it never carries the
 * meaning on its own. Red and amber are the two that matter most here and are the exact
 * pair a red-green colour vision deficiency confuses, so "Overdue" and "Due soon" have to
 * be readable with the colour taken away — and on a printed report, they are.
 */
export function DueStateBadge({
  state,
  daysUntilDue,
  className,
}: {
  state: DueState | string | null;
  daysUntilDue?: number | null;
  className?: string;
}) {
  const known = (state ?? 'Upcoming') as DueState;
  const tone = DUE_STATE_TONE[known] ?? 'info';

  return (
    <span className={cn(chip, TONE_CLASSES[tone], className)}>
      <span>{known}</span>
      {daysUntilDue != null && known !== 'Complete' ? (
        <>
          <span aria-hidden className="opacity-40">
            ·
          </span>
          <span className="font-normal tabular-nums">{dueDescription(daysUntilDue)}</span>
        </>
      ) : null}
    </span>
  );
}

/**
 * Verified against the source document, or not.
 *
 * Both states render, and they are deliberately different shapes rather than the same
 * chip in two colours — a calendar transcribed from memory is a liability, and the
 * difference has to survive a photocopy.
 */
export function VerificationBadge({
  isVerified,
  className,
}: {
  isVerified: boolean | null;
  className?: string;
}) {
  if (isVerified) {
    return (
      <span className={cn(chip, 'border-border bg-transparent text-muted-foreground', className)}>
        Verified
      </span>
    );
  }
  return (
    <span className={cn(chip, TONE_CLASSES.warning, className)}>
      Unverified
      <span className="sr-only">— not yet checked against the permit or rule text</span>
    </span>
  );
}

/** The obligation's own workflow status, distinct from the derived due state. */
export function ObligationStatusBadge({
  status,
  className,
}: {
  status: string | null;
  className?: string;
}) {
  if (!status) return null;
  // 'N/A - Verify' means "we believe this does not apply, but nobody has confirmed it".
  // It is a question, not a clearance, so it wears the warning tone.
  const tone = status === 'N/A - Verify' ? 'warning' : 'info';
  return <span className={cn(chip, TONE_CLASSES[tone], className)}>{status}</span>;
}
