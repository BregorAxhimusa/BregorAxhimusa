// One-off: turns a photo into assets/portrait.txt. Run locally with
//   npm run portrait -- <path-to-photo>
// The photo stays out of this repo; only the ASCII text is committed, and
// generate.ts renders it to SVG in the brand colours.
//
// portrait.txt is drawn as ink on paper: darker pixels get denser glyphs.
// The dark theme flips the subject's glyphs so it reads as light on dark.

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { CHAR, COVERAGE, PORTRAIT, RAMP } from './theme.ts';

// The studio backdrop is a flat, colourless light grey (lightness about 0.83).
const BACKDROP_MAX_SATURATION = 0.08;
const BACKDROP_LIGHTNESS = [0.68, 0.95];
// Head and hood of the 460x460 portfolio photo, as fractions of its size; tight
// enough that the face fills most of the 64 columns.
const CROP = { left: 0.29, top: 0.01, width: 0.4, height: 0.47 };
// The photo is lit from one side, so half the face is washed out and half in
// shadow. The shading keeps only DETAIL_BASE of the plain grey and takes the
// rest from the difference to a blur of DETAIL_SIGMA source pixels, amplified
// by DETAIL_GAIN: that evens out the light and lifts the eyes, brows and beard.
const DETAIL_SIGMA = 10;
const DETAIL_BASE = 0.15;
const DETAIL_GAIN = 3;
// Width / height of one glyph cell, so the face keeps its proportions.
const CELL_ASPECT = (PORTRAIT.size * CHAR) / PORTRAIT.lineHeight;

const input = process.argv[2];
if (!input) throw new Error('Usage: npm run portrait -- <path-to-photo>');

const meta = await sharp(input).metadata();
const region = {
  left: Math.round((meta.width ?? 0) * CROP.left),
  top: Math.round((meta.height ?? 0) * CROP.top),
  width: Math.round((meta.width ?? 0) * CROP.width),
  height: Math.round((meta.height ?? 0) * CROP.height),
};
const cols = PORTRAIT.cols;
const rows = Math.round(cols * (region.height / region.width) * CELL_ASPECT);

// sharp hands back three channels after a resize even for grey input, so every
// grey buffer keeps only the first one.
const crop = await sharp(input).extract(region).removeAlpha().png().toBuffer();
const colour = await sharp(crop).resize(cols, rows, { fit: 'fill' }).raw().toBuffer();
const plain = await sharp(crop).greyscale().extractChannel(0).raw().toBuffer({ resolveWithObject: true });
const blurred = await sharp(crop).greyscale().blur(DETAIL_SIGMA).extractChannel(0).raw().toBuffer();
const detail = Buffer.alloc(plain.data.length);
for (let i = 0; i < detail.length; i++) {
  const local = 128 + DETAIL_GAIN * (plain.data[i] - blurred[i]);
  detail[i] = Math.max(0, Math.min(255, DETAIL_BASE * plain.data[i] + (1 - DETAIL_BASE) * local));
}
const grey = await sharp(detail, { raw: { width: plain.info.width, height: plain.info.height, channels: 1 } })
  .resize(cols, rows, { fit: 'fill' })
  .extractChannel(0)
  .raw()
  .toBuffer();

// Backdrop: flat light grey pixels connected to the border of the crop. The
// flood fill keeps bright skin highlights inside the face.
const flat = (i: number) => {
  const [r, g, b] = [colour[i * 3], colour[i * 3 + 1], colour[i * 3 + 2]].map((c) => c / 255);
  const max = Math.max(r, g, b);
  const saturation = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return saturation < BACKDROP_MAX_SATURATION && l > BACKDROP_LIGHTNESS[0] && l < BACKDROP_LIGHTNESS[1];
};
const backdrop = new Array<boolean>(cols * rows).fill(false);
const queue: number[] = [];
for (let x = 0; x < cols; x++) queue.push(x, (rows - 1) * cols + x);
for (let y = 0; y < rows; y++) queue.push(y * cols, y * cols + cols - 1);
while (queue.length) {
  const i = queue.pop()!;
  if (backdrop[i] || !flat(i)) continue;
  backdrop[i] = true;
  const x = i % cols;
  if (x > 0) queue.push(i - 1);
  if (x < cols - 1) queue.push(i + 1);
  if (i >= cols) queue.push(i - cols);
  if (i < (rows - 1) * cols) queue.push(i + cols);
}

// Histogram equalisation over the subject: each grey value maps to its mid
// rank among the subject cells, so every glyph gets a fair share of the face.
const sorted = Array.from({ length: cols * rows }, (_, i) => grey[i])
  .filter((_, i) => !backdrop[i])
  .sort((a, b) => a - b);
const rank = new Map<number, number>();
for (let n = 0; n < sorted.length; n++) {
  const g = sorted[n];
  if (!rank.has(g)) rank.set(g, (n + sorted.lastIndexOf(g)) / 2 / sorted.length);
}

// Each subject cell asks for an ink share between the lightest and densest
// glyph and gets the closest one. Subject cells never get the space, so the
// outline stays closed.
const min = COVERAGE[1];
const max = COVERAGE[COVERAGE.length - 1];
const nearest = (c: number) => {
  let best = 1;
  for (let k = 2; k < COVERAGE.length; k++) if (Math.abs(COVERAGE[k] - c) < Math.abs(COVERAGE[best] - c)) best = k;
  return best;
};
const lines: string[] = [];
for (let y = 0; y < rows; y++) {
  let line = '';
  for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    line += backdrop[i] ? ' ' : RAMP[nearest(min + (1 - rank.get(grey[i])!) * (max - min))];
  }
  lines.push(line.trimEnd());
}
while (lines.length && !lines[0]) lines.shift();
while (lines.length && !lines.at(-1)) lines.pop();

await writeFile(new URL('../assets/portrait.txt', import.meta.url), lines.join('\n') + '\n');
console.log(`portrait.txt: ${lines.length} rows x ${cols} cols`);
