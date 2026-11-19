// Pure calendar math. Dates are "YYYY-MM-DD" strings; "today" is always the
// Europe/Tirane calendar date, so streaks and windows follow local time.

export const TIME_ZONE = 'Europe/Tirane';

export type Day = { date: string; count: number };

export type MonthTotal = { key: string; label: string; count: number; partial: boolean };

export type Stats = {
  today: string;
  windowStart: string;
  total: number;
  activeDays: number;
  windowDays: number;
  currentStreak: number;
  currentStreakStart: string | null;
  longestStreak: number;
  longestStreakStart: string | null;
  longestStreakEnd: string | null;
  bestDay: Day | null;
  averagePerActiveDay: number;
  months: MonthTotal[];
  window: Day[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateInZone(instant: Date, timeZone = TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayMondayFirst(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function monthLabel(date: string, withYear = false): string {
  const label = MONTHS[Number(date.slice(5, 7)) - 1];
  return withYear ? `${label} '${date.slice(2, 4)}` : label;
}

// The last 12 months: from the day after the same date one year ago, through today.
export function windowStartFor(today: string): string {
  const year = Number(today.slice(0, 4)) - 1;
  let start = `${year}${today.slice(4)}`;
  // 29 Feb has no twin in the previous year.
  if (start.endsWith('-02-29')) start = `${year}-02-28`;
  return addDays(start, 1);
}

// Integer floor to one decimal, so a figure is never rounded up.
export function floorOneDecimal(value: number): number {
  return Math.floor(value * 10) / 10;
}

export function computeStats(counts: Map<string, number>, today: string): Stats {
  const countOn = (date: string) => counts.get(date) ?? 0;

  const windowStart = windowStartFor(today);
  const window: Day[] = [];
  for (let d = windowStart; d <= today; d = addDays(d, 1)) window.push({ date: d, count: countOn(d) });

  const total = window.reduce((sum, d) => sum + d.count, 0);
  const active = window.filter((d) => d.count > 0);
  const bestDay = active.reduce<Day | null>((best, d) => (!best || d.count > best.count ? d : best), null);

  // Current streak: today does not break it until the day is over.
  let cursor = countOn(today) > 0 ? today : addDays(today, -1);
  let currentStreak = 0;
  while (countOn(cursor) > 0) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  // Longest streak across every day we have data for.
  const dates = [...counts.keys()].filter((d) => d <= today).sort();
  let longestStreak = 0;
  let longestStreakStart: string | null = null;
  let longestStreakEnd: string | null = null;
  let run = 0;
  let runStart = '';
  let previous = '';
  for (const date of dates) {
    if (countOn(date) > 0) {
      run = run > 0 && addDays(previous, 1) === date ? run + 1 : 1;
      if (run === 1) runStart = date;
      if (run > longestStreak) {
        longestStreak = run;
        longestStreakStart = runStart;
        longestStreakEnd = date;
      }
    } else {
      run = 0;
    }
    previous = date;
  }

  const months: MonthTotal[] = [];
  for (const day of window) {
    const key = day.date.slice(0, 7);
    let month = months.at(-1);
    if (!month || month.key !== key) {
      month = { key, label: '', count: 0, partial: false };
      months.push(month);
    }
    month.count += day.count;
  }
  const lastDayOfMonth = (key: string) => addDays(`${addDays(`${key}-28`, 4).slice(0, 7)}-01`, -1);
  for (const month of months) {
    month.label = monthLabel(`${month.key}-01`, true);
    month.partial = windowStart > `${month.key}-01` || today < lastDayOfMonth(month.key);
  }

  return {
    today,
    windowStart,
    total,
    activeDays: active.length,
    windowDays: window.length,
    currentStreak,
    currentStreakStart: currentStreak > 0 ? addDays(cursor, 1) : null,
    longestStreak,
    longestStreakStart,
    longestStreakEnd,
    bestDay,
    averagePerActiveDay: active.length ? floorOneDecimal(total / active.length) : 0,
    months,
    window,
  };
}

// GitHub-style intensity: 0 for empty days, 1-4 by quartile of the non-zero counts.
export function levelThresholds(window: Day[]): number[] {
  const nonZero = window.map((d) => d.count).filter((c) => c > 0).sort((a, b) => a - b);
  if (!nonZero.length) return [1, 1, 1];
  const at = (q: number) => nonZero[Math.min(nonZero.length - 1, Math.floor(q * nonZero.length))];
  return [at(0.25), at(0.5), at(0.75)];
}

export function levelFor(count: number, thresholds: number[]): number {
  if (count <= 0) return 0;
  if (count <= thresholds[0]) return 1;
  if (count <= thresholds[1]) return 2;
  if (count <= thresholds[2]) return 3;
  return 4;
}
