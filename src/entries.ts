import { newId } from './store.ts';
import type { Entry, EntryFields, Filters, Journal, ListInput } from './types.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a Date as YYYY-MM-DD using local time. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse YYYY-MM-DD as a local date (new Date('YYYY-MM-DD') would be UTC). */
export function fromISODate(s: string): Date {
  const [y = 0, m = 1, d = 1] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Accepts YYYY-MM-DD, "today", "yesterday", or "Nd" / "Nw" (N days/weeks ago).
 * Returns a YYYY-MM-DD string or throws.
 */
export function parseDate(input: string | undefined | null, now = new Date()): string {
  if (input == null || input === '') return toISODate(now);
  const s = String(input).trim().toLowerCase();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (s === 'today') return toISODate(base);
  if (s === 'yesterday') {
    base.setDate(base.getDate() - 1);
    return toISODate(base);
  }
  const rel = s.match(/^(\d+)([dw])$/);
  if (rel) {
    base.setDate(base.getDate() - Number(rel[1]) * (rel[2] === 'w' ? 7 : 1));
    return toISODate(base);
  }
  if (ISO_DATE.test(s)) {
    const d = fromISODate(s);
    if (toISODate(d) === s) return s;
  }
  throw new Error(`Invalid date "${input}". Use YYYY-MM-DD, today, yesterday, 3d or 2w.`);
}

/** Flatten repeatable / comma-separated list options and de-duplicate. */
export function splitList(values: ListInput | null): string[] {
  if (values == null) return [];
  const arr = Array.isArray(values) ? values : [values];
  const out: string[] = [];
  for (const v of arr) {
    for (const part of String(v).split(',')) {
      const t = part.trim();
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out;
}

export function normalizeTags(values: ListInput | null): string[] {
  return [...new Set(splitList(values).map((t) => t.replace(/^#/, '').toLowerCase()).filter(Boolean))];
}

export function addEntry(journal: Journal, fields: EntryFields, now = new Date()): Entry {
  const text = (fields.text || '').trim();
  if (!text) throw new Error('Entry text is required.');
  const entry: Entry = {
    id: newId(journal.entries),
    date: parseDate(fields.date, now),
    createdAt: now.toISOString(),
    text,
    impact: (fields.impact || '').trim() || undefined,
    project: (fields.project || '').trim() || undefined,
    tags: normalizeTags(fields.tags),
    links: splitList(fields.links),
  };
  journal.entries.push(entry);
  return entry;
}

export function findEntry(journal: Journal, id: string): Entry {
  const matches = journal.entries.filter((e) => e.id.startsWith(id));
  const [first] = matches;
  if (!first) throw new Error(`No entry with id "${id}".`);
  if (matches.length > 1) throw new Error(`Id "${id}" is ambiguous (${matches.map((e) => e.id).join(', ')}).`);
  return first;
}

/** Update only the fields that are present in `changes`. Empty strings clear optional fields. */
export function updateEntry(journal: Journal, id: string, changes: EntryFields, now = new Date()): Entry {
  const entry = findEntry(journal, id);
  if (changes.text !== undefined) {
    const text = changes.text.trim();
    if (!text) throw new Error('Entry text cannot be empty.');
    entry.text = text;
  }
  if (changes.date !== undefined) entry.date = parseDate(changes.date, now);
  for (const key of ['impact', 'project'] as const) {
    const value = changes[key];
    if (value !== undefined) entry[key] = value.trim() || undefined;
  }
  if (changes.tags !== undefined) entry.tags = normalizeTags(changes.tags);
  if (changes.links !== undefined) entry.links = splitList(changes.links);
  entry.updatedAt = now.toISOString();
  return entry;
}

export function removeEntry(journal: Journal, id: string): Entry {
  const entry = findEntry(journal, id);
  journal.entries = journal.entries.filter((e) => e !== entry);
  return entry;
}

/** Filter by { since, until, tags, project }. Tag filter matches entries having any of the tags. */
export function filterEntries(entries: Entry[], { since, until, tags, project }: Filters = {}): Entry[] {
  const from = since ? parseDate(since) : null;
  const to = until ? parseDate(until) : null;
  const wantTags = normalizeTags(tags);
  const wantProject = project ? project.toLowerCase() : null;
  return entries.filter((e) => {
    if (from && e.date < from) return false;
    if (to && e.date > to) return false;
    if (wantTags.length && !e.tags.some((t) => wantTags.includes(t))) return false;
    if (wantProject && (e.project || '').toLowerCase() !== wantProject) return false;
    return true;
  });
}

export function knownValues(entries: Entry[]): { tags: string[]; projects: string[] } {
  const tags = new Set<string>();
  const projects = new Set<string>();
  for (const e of entries) {
    e.tags.forEach((t) => tags.add(t));
    if (e.project) projects.add(e.project);
  }
  return { tags: [...tags].sort(), projects: [...projects].sort() };
}
