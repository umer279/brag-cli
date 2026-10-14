import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Entry, Journal } from './types.ts';

// src/store.ts and dist/store.js both sit one level below the project root.
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function homeDir(): string {
  return process.env.BRAG_HOME ? path.resolve(process.env.BRAG_HOME) : PROJECT_ROOT;
}

export function dataDir(): string {
  return path.join(homeDir(), 'data');
}

export function journalPath(): string {
  return path.join(dataDir(), 'journal.json');
}

export function exportsDir(): string {
  return path.join(homeDir(), 'exports');
}

export function emptyJournal(): Journal {
  return { version: 1, entries: [] };
}

export function load(file = journalPath()): Journal {
  if (!fs.existsSync(file)) return emptyJournal();
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.trim()) return emptyJournal();
  const journal = JSON.parse(raw) as Journal;
  if (!Array.isArray(journal.entries)) journal.entries = [];
  // Tolerate hand-edited files that omit the list fields.
  for (const e of journal.entries) {
    if (!Array.isArray(e.tags)) e.tags = [];
    if (!Array.isArray(e.links)) e.links = [];
  }
  return journal;
}

export function save(journal: Journal, file = journalPath()): void {
  journal.entries.sort(compareEntries);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Write to a temp file and rename so a crash never leaves a half-written journal.
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(journal, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

export function compareEntries(a: Entry, b: Entry): number {
  return a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || '');
}

export function newId(existing: Entry[]): string {
  const taken = new Set(existing.map((e) => e.id));
  let id: string;
  do {
    id = crypto.randomBytes(3).toString('hex');
  } while (taken.has(id));
  return id;
}
