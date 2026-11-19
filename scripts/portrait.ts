// One-off: turns a photo into assets/portrait.txt. Run locally with
//   npm run portrait -- <path-to-photo>
// The photo stays out of this repo; only the ASCII text is committed, and
// generate.ts renders it to SVG in the brand colours.

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

// Densest to lightest. Dark pixels get dense glyphs, so on a dark card the
// hair, beard and hoodie light up; the neutral grey backdrop becomes spaces.
const RAMP = '@#W$9876543210?!abc;:+=-,. ';
const COLS = 84;
// Terminal cells are about twice as tall as they are wide.
const CELL_ASPECT = 0.5;
// The studio backdrop is a flat, colourless light grey (lightness about 0.83).
// Skin, hair and the hoodie are saturated or darker, and the blown-out
// highlights on the cheek are brighter, so both stay in.
const BACKDROP_MAX_SATURATION = 0.07;
const BACKDROP_LIGHTNESS = [0.7, 0.93];
// Head and shoulders of the 460x460 portfolio photo, as fractions of its size.
const CROP = { left: 0.12, top: 0, width: 0.76, height: 0.66 };

const input = process.argv[2];
if (!input) throw new Error('Usage: npm run portrait -- <path-to-photo>');

const meta = await sharp(input).metadata();
const region = {
  left: Math.round((meta.width ?? 0) * CROP.left),
  top: Math.round((meta.height ?? 0) * CROP.top),
  width: Math.round((meta.width ?? 0) * CROP.width),
  height: Math.round((meta.height ?? 0) * CROP.height),
};
const rows = Math.round(COLS * (region.height / region.width) * CELL_ASPECT);
const { data } = await sharp(input)
  .extract(region)
  .resize(COLS, rows, { fit: 'fill' })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const lightness: number[] = [];
const subject: boolean[] = [];
for (let i = 0; i < COLS * rows; i++) {
  const [r, g, b] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]].map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  lightness.push(l);
  subject.push(!(saturation < BACKDROP_MAX_SATURATION && l > BACKDROP_LIGHTNESS[0] && l < BACKDROP_LIGHTNESS[1]));
}

// Stretch contrast over the subject only, between its 2nd and 98th percentile.
const sorted = lightness.filter((_, i) => subject[i]).sort((a, b) => a - b);
const lo = sorted[Math.floor(sorted.length * 0.02)];
const hi = sorted[Math.floor(sorted.length * 0.98)];

const lines: string[] = [];
for (let y = 0; y < rows; y++) {
  let line = '';
  for (let x = 0; x < COLS; x++) {
    const i = y * COLS + x;
    if (!subject[i]) {
      line += ' ';
      continue;
    }
    const v = Math.min(1, Math.max(0, (lightness[i] - lo) / (hi - lo)));
    line += RAMP[Math.min(RAMP.length - 2, Math.floor(v * (RAMP.length - 1)))];
  }
  lines.push(line.trimEnd());
}
while (lines.length && !lines[0]) lines.shift();
while (lines.length && !lines.at(-1)) lines.pop();

await writeFile(new URL('../assets/portrait.txt', import.meta.url), lines.join('\n') + '\n');
console.log(`portrait.txt: ${lines.length} rows x ${COLS} cols`);
