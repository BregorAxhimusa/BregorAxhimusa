// SVG renderers. Every card shares one terminal frame and is drawn twice, once
// per theme; README.md switches between them with <picture>.

import { CHAR, FONT, type Theme } from './theme.ts';
import { addDays, levelFor, levelThresholds, monthLabel, weekdayMondayFirst, type Stats } from './stats.ts';

export const WIDTH = 860;
const PAD = 28;
const BAR = 38;

// B/A mark from bregorx-portfolio/public/brand/logo-mark.svg.
const MARK_VIEWBOX = '62 -942 1715 1112';
const MARK_LETTERS =
  'M622 -191Q622 -103 560.5 -51.5Q499 0 389 0H62V-702H378Q485 -702 545.5 -653Q606 -604 606 -520Q606 -458 573.5 -417Q541 -376 487 -360Q548 -347 585 -299.5Q622 -252 622 -191ZM233 -418H345Q387 -418 409.5 -436.5Q432 -455 432 -491Q432 -527 409.5 -546Q387 -565 345 -565H233ZM449 -214Q449 -251 424.5 -272Q400 -293 357 -293H233V-138H359Q402 -138 425.5 -157.5Q449 -177 449 -214Z M1554 -124H1292L1250 0H1071L1325 -702H1523L1777 0H1596ZM1510 -256 1423 -513 1337 -256Z';
const MARK_SLASH = 'M1036 -942 762 170H672L945 -942Z';

export function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const num = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, word: string) => `${num(n)} ${word}${n === 1 ? '' : 's'}`;

export function longDate(date: string): string {
  return `${Number(date.slice(8, 10))} ${monthLabel(date)} ${date.slice(0, 4)}`;
}

function mark(t: Theme, x: number, y: number, height: number): string {
  const width = (height * 1715) / 1112;
  return `<svg x="${x}" y="${y}" width="${width.toFixed(1)}" height="${height}" viewBox="${MARK_VIEWBOX}"><path fill="${t.fg}" d="${MARK_LETTERS}"/><path fill="${t.accent}" d="${MARK_SLASH}"/></svg>`;
}

function frame(t: Theme, height: number, title: string, label: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title>
<style>
text{font-family:${FONT};fill:${t.fg}}
.m{fill:${t.muted}}.a{fill:${t.accentText}}.b{font-weight:700}
.cur{animation:blink 1.1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){.cur{animation:none}}
</style>
<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${height - 1}" rx="12" fill="${t.bg}" stroke="${t.line}"/>
<path d="M1 ${BAR}H${WIDTH - 1}" stroke="${t.line}"/>
<rect x="${PAD}" y="${BAR / 2 - 4}" width="8" height="8" fill="${t.accent}"/>
<text x="${PAD + 18}" y="${BAR / 2 + 4.5}" font-size="13" class="m">${esc(title)}</text>
${body}
</svg>
`;
}

function prompt(x: number, y: number, command: string, size = 15): string {
  return `<text x="${x}" y="${y}" font-size="${size}" xml:space="preserve"><tspan class="a">bregor@github</tspan><tspan class="m"> ~ $ </tspan>${esc(command)}</text>`;
}

function cursor(t: Theme, x: number, y: number, size = 15): string {
  return `<rect class="cur" x="${x}" y="${y - size * 0.8}" width="${size * CHAR}" height="${size}" fill="${t.accent}"/>`;
}

export function renderHeader(t: Theme, name: string, role: string, location: string): string {
  const size = 15;
  const promptWidth = 'bregor@github ~ $ '.length * size * CHAR;
  const body = [
    prompt(PAD, 76, 'whoami', size),
    `<text x="${PAD}" y="134" font-size="40" class="b">${esc(name)}</text>`,
    `<text x="${PAD}" y="172" font-size="20">${esc(role)}</text>`,
    `<text x="${PAD}" y="204" font-size="16" class="m" xml:space="preserve"><tspan class="a">@</tspan> ${esc(location)}</text>`,
    prompt(PAD, 252, '', size),
    cursor(t, PAD + promptWidth, 252, size),
    mark(t, WIDTH - PAD - 200, 82, 130),
  ].join('\n');
  return frame(t, 284, 'bregor@github: ~', `${name}, ${role}, ${location}`, body);
}

export function renderPortrait(t: Theme, ascii: string): string {
  const lines = ascii.replace(/\s+$/, '').split('\n');
  const cols = Math.max(...lines.map((l) => l.length));
  const size = 12;
  const lineHeight = 12.5;
  const charWidth = size * CHAR;
  const x = (WIDTH - cols * charWidth) / 2;
  const top = 96;
  // Every glyph gets its own x, so the art lines up whatever monospace font
  // the viewer has; spaces are simply left out.
  const rows = lines
    .map((line, i) => {
      const xs: string[] = [];
      let text = '';
      for (let c = 0; c < line.length; c++) {
        if (line[c] === ' ') continue;
        xs.push((x + c * charWidth).toFixed(1));
        text += line[c];
      }
      if (!text) return '';
      return `<text x="${xs.join(' ')}" y="${(top + i * lineHeight).toFixed(1)}">${esc(text)}</text>`;
    })
    .filter(Boolean)
    .join('\n');
  const height = top + lines.length * lineHeight + 24;
  const body = [prompt(PAD, 68, 'cat portrait.txt'), `<g class="a" font-size="${size}" style="fill:${t.accentText}">`, rows, '</g>'].join('\n');
  return frame(t, Math.ceil(height), '~/portrait.txt', 'ASCII portrait of Bregor Axhimusa', body);
}

export function renderHeatmap(t: Theme, stats: Stats): string {
  const cell = 11;
  const step = 14;
  const x0 = 64;
  const y0 = 104;
  const thresholds = levelThresholds(stats.window);
  const gridStart = addDays(stats.windowStart, -weekdayMondayFirst(stats.windowStart));

  const cells: string[] = [];
  const months: string[] = [];
  let lastLabelColumn = -10;
  for (const day of stats.window) {
    const offset = Math.round((Date.parse(day.date) - Date.parse(gridStart)) / 86_400_000);
    const column = Math.floor(offset / 7);
    const row = offset % 7;
    const level = levelFor(day.count, thresholds);
    cells.push(`<rect x="${x0 + column * step}" y="${y0 + row * step}" width="${cell}" height="${cell}" rx="2" fill="${t.heat[level]}"/>`);
    if (day.date.endsWith('-01') && column - lastLabelColumn >= 3) {
      months.push(`<text x="${x0 + column * step}" y="${y0 - 10}" font-size="11" class="m">${monthLabel(day.date)}</text>`);
      lastLabelColumn = column;
    }
  }
  const weekdays = ['Mon', 'Wed', 'Fri']
    .map((d, i) => `<text x="${PAD}" y="${y0 + i * 2 * step + 9}" font-size="10" class="m">${d}</text>`)
    .join('');

  const legendY = y0 + 7 * step + 28;
  const legendX = WIDTH - PAD - 5 * step - 72;
  const legend = [
    `<text x="${legendX}" y="${legendY}" font-size="11" class="m">Less</text>`,
    ...t.heat.map((c, i) => `<rect x="${legendX + 34 + i * step}" y="${legendY - 10}" width="${cell}" height="${cell}" rx="2" fill="${c}"/>`),
    `<text x="${legendX + 40 + 5 * step}" y="${legendY}" font-size="11" class="m">More</text>`,
  ].join('');

  const body = [
    prompt(PAD, 66, `contributions --since ${stats.windowStart} --tz Europe/Tirane`),
    months.join(''),
    weekdays,
    cells.join(''),
    `<text x="${PAD}" y="${legendY}" font-size="13" xml:space="preserve"><tspan class="a b">${num(stats.total)}</tspan> contributions in the last 12 months</text>`,
    legend,
  ].join('\n');
  return frame(t, legendY + 26, '~/contributions', `${num(stats.total)} GitHub contributions in the last 12 months`, body);
}

export function renderStats(t: Theme, stats: Stats): string {
  const gap = 16;
  const tileWidth = (WIDTH - 2 * PAD - 2 * gap) / 3;
  const tileHeight = 92;
  const top = 88;

  const tiles: [string, string, string][] = [
    ['Contributions, last 12 months', num(stats.total), `${longDate(stats.windowStart)} to ${longDate(stats.today)}`],
    [
      'Current streak',
      plural(stats.currentStreak, 'day'),
      stats.currentStreakStart ? `since ${longDate(stats.currentStreakStart)}` : 'starts with the next contribution',
    ],
    [
      'Longest streak, all time',
      plural(stats.longestStreak, 'day'),
      stats.longestStreakStart && stats.longestStreakEnd
        ? `${longDate(stats.longestStreakStart)} to ${longDate(stats.longestStreakEnd)}`
        : 'no contributions yet',
    ],
    ['Active days', `${num(stats.activeDays)} / ${num(stats.windowDays)}`, `${Math.floor((stats.activeDays / stats.windowDays) * 100)}% of days in the last 12 months`],
    ['Best day', num(stats.bestDay?.count ?? 0), stats.bestDay ? `contributions on ${longDate(stats.bestDay.date)}` : 'no contributions yet'],
    ['Average per active day', String(stats.averagePerActiveDay), 'contributions, cut to one decimal'],
  ];

  const tileSvg = tiles
    .map(([label, value, sub], i) => {
      const x = PAD + (i % 3) * (tileWidth + gap);
      const y = top + Math.floor(i / 3) * (tileHeight + gap);
      return [
        `<rect x="${x}" y="${y}" width="${tileWidth.toFixed(1)}" height="${tileHeight}" rx="8" fill="none" stroke="${t.line}"/>`,
        `<text x="${x + 16}" y="${y + 26}" font-size="12" class="m">${esc(label)}</text>`,
        `<text x="${x + 16}" y="${y + 60}" font-size="26" class="b${i === 0 ? ' a' : ''}">${esc(value)}</text>`,
        `<text x="${x + 16}" y="${y + 80}" font-size="11" class="m">${esc(sub)}</text>`,
      ].join('');
    })
    .join('\n');

  const chartTop = top + 2 * tileHeight + gap + 52;
  const chartHeight = 110;
  const slot = (WIDTH - 2 * PAD) / stats.months.length;
  const barWidth = Math.min(36, slot - 14);
  const max = Math.max(1, ...stats.months.map((m) => m.count));
  const baseline = chartTop + chartHeight;
  const bars = stats.months
    .map((m, i) => {
      const h = m.count ? Math.max(2, (m.count / max) * chartHeight) : 0;
      const cx = PAD + i * slot + slot / 2;
      const opacity = m.partial ? ' fill-opacity="0.45"' : '';
      return [
        `<rect x="${(cx - barWidth / 2).toFixed(1)}" y="${(baseline - h).toFixed(1)}" width="${barWidth}" height="${h.toFixed(1)}" rx="2" fill="${t.accent}"${opacity}/>`,
        `<text x="${cx.toFixed(1)}" y="${(baseline - h - 6).toFixed(1)}" font-size="10" text-anchor="middle">${num(m.count)}</text>`,
        `<text x="${cx.toFixed(1)}" y="${baseline + 17}" font-size="10" text-anchor="middle" class="m">${esc(m.label)}</text>`,
      ].join('');
    })
    .join('\n');

  const body = [
    prompt(PAD, 66, 'stats --tz Europe/Tirane'),
    tileSvg,
    `<text x="${PAD}" y="${chartTop - 22}" font-size="13">Contributions per month</text>`,
    `<text x="${WIDTH - PAD}" y="${chartTop - 22}" font-size="11" text-anchor="end" class="m">pale bars: months only partly inside the 12-month window</text>`,
    `<path d="M${PAD} ${baseline + 0.5}H${WIDTH - PAD}" stroke="${t.line}"/>`,
    bars,
  ].join('\n');
  const label = `GitHub stats: ${num(stats.total)} contributions in the last 12 months, current streak ${plural(stats.currentStreak, 'day')}, longest streak ${plural(stats.longestStreak, 'day')}`;
  return frame(t, baseline + 40, '~/stats', label, body);
}

export type StackGroup = { title: string; tags: string[] };

export function renderStack(t: Theme, groups: StackGroup[]): string {
  const size = 13;
  const pillHeight = 28;
  const pillPad = 12;
  const labelWidth = 120;
  const rowGap = 10;
  const parts: string[] = [];
  let y = 92;
  for (const group of groups) {
    parts.push(`<text x="${PAD}" y="${y + 19}" font-size="14" class="a b">${esc(group.title)}</text>`);
    let x = PAD + labelWidth;
    for (const tag of group.tags) {
      const w = tag.length * size * CHAR + 2 * pillPad;
      if (x + w > WIDTH - PAD) {
        x = PAD + labelWidth;
        y += pillHeight + 8;
      }
      parts.push(
        `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${pillHeight}" rx="6" fill="none" stroke="${t.line}"/>`,
        `<text x="${(x + pillPad).toFixed(1)}" y="${y + 18.5}" font-size="${size}">${esc(tag)}</text>`,
      );
      x += w + 8;
    }
    y += pillHeight + rowGap + 8;
  }
  const label = `Tech stack. ${groups.map((g) => `${g.title}: ${g.tags.join(', ')}`).join('. ')}`;
  return frame(t, y + 10, '~/stack', label, [prompt(PAD, 66, 'ls ~/stack'), ...parts].join('\n'));
}
