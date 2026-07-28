import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { NextConfig } from 'next';

/*
 * Brand artwork is a drop-in, not a code change.
 *
 * Put the supplied lockup at `public/brand/logo.<ext>` and, if there is a
 * reversed (white/knockout) version, at `public/brand/logo-reversed.<ext>`.
 * Next start-up picks up whichever exist and the app renders them; with neither
 * present it falls back to the built-in placeholder mark. See
 * `docs/brand-assets.md`.
 *
 * Resolved here rather than in the component because a client component cannot
 * touch the filesystem, and because `env` values are inlined at build time — no
 * runtime cost and no request-time stat call.
 */
const EXTENSIONS = ['svg', 'png', 'webp'] as const;

function findAsset(basename: string): string {
  for (const ext of EXTENSIONS) {
    const file = `${basename}.${ext}`;
    if (existsSync(join(process.cwd(), 'public', 'brand', file))) {
      return `/brand/${file}`;
    }
  }
  return '';
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BRAND_LOGO: findAsset('logo'),
    NEXT_PUBLIC_BRAND_LOGO_REVERSED: findAsset('logo-reversed'),
  },
};

export default nextConfig;
