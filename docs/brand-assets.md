# Brand assets

## Logo

The mark ships as **vector, drawn in `src/components/brand/logo.tsx`** — a re-trace of
the supplied SafePulse artwork, which the brand sheet records as a flattened raster and
explicitly suggests recreating as vector.

Re-tracing buys three things the raster cannot:

- it stays sharp from the 28 px nav to a printed report;
- it recolours, so the dark-surface version is the same drawing with a different paint
  rather than a separately exported reversed file;
- it is about 1 KB against ~180 KB for the raster inlined.

The wordmark is live Montserrat text, not paths baked into the SVG. An `<svg>` loaded
through `<img>` cannot reach the page's self-hosted fonts, so text inside a standalone
file would silently fall back to a system face. As HTML it uses the real brand font,
stays selectable and searchable, and reads correctly to a screen reader.

### Two layouts

| Layout | Where | Shape |
| --- | --- | --- |
| `stacked` (the supplied lockup) | Sign-in page | Mark over wordmark |
| `inline` | App header, report header | Mark beside wordmark, so it fits a nav bar's height |

In the stacked layout the mark is sized at 0.89× the wordmark width, matching the
proportion in the supplied artwork.

### Colour

The mark carries a vertical gradient — `--brand-primary` navy at the baseline, through
`--brand-green-mid`, to `--brand-green` at the peak. On dark surfaces it becomes solid
`currentColor`, because the gradient's navy end disappears against navy.

`ANALYTICS` is `--brand-green` on light and `--brand-green-reversed` on dark. The light
pairing is 3.12:1, below AA — WCAG 1.4.3 exempts logotype lettering, and
`verify:contrast` prints it in an explicit EXEMPT table so the decision stays visible
rather than simply absent. **That exemption covers the logo only.** Accent wording
elsewhere uses `--brand-accent-text`, which is checked like everything else.

## Replacing the vector with the official raster

Drop files into `public/brand/` and they take precedence over the built-in vector — the
supplied file is the canonical artwork, and the re-trace is a faithful approximation of
it rather than a replacement for it.

| File | Used on | Needs |
| --- | --- | --- |
| `logo.svg` (or `.png` / `.webp`) | Light surfaces, and print | Transparent or white background |
| `logo-reversed.svg` (or `.png` / `.webp`) | Navy header, dark mode | **Transparent** background, light ink |

Detection happens at Next start-up (`next.config.ts` → `NEXT_PUBLIC_BRAND_LOGO*`), so
restart the dev server after adding a file. A file is only ever shown on a surface it was
made for: with `logo-reversed.*` absent, dark surfaces fall back to the built-in vector
rather than putting light artwork on a dark background. Print pins back to the light
artwork, since the report prints on white whatever the screen theme is.

## Typography

| Role | Face | Applied |
| --- | --- | --- |
| Headings, nav labels, wordmark | Montserrat | `h1`–`h6` globally, plus `.font-heading` |
| Body copy, form labels, tables | Source Sans 3 | The default face on `body` |

Both are self-hosted by `next/font` at build time — no client request to Google, no
layout shift, and the app still renders if Google Fonts is unreachable at runtime.
Tables get `font-variant-numeric: tabular-nums`, because a rate that changes width as it
updates is hard to scan down a column.

## Palette

Tokens live at the top of `globals.css` with the measured contrast of each colour beside
it. Two constraints worth knowing before reaching for a brand colour:

- **Teal `#14B8A6` is 2.49:1 on white.** The brand sheet lists it for links and CTAs, so
  `--brand-accent-text` carries the same hue darkened to 5.47:1 for wording, while
  `#14B8A6` itself stays for fills, rules and active-state bars.
- **The golds are 1.78–2.71:1 on white** and are fills and rules only.

`npm run verify:contrast` checks every pair the UI renders words in, both modes, and
fails the build on a regression.

## Open question: gold

The chrome still carries California Gold — the rule under the nav, the active-tab
underline, the dark-mode primary button. That came from the earlier seven-colour palette.
The brand sheet in `safepulsebrand.json` lists only two colours, primary navy and teal
accent, and **the logo contains no gold at all** — it runs navy to green.

Nothing is broken, and every gold pairing passes contrast, but a gold accent beside a
navy-and-green mark reads as a different brand. Aligning the chrome to the logo (teal or
green accents, gold retired or demoted to the print report) is a one-commit change and
needs a decision rather than a guess.
