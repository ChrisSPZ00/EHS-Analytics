#!/usr/bin/env node
/**
 * Verifies the hierarchy-of-controls colour tokens against WCAG AA (4.5:1 for normal
 * text).
 *
 * It reads the values straight out of src/app/globals.css rather than keeping its own
 * copy, so this checks what actually ships. Substitute a colour and this fails.
 *
 * Run: npm run verify:contrast   (also runs as part of `npm run build`)
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AA_NORMAL_TEXT = 4.5;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_PATH = join(ROOT, 'src/app/globals.css');

const TOKEN_NAMES = {
  0: 'Unclassified',
  1: 'Elimination',
  2: 'Substitution',
  3: 'Engineering',
  4: 'Administrative',
  5: 'PPE',
};

function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  const int = parseInt(m[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/** WCAG 2.x relative luminance. */
function luminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(fg, bg) {
  const l1 = luminance(parseHex(fg));
  const l2 = luminance(parseHex(bg));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const css = await readFile(CSS_PATH, 'utf8');

/** Pull every --hoc-N-bg / --hoc-N-fg declaration out of the stylesheet. */
function extractTokens(source) {
  const found = {};
  const re = /--hoc-(\d)-(bg|fg)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const [, token, role, value] = m;
    (found[token] ??= {})[role] = value;
  }
  return found;
}

const tokens = extractTokens(css);
const expected = Object.keys(TOKEN_NAMES);
const missing = expected.filter((t) => !tokens[t]?.bg || !tokens[t]?.fg);

if (missing.length > 0) {
  console.error(
    `FAIL  missing --hoc-N-bg/--hoc-N-fg definitions for token(s): ${missing.join(', ')}`,
  );
  console.error(`      looked in ${CSS_PATH}`);
  process.exit(1);
}

let failures = 0;
const rows = [];

for (const token of expected) {
  const { bg, fg } = tokens[token];
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= AA_NORMAL_TEXT;
  if (!pass) failures += 1;
  rows.push({
    token: `--hoc-${token}`,
    level: TOKEN_NAMES[token],
    bg,
    fg,
    ratio: `${ratio.toFixed(2)}:1`,
    AA: pass ? 'PASS' : 'FAIL',
  });
}

console.log(`WCAG AA contrast check (normal text, >= ${AA_NORMAL_TEXT}:1)`);
console.table(rows);

/*
 * Brand pairs that carry TEXT.
 *
 * The brand golds and the teal sit at 1.78–2.71:1 on white, so they are fills and
 * rules only — never text on the page, and none of them appears here. What is checked
 * is every pairing the UI actually renders words in.
 */
const BRAND_TEXT_PAIRS = [
  { name: 'Body ink on page', fg: '#010133', bg: '#FFFFFF' },
  { name: 'Primary link/button text', fg: '#1E3A8A', bg: '#FFFFFF' },
  { name: 'Nav label on primary', fg: '#FFFFFF', bg: '#1E3A8A' },
  { name: 'Nav muted label on primary', fg: '#CCD6EE', bg: '#1E3A8A' },
  { name: 'White on primary button', fg: '#FFFFFF', bg: '#1E3A8A' },
  { name: 'Ink on California Gold fill', fg: '#010133', bg: '#FDB515' },
  { name: 'Ink on Heritage Gold fill', fg: '#010133', bg: '#C09748' },
  { name: 'Ink on Metallic Gold fill', fg: '#010133', bg: '#BC9B6A' },
  { name: 'Ink on Light Blue fill', fg: '#010133', bg: '#14B8A6' },
  // Dark mode.
  { name: 'Dark: body ink on page', fg: '#F2F4FB', bg: '#000019' },
  { name: 'Dark: body ink on card', fg: '#F2F4FB', bg: '#010133' },
  { name: 'Dark: muted ink on card', fg: '#B3BBD6', bg: '#010133' },
  { name: 'Dark: ink on gold button', fg: '#010133', bg: '#FDB515' },
  // Status callouts, both modes. These stay semantic rather than brand-coloured, so a
  // warning never reads as a gold accent.
  { name: 'Danger callout (light)', fg: '#b91c1c', bg: '#fef2f2' },
  { name: 'Warning callout (light)', fg: '#92400e', bg: '#fffbeb' },
  { name: 'Success callout (light)', fg: '#166534', bg: '#f0fdf4' },
  { name: 'Dark: danger callout', fg: '#fca5a5', bg: '#2b0f12' },
  { name: 'Dark: warning callout', fg: '#fcd34d', bg: '#2a2006' },
  { name: 'Dark: success callout', fg: '#86efac', bg: '#062b16' },
];

const brandRows = BRAND_TEXT_PAIRS.map((pair) => {
  const ratio = contrastRatio(pair.fg, pair.bg);
  const pass = ratio >= AA_NORMAL_TEXT;
  if (!pass) failures += 1;
  return {
    pair: pair.name,
    fg: pair.fg,
    bg: pair.bg,
    ratio: `${ratio.toFixed(2)}:1`,
    AA: pass ? 'PASS' : 'FAIL',
  };
});

console.log(`\nBrand text pairs (normal text, >= ${AA_NORMAL_TEXT}:1)`);
console.table(brandRows);

if (failures > 0) {
  console.error(
    `\n${failures} hierarchy-of-controls colour pair(s) fall below WCAG AA. ` +
      `These tokens are specified values -- fix the contrast rather than lowering the bar.`,
  );
  process.exit(1);
}

console.log(`All ${rows.length} hierarchy pairs and ${brandRows.length} brand text pairs clear WCAG AA.`);
