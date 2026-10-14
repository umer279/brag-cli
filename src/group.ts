import { fromISODate, toISODate } from './entries.ts';
import type { Entry } from './types.ts';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));

export interface WeekGroup {
  key: string;
  label: string;
  entries: Entry[];
}

export interface MonthGroup {
  key: string;
  label: string;
  weeks: WeekGroup[];
}

/** Monday of the week containing the given YYYY-MM-DD date, as YYYY-MM-DD. */
export function weekStart(isoDate: string): string {
  const d = fromISODate(isoDate);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return toISODate(d);
}

export function addDays(isoDate: string, n: number): string {
  const d = fromISODate(isoDate);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function monthLabel(monthKey: string): string {
  const [y = 0, m = 1] = monthKey.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function shortDate(isoDate: string): string {
  const d = fromISODate(isoDate);
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function weekLabel(weekKey: string): string {
  return `Week of ${shortDate(weekKey)} – ${shortDate(addDays(weekKey, 6))}`;
}

/**
 * Group entries into months → weeks. A week belongs to the month of its Monday,
 * so a week spanning two months is never split.
 * order: 'desc' (newest first, default) or 'asc'. Entries within a week are always chronological.
 */
export function groupByMonthWeek(entries: Entry[], order: 'asc' | 'desc' = 'desc'): MonthGroup[] {
  const months = new Map<string, Map<string, Entry[]>>();
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''));
  for (const entry of sorted) {
    const wk = weekStart(entry.date);
    const mk = wk.slice(0, 7);
    let weeks = months.get(mk);
    if (!weeks) months.set(mk, (weeks = new Map()));
    let items = weeks.get(wk);
    if (!items) weeks.set(wk, (items = []));
    items.push(entry);
  }
  const dir = order === 'asc' ? 1 : -1;
  return [...months.entries()]
    .sort(([a], [b]) => dir * a.localeCompare(b))
    .map(([key, weeks]) => ({
      key,
      label: monthLabel(key),
      weeks: [...weeks.entries()]
        .sort(([a], [b]) => dir * a.localeCompare(b))
        .map(([wk, items]) => ({ key: wk, label: weekLabel(wk), entries: items })),
    }));
}

export function countBy(entries: Entry[], keyFn: (e: Entry) => string | string[] | undefined): [string, number][] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const k of ([] as (string | undefined)[]).concat(keyFn(e))) {
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function dateRange(entries: Entry[]): { from: string; to: string } | null {
  const dates = entries.map((e) => e.date).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  return from && to ? { from, to } : null;
}
