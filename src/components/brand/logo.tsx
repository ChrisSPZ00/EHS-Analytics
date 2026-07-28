import { cn } from '@/lib/utils';

/**
 * Every surface that shows the brand — nav, sign-in, printed report — renders
 * through this file, so artwork changes happen in one place.
 *
 * Supplied artwork is picked up from `public/brand/` at build time (see
 * `next.config.ts` and `docs/brand-assets.md`). Two slots:
 *
 *   logo.*            the primary lockup, for light surfaces
 *   logo-reversed.*   the knockout version, for dark surfaces
 *
 * The rule is that a file is only ever shown on the surface it was made for. A
 * lockup with an opaque white background renders as a white box on the navy nav
 * or on the dark-mode page, and there is no CSS that removes a baked-in
 * background — so with the reversed slot empty, every dark surface falls back to
 * the built-in mark plus the typographic wordmark instead of showing the light
 * artwork somewhere it does not belong. That fallback is deliberately generic
 * geometry from the brand palette: a placeholder, not an invented mark.
 *
 * Dark surfaces are of two kinds and both are covered: the navy nav (always dark,
 * selected by `tone="onPrimary"`) and the page in dark mode (selected by the
 * `dark:` variant). Print forces a white page regardless of theme, so the print
 * variants pin it back to the light artwork.
 */

const LOGO = process.env.NEXT_PUBLIC_BRAND_LOGO || '';
const LOGO_REVERSED = process.env.NEXT_PUBLIC_BRAND_LOGO_REVERSED || '';

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

/**
 * Supplied artwork. Rendered with a plain <img> rather than next/image: the file
 * is dropped in by hand, so its intrinsic dimensions are not known at build time,
 * and an SVG lockup gains nothing from the optimiser. `h-8 w-auto` lets a wide
 * horizontal lockup keep its own aspect ratio instead of being forced square.
 */
function LogoAsset({ src, className }: { src: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="SafePulse Analytics"
      className={cn('h-8 w-auto max-w-[13rem] shrink-0 object-contain', className)}
    />
  );
}

/** Built-in stand-in: the placeholder mark and the typographic wordmark. */
function LogoFallback({
  className,
  withWordmark,
  tone,
}: {
  className?: string;
  withWordmark: boolean;
  tone: 'default' | 'onPrimary';
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      {withWordmark ? (
        <span
          className={cn(
            'text-base font-semibold leading-none tracking-tight',
            // --brand-ink steps up in dark mode; --brand-primary would sit at
            // about 2:1 on the dark page.
            tone === 'onPrimary' ? 'text-on-primary' : 'text-brand-ink',
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

export function Logo({
  className,
  withWordmark = true,
  tone = 'default',
}: {
  className?: string;
  withWordmark?: boolean;
  /** `onPrimary` for the navy nav bar, which is dark in both themes. */
  tone?: 'default' | 'onPrimary';
}) {
  // The nav is navy in both themes, so it only ever wants reversed artwork.
  if (tone === 'onPrimary') {
    return LOGO_REVERSED ? (
      <LogoAsset src={LOGO_REVERSED} className={className} />
    ) : (
      <LogoFallback className={className} withWordmark={withWordmark} tone={tone} />
    );
  }

  // With no artwork at all there is nothing to switch between — the fallback is
  // already theme-reactive, so don't emit it twice.
  if (!LOGO && !LOGO_REVERSED) {
    return <LogoFallback className={className} withWordmark={withWordmark} tone="default" />;
  }

  // A page surface: light artwork in light mode and in print, reversed artwork in
  // dark mode. Whichever slot is empty falls back rather than borrowing the other.
  const light = LOGO ? (
    <LogoAsset src={LOGO} className={cn('dark:hidden print:block', className)} />
  ) : (
    <LogoFallback
      className={cn('dark:hidden print:inline-flex', className)}
      withWordmark={withWordmark}
      tone="default"
    />
  );

  const dark = LOGO_REVERSED ? (
    <LogoAsset src={LOGO_REVERSED} className={cn('hidden dark:block print:hidden', className)} />
  ) : (
    <LogoFallback
      className={cn('hidden dark:inline-flex print:hidden', className)}
      withWordmark={withWordmark}
      tone="default"
    />
  );

  return (
    <>
      {light}
      {dark}
    </>
  );
}
