import { cn } from '@/lib/utils';

/**
 * Every surface that shows the brand — nav, sign-in, printed report — renders
 * through this file, so artwork changes happen in one place.
 *
 * Supplied artwork is picked up from `public/brand/` at build time (see
 * `next.config.ts` and `docs/brand-assets.md`). Two slots:
 *
 *   logo.*            the primary lockup, for white/light surfaces
 *   logo-reversed.*   the knockout version, for the navy nav bar
 *
 * When a slot is empty the built-in `LogoMark` below stands in. That fallback is
 * deliberately generic geometry from the brand palette — it is a placeholder, not
 * an invented mark, and nothing should be mistaken for the real logo.
 *
 * The two slots are separate on purpose. The supplied lockup has an opaque white
 * background, so dropping it onto the navy header would render a white box around
 * the mark. Artwork for a dark surface has to be artwork made for a dark surface;
 * there is no CSS that removes a baked-in background. Until a reversed version
 * exists the nav keeps the placeholder mark and the typographic wordmark, which
 * both sit at 10.36:1 on the navy.
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
 * and an SVG lockup gains nothing from the optimiser. `h-* w-auto` lets a wide
 * horizontal lockup keep its own aspect ratio instead of being forced square.
 */
function LogoAsset({ src, className }: { src: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="SafePulse Analytics"
      className={cn('w-auto max-w-[13rem] shrink-0 object-contain', className)}
    />
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
  const asset = tone === 'onPrimary' ? LOGO_REVERSED : LOGO;

  // A supplied lockup already contains the wordmark, so the typographic one is
  // dropped rather than doubled up alongside it.
  if (asset) {
    return <LogoAsset src={asset} className={cn('h-8', className)} />;
  }

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
