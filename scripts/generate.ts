// Regenerates every SVG in assets/ from live GitHub data.
//   GITHUB_TOKEN=... node scripts/generate.ts
// Writes a file only when its content changed, so the workflow can commit
// only on real changes.

import { readFile, writeFile } from 'node:fs/promises';
import { fetchContributions } from './github.ts';
import { computeStats, dateInZone } from './stats.ts';
import { renderHeader, renderHeatmap, renderStack, renderStats, type StackGroup } from './render.ts';
import { themes } from './theme.ts';

const LOGIN = 'BregorAxhimusa';
const NAME = 'Bregor Axhimusa';
// hero_role_line from bregorx-portfolio/server/data/homeContent.ts.
const ROLE = 'Full-Stack Engineer: Web, Mobile and Backend';
const LOCATION = 'Prishtinë, Kosovo';

// The tech stack groups on the portfolio home page (homeContent.ts).
const STACK: StackGroup[] = [
  { title: 'Backend', tags: ['PHP', 'Laravel', 'Go', 'Node.js', 'Fastify', 'PostgreSQL', 'MySQL', 'Redis'] },
  { title: 'Frontend', tags: ['TypeScript', 'JavaScript', 'React', 'Next.js', 'Vue / Nuxt', 'Tailwind CSS', 'GSAP'] },
  { title: 'Mobile', tags: ['React Native', 'Expo', 'Capacitor'] },
  { title: 'Platform', tags: ['Supabase', 'Docker', 'Linux', 'Cloudflare', 'GitHub Actions', 'Coolify'] },
];

const assets = new URL('../assets/', import.meta.url);

async function write(name: string, content: string): Promise<void> {
  const file = new URL(name, assets);
  const current = await readFile(file, 'utf8').catch(() => null);
  if (current === content) return;
  await writeFile(file, content);
  console.log(`updated ${name}`);
}

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
if (!token) throw new Error('Set GITHUB_TOKEN to read the contribution calendar.');

const now = new Date();
const counts = await fetchContributions(token, LOGIN, now);
const stats = computeStats(counts, dateInZone(now));
const portrait = await readFile(new URL('portrait.txt', assets), 'utf8');

for (const theme of themes) {
  await write(`header-${theme.name}.svg`, renderHeader(theme, NAME, ROLE, LOCATION, portrait));
  await write(`contributions-${theme.name}.svg`, renderHeatmap(theme, stats));
  await write(`stats-${theme.name}.svg`, renderStats(theme, stats));
  await write(`stack-${theme.name}.svg`, renderStack(theme, STACK));
}

console.log(
  [
    `as of ${stats.today} (Europe/Tirane)`,
    `last 12 months: ${stats.total}`,
    `active days: ${stats.activeDays}/${stats.windowDays}`,
    `current streak: ${stats.currentStreak}`,
    `longest streak: ${stats.longestStreak}`,
    `best day: ${stats.bestDay?.count ?? 0} on ${stats.bestDay?.date ?? '-'}`,
    `average per active day: ${stats.averagePerActiveDay}`,
  ].join(' | '),
);
