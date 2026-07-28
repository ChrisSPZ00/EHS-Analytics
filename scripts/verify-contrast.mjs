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

if (failures > 0) {
  console.error(
    `\n${failures} hierarchy-of-controls colour pair(s) fall below WCAG AA. ` +
      `These tokens are specified values -- fix the contrast rather than lowering the bar.`,
  );
  process.exit(1);
}

console.log(`All ${rows.length} colour pairs clear WCAG AA.`);
