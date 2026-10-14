import { styleText } from 'node:util';
import { groupByMonthWeek, shortDate } from './group.ts';
import type { Entry } from './types.ts';

type Style = Parameters<typeof styleText>[0];

const c = (style: Style, text: string) => styleText(style, text, { stream: process.stdout });

export function formatEntry(e: Entry): string {
  const lines = [`  ${c('dim', e.id)}  ${c('dim', shortDate(e.date).padEnd(6))}  ${c('bold', e.text)}`];
  const indent = ' '.repeat(18);
  if (e.impact) lines.push(`${indent}${c('green', '↳ ' + e.impact)}`);
  const meta = [e.project && c('cyan', e.project), e.tags.length && c('magenta', e.tags.map((t) => `#${t}`).join(' '))].filter(Boolean);
  if (meta.length) lines.push(`${indent}${meta.join('  ')}`);
  for (const link of e.links) lines.push(`${indent}${c('blue', link)}`);
  return lines.join('\n');
}

export function formatList(entries: Entry[]): string {
  if (!entries.length) return c('dim', 'No entries found.');
  const out: string[] = [];
  for (const month of groupByMonthWeek(entries)) {
    out.push(c(['bold', 'yellow'], month.label));
    for (const week of month.weeks) {
      out.push(c('underline', ` ${week.label}`));
      for (const e of week.entries) out.push(formatEntry(e));
    }
    out.push('');
  }
  return out.join('\n').trimEnd();
}

export function formatCounts(title: string, counts: [string, number][], prefix = ''): string {
  if (!counts.length) return '';
  const width = Math.max(...counts.map(([k]) => (prefix + k).length));
  return [c('bold', title), ...counts.map(([k, n]) => `  ${(prefix + k).padEnd(width)}  ${n}`)].join('\n');
}
