import { cn } from '@/lib/utils';

/**
 * Every surface that shows the brand — nav, sign-in, printed report — renders
 * through this file, so artwork changes happen in one place.
 *
 * The mark below is a vector re-trace of the supplied SafePulse artwork, which
 * the brand sheet records as a flattened raster and explicitly suggests
 * recreating as vector. Re-tracing buys three things a PNG cannot: it stays sharp
 * from the 28px nav to a printed report, it recolours for dark surfaces instead
 * of needing a separately exported reversed file, and it is about 1 KB.
 *
 * The wordmark is live Montserrat text rather than paths baked into the SVG. An
 * <svg> loaded through <img> cannot reach the page's self-hosted fonts, so text
 * inside a standalone file would silently fall back to a system face. As HTML it
 * uses the real brand font, stays selectable and searchable, and reads correctly
 * to a screen reader.
 *
 * If the official raster is dropped into `public/brand/` it takes precedence —
 * see `next.config.ts` and `docs/brand-assets.md`. The slots remain because the
 * supplied file is the canonical artwork and this is a faithful approximation of
 * it, not a substitute for it.
 */

const LOGO = process.env.NEXT_PUBLIC_BRAND_LOGO || '';
const LOGO_REVERSED = process.env.NEXT_PUBLIC_BRAND_LOGO_REVERSED || '';

/*
 * The pulse trace, in a 160x72 box: opening dot, a rounded hump, the deep
 * trough, the tall systolic peak, then recovery into a flat run that exits on an
 * arrow slightly above where it started — the line ends higher than it began.
 */
const PULSE_PATH = `M 8.6 58.2
 L 25 58.2
 C 33 58.2 36 30.4 44.6 30.4
 C 52 30.4 54.6 52 57.7 63.2
 C 59.3 68.8 61 70.4 63.6 70.4
 C 66.4 70.4 67.8 67.4 69.4 59.4
 L 81.6 5.0
 C 82.6 0.9 83.4 0.7 84.4 0.7
 C 85.4 0.7 86.2 0.9 87.2 5.0
 L 98.4 55.2
 C 99.5 59.6 100.6 58.4 103.6 58.4
 C 107.4 58.4 109.6 51.8 113.4 51.0
 C 116 50.5 117.8 50.8 121 50.8
 L 140 50.8`;

const ARROW_PATH = 'M 139 42.4 L 158 50.8 L 139 59.2 Z';

/** Shared by every instance; identical definitions, so a repeat is harmless. */
const GRADIENT_ID = 'safepulse-mark-gradient';

export function LogoMark({
  className,
  reversed = false,
}: {
  className?: string;
  /** Solid white for dark surfaces — the gradient's navy end vanishes on navy. */
  reversed?: boolean;
}) {
  const paint = reversed ? 'currentColor' : `url(#${GRADIENT_ID})`;

  return (
    <svg
      viewBox="0 0 160 72"
      role="img"
      aria-label="SafePulse Analytics"
      className={cn('h-auto w-[3.9em] shrink-0', className)}
    >
      {reversed ? null : (
        <defs>
          <linearGradient
            id={GRADIENT_ID}
            x1="0"
            y1="0"
            x2="0"
            y2="72"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="var(--brand-green)" />
            <stop offset="0.55" stopColor="var(--brand-green-mid)" />
            <stop offset="1" stopColor="var(--brand-primary)" />
          </linearGradient>
        </defs>
      )}
      <g
        fill="none"
        stroke={paint}
        strokeWidth="4.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="4.4" cy="58.2" r="2.6" strokeWidth="2.6" />
        <path d={PULSE_PATH} />
      </g>
      <path d={ARROW_PATH} fill={paint} />
    </svg>
  );
}

/**
 * Supplied artwork, when present. Rendered with a plain <img> rather than
 * next/image: the file is dropped in by hand, so its intrinsic dimensions are not
 * known at build time. `w-auto` lets it keep its own aspect ratio.
 */
function LogoAsset({ src, className }: { src: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="SafePulse Analytics"
      className={cn('h-10 w-auto max-w-[13rem] shrink-0 object-contain', className)}
    />
  );
}

/**
 * The wordmark. `reversed` covers dark surfaces, where the navy lettering would
 * disappear and the logo green drops to 3.28:1.
 */
function Wordmark({ reversed, layout }: { reversed: boolean; layout: 'stacked' | 'inline' }) {
  const stacked = layout === 'stacked';
  return (
    <span className={cn('font-heading leading-none', stacked && 'text-center')}>
      <span
        className={cn(
          'block font-extrabold tracking-tight',
          stacked ? 'text-2xl' : 'text-sm',
          reversed ? 'text-on-primary' : 'text-brand-primary',
        )}
      >
        SAFE PULSE
      </span>
      <span
        className={cn(
          // The letterspacing adds a trailing gap, so pad the same amount on the
          // left to keep the word optically centred under the one above.
          'block font-medium',
          stacked ? 'mt-1.5 text-[0.6875rem] tracking-[0.42em]' : 'mt-0.5 text-[0.5rem] tracking-[0.34em]',
          reversed ? 'text-brand-green-reversed' : 'text-brand-green',
        )}
        style={{ paddingLeft: stacked ? '0.42em' : '0.34em' }}
      >
        ANALYTICS
      </span>
    </span>
  );
}

export function Logo({
  className,
  withWordmark = true,
  tone = 'default',
  layout = 'inline',
}: {
  className?: string;
  withWordmark?: boolean;
  /** `onPrimary` for the navy nav bar, which is dark in both themes. */
  tone?: 'default' | 'onPrimary';
  /**
   * `stacked` is the supplied lockup — mark over wordmark — and is what the
   * sign-in page and the report header use. `inline` sets the mark beside the
   * wordmark so the whole thing fits a nav bar's height.
   */
  layout?: 'stacked' | 'inline';
}) {
  const built = (reversed: boolean) => (
    <span
      className={cn(
        'inline-flex',
        layout === 'stacked' ? 'flex-col items-center gap-4' : 'items-center gap-3',
      )}
    >
      {/* In the supplied lockup the mark is about 0.89x the width of the wordmark
          beneath it, so the stacked mark is sized to sit just inside it. */}
      <LogoMark reversed={reversed} className={layout === 'stacked' ? 'w-52' : 'w-14'} />
      {withWordmark ? <Wordmark reversed={reversed} layout={layout} /> : null}
    </span>
  );

  // The nav is navy in both themes, so it only ever wants reversed treatment.
  if (tone === 'onPrimary') {
    return LOGO_REVERSED ? (
      <LogoAsset src={LOGO_REVERSED} className={className} />
    ) : (
      <span className={cn('text-on-primary', className)}>{built(true)}</span>
    );
  }

  // A page surface: light in light mode and in print, reversed in dark mode.
  // Whichever artwork slot is empty falls back to the built-in mark rather than
  // borrowing the other — a light lockup on a dark card is a white box.
  const light = LOGO ? (
    <LogoAsset src={LOGO} className={cn('dark:hidden print:block', className)} />
  ) : (
    <span className={cn('dark:hidden print:inline-flex', className)}>{built(false)}</span>
  );

  const dark = LOGO_REVERSED ? (
    <LogoAsset src={LOGO_REVERSED} className={cn('hidden dark:block print:hidden', className)} />
  ) : (
    <span className={cn('hidden text-foreground dark:inline-flex print:hidden', className)}>
      {built(true)}
    </span>
  );

  return (
    <>
      {light}
      {dark}
    </>
  );
}
