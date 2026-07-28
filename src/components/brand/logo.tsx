import { cn } from '@/lib/utils';

/**
 * ============================================================================
 * PLACEHOLDER MARK — replace with the supplied logo SVG.
 * ============================================================================
 *
 * The brand SVG did not reach the working tree, so this is a temporary stand-in
 * built only from the brand palette. It is deliberately generic rather than an
 * invented logo: nothing here should be mistaken for the real mark.
 *
 * To drop the real one in, replace the <svg> in `LogoMark` below and nothing
 * else — every surface (nav, sign-in, printed report) renders through this file,
 * so the swap happens in one place. If the supplied artwork is a full lockup
 * including the wordmark, set `withWordmark={false}` at the call sites, or just
 * render the artwork here and delete the <span>.
 */

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="SafePulse"
      className={cn('h-7 w-7 shrink-0', className)}
    >
      <rect width="32" height="32" rx="7" fill="var(--brand-primary)" />
      {/* A pulse trace — placeholder geometry, not the brand mark. */}
      <path
        d="M5 17h5l2.5-6 4 12 3-8 2.5 2H27"
        fill="none"
        stroke="var(--brand-gold)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  withWordmark = true,
  tone = 'default',
}: {
  className?: string;
  withWordmark?: boolean;
  /** `onPrimary` for the navy nav bar, where the wordmark must be white. */
  tone?: 'default' | 'onPrimary';
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      {withWordmark ? (
        <span
          className={cn(
            'text-base font-semibold leading-none tracking-tight',
            tone === 'onPrimary' ? 'text-on-primary' : 'text-brand-primary',
          )}
        >
          SafePulse
          <span
            className={cn(
              'font-normal',
              tone === 'onPrimary' ? 'text-on-primary-muted' : 'text-muted-foreground',
            )}
          >
            {' '}
            Analytics
          </span>
        </span>
      ) : null}
    </span>
  );
}
