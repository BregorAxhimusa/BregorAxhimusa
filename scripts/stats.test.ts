import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, computeStats, dateInZone, floorOneDecimal, levelFor, levelThresholds, windowStartFor } from './stats.ts';

const map = (entries: Record<string, number>) => new Map(Object.entries(entries));

test('dateInZone uses Europe/Tirane, not UTC', () => {
  // 23:30 UTC on 31 Dec is already 1 Jan in Tirane (UTC+1 in winter).
  assert.equal(dateInZone(new Date('2025-12-31T23:30:00Z')), '2026-01-01');
  // 22:30 UTC in July is 00:30 next day in Tirane (UTC+2 in summer).
  assert.equal(dateInZone(new Date('2026-07-10T22:30:00Z')), '2026-07-11');
});

test('window covers the last 12 months ending today', () => {
  assert.equal(windowStartFor('2026-11-19'), '2025-11-20');
  assert.equal(windowStartFor('2028-02-29'), '2027-03-01');
  const stats = computeStats(new Map(), '2026-11-19');
  assert.equal(stats.windowDays, 365);
  assert.equal(stats.window.at(-1)?.date, '2026-11-19');
});

test('current streak survives an empty today but not an empty yesterday', () => {
  const counts = map({ '2026-11-16': 1, '2026-11-17': 2, '2026-11-18': 3 });
  assert.equal(computeStats(counts, '2026-11-19').currentStreak, 3);
  assert.equal(computeStats(counts, '2026-11-19').currentStreakStart, '2026-11-16');
  assert.equal(computeStats(counts, '2026-11-20').currentStreak, 0);
  counts.set('2026-11-19', 1);
  assert.equal(computeStats(counts, '2026-11-19').currentStreak, 4);
});

test('longest streak, best day, totals and averages', () => {
  const counts = map({
    '2026-01-01': 1, '2026-01-02': 1, '2026-01-03': 1, '2026-01-04': 0,
    '2026-02-10': 9, '2026-02-11': 1,
  });
  const stats = computeStats(counts, '2026-03-01');
  assert.equal(stats.longestStreak, 3);
  assert.equal(stats.longestStreakStart, '2026-01-01');
  assert.equal(stats.longestStreakEnd, '2026-01-03');
  assert.deepEqual(stats.bestDay, { date: '2026-02-10', count: 9 });
  assert.equal(stats.total, 13);
  assert.equal(stats.activeDays, 5);
  assert.equal(stats.averagePerActiveDay, 2.6);
  assert.equal(stats.months.reduce((s, m) => s + m.count, 0), stats.total);
});

test('gaps in the data break a streak', () => {
  const stats = computeStats(map({ '2026-01-01': 1, '2026-01-03': 1 }), '2026-01-05');
  assert.equal(stats.longestStreak, 1);
});

test('months split the window and flag partial ends', () => {
  const stats = computeStats(new Map(), '2026-11-19');
  assert.equal(stats.months.length, 13);
  assert.equal(stats.months[0].label, "Nov '25");
  assert.equal(stats.months[0].partial, true);
  assert.equal(stats.months[1].partial, false);
  assert.equal(stats.months.at(-1)?.partial, true);
  assert.equal(computeStats(new Map(), '2026-10-31').months.at(-1)?.partial, false);
});

test('floorOneDecimal never rounds up', () => {
  assert.equal(floorOneDecimal(15.19), 15.1);
  assert.equal(floorOneDecimal(2), 2);
});

test('intensity levels', () => {
  const window = [1, 2, 3, 4, 5, 6, 7, 8].map((count, i) => ({ date: addDays('2026-01-01', i), count }));
  const t = levelThresholds(window);
  assert.equal(levelFor(0, t), 0);
  assert.equal(levelFor(1, t), 1);
  assert.equal(levelFor(8, t), 4);
});
