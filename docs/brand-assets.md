# Brand artwork

Drop files in here and the app picks them up. No code change.

| File | Used on | Needs |
| --- | --- | --- |
| `logo.svg` (or `.png` / `.webp`) | Sign-in page, printed PDF report — white surfaces | Transparent or white background |
| `logo-reversed.svg` (or `.png` / `.webp`) | The navy app header | **Transparent** background, light/white ink |

Detection happens at Next start-up (`next.config.ts` → `NEXT_PUBLIC_BRAND_LOGO*`), so
restart the dev server after adding a file. With a slot empty, the built-in placeholder
mark in `src/components/brand/logo.tsx` stands in — that fallback is generic geometry
from the brand palette, not the real mark.

Both slots render at `h-8 w-auto`, capped at `13rem` wide, so a wide horizontal lockup
keeps its own proportions. Nothing is cropped or forced square.

## About the supplied `Untitled design.svg`

That file is an SVG wrapper around a raster image, not vector artwork:

```
<rect width="375" height="375" style="fill:#ffffff;..."/>   ← opaque white, twice
<image width="2251" height="1797" xlink:href="data:image/jpeg;base64,…"/>
```

Three consequences:

1. **It cannot go on the navy header.** JPEG has no alpha channel and the wrapper paints
   an opaque white rectangle underneath, so it renders as a white box. No CSS fixes this
   — a reversed export is the only answer.
2. **It will not stay crisp.** It is a photograph of a logo, so it resamples like one.
3. **It is heavy** — roughly 180 KB inlined, against ~2 KB for the equivalent vector.

Best fix, in order:

1. Export from the original Illustrator file as **SVG with no background**, plus a
   reversed/knockout version. Two small files, sharp at every size.
2. Failing that, a **transparent PNG** at ~512 px on the long edge, again in both
   variants.
3. As a stopgap, the existing file works on white surfaces only — save it as
   `public/brand/logo.svg` and leave `logo-reversed.*` absent. The header keeps the
   placeholder mark until a reversed version exists.
