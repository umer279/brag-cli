import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load, save, emptyJournal } from '../src/store.ts';
import { addEntry, updateEntry, removeEntry, filterEntries, parseDate, splitList, normalizeTags } from '../src/entries.ts';
import { groupByMonthWeek, weekStart, weekLabel } from '../src/group.ts';
import { renderMarkdown, exportMarkdown } from '../src/markdown.ts';
import type { Filters } from '../src/types.ts';

const NOW = new Date(2026, 9, 14, 10, 0, 0); // Wed 14 Oct 2026, local time

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'brag-test-'));

test('parseDate handles keywords, relative and explicit dates', () => {
  assert.equal(parseDate(undefined, NOW), '2026-10-14');
  assert.equal(parseDate('today', NOW), '2026-10-14');
  assert.equal(parseDate('yesterday', NOW), '2026-10-13');
  assert.equal(parseDate('3d', NOW), '2026-10-11');
  assert.equal(parseDate('2w', NOW), '2026-09-30');
  assert.equal(parseDate('2026-02-28', NOW), '2026-02-28');
  assert.throws(() => parseDate('2026-02-30', NOW));
  assert.throws(() => parseDate('last tuesday', NOW));
});

test('list helpers split commas and normalize tags', () => {
  assert.deepEqual(splitList(['a, b', 'c', 'a']), ['a', 'b', 'c']);
  assert.deepEqual(normalizeTags(['#Backend', 'lead,Backend']), ['backend', 'lead']);
});

test('store round-trips and sorts entries by date', () => {
  const file = path.join(tmpDir(), 'journal.json');
  const j = emptyJournal();
  addEntry(j, { text: 'second', date: '2026-10-10' }, NOW);
  addEntry(j, { text: 'first', date: '2026-09-01', tags: 'x' }, NOW);
  save(j, file);
  const loaded = load(file);
  assert.deepEqual(loaded.entries.map((e) => e.text), ['first', 'second']);
  assert.deepEqual(loaded.entries[1]!.tags, []);
  assert.equal(loaded.entries[0]!.impact, undefined);
});

test('load returns an empty journal for a missing file', () => {
  assert.deepEqual(load(path.join(tmpDir(), 'nope.json')), emptyJournal());
});

test('add / update / remove', () => {
  const j = emptyJournal();
  const e = addEntry(j, { text: ' Shipped it ', impact: 'big', tags: ['a'], links: 'http://x' }, NOW);
  assert.equal(e.text, 'Shipped it');
  assert.equal(e.id.length, 6);
  assert.throws(() => addEntry(j, { text: '  ' }, NOW));

  updateEntry(j, e.id.slice(0, 3), { impact: '', tags: 'b,c' }, NOW);
  assert.equal(e.impact, undefined);
  assert.deepEqual(e.tags, ['b', 'c']);
  assert.equal(e.text, 'Shipped it'); // untouched

  removeEntry(j, e.id);
  assert.equal(j.entries.length, 0);
  assert.throws(() => removeEntry(j, e.id), /No entry/);
});

test('filterEntries by date range, tag and project', () => {
  const j = emptyJournal();
  addEntry(j, { text: 'a', date: '2026-09-01', tags: 'backend', project: 'Billing' }, NOW);
  addEntry(j, { text: 'b', date: '2026-10-01', tags: 'lead' }, NOW);
  addEntry(j, { text: 'c', date: '2026-10-12', tags: 'backend,lead' }, NOW);
  const texts = (f: Filters) => filterEntries(j.entries, f).map((e) => e.text);
  assert.deepEqual(texts({ since: '2026-10-01' }), ['b', 'c']);
  assert.deepEqual(texts({ until: '2026-10-01' }), ['a', 'b']);
  assert.deepEqual(texts({ tags: ['Backend'] }), ['a', 'c']);
  assert.deepEqual(texts({ project: 'billing' }), ['a']);
});

test('weekStart is Monday-based, across month and year boundaries', () => {
  assert.equal(weekStart('2026-10-14'), '2026-10-12'); // Wed → Mon
  assert.equal(weekStart('2026-10-12'), '2026-10-12'); // Mon
  assert.equal(weekStart('2026-10-18'), '2026-10-12'); // Sun
  assert.equal(weekStart('2026-11-01'), '2026-10-26'); // Sun 1 Nov → Oct week
  assert.equal(weekStart('2027-01-01'), '2026-12-28'); // Fri → previous year
  assert.equal(weekLabel('2026-12-28'), 'Week of Dec 28 – Jan 3');
});

test('groupByMonthWeek keeps a cross-month week under the month of its Monday', () => {
  const j = emptyJournal();
  addEntry(j, { text: 'oct-end', date: '2026-10-30' }, NOW);
  addEntry(j, { text: 'nov-first', date: '2026-11-01' }, NOW);
  addEntry(j, { text: 'nov-later', date: '2026-11-04' }, NOW);
  const groups = groupByMonthWeek(j.entries);
  assert.deepEqual(groups.map((m) => m.label), ['November 2026', 'October 2026']);
  assert.deepEqual(groups[1]!.weeks[0]!.entries.map((e) => e.text), ['oct-end', 'nov-first']);
  assert.deepEqual(groups[0]!.weeks[0]!.entries.map((e) => e.text), ['nov-later']);
});

test('journal markdown and markdown export render', () => {
  const j = emptyJournal();
  addEntry(j, { text: 'Built brag', impact: 'fun', project: 'brag', tags: 'tooling', links: 'https://example.com' }, NOW);
  const md = renderMarkdown(j.entries);
  assert.match(md, /## October 2026/);
  assert.match(md, /### Week of Oct 12 – Oct 18/);
  assert.match(md, /\*\*Built brag\*\*/);
  assert.doesNotMatch(md, /## Highlights/);

  const file = path.join(tmpDir(), 'out.md');
  exportMarkdown(j.entries, file, { title: 'Q4 Wins' });
  const out = fs.readFileSync(file, 'utf8');
  assert.match(out, /^# Q4 Wins$/m);
  assert.match(out, /_1 win · 1 project · Oct 14 2026 – Oct 14 2026_/);
  assert.doesNotMatch(out, /Auto-generated/);
  assert.match(out, /## Highlights[\s\S]*- \*\*brag\*\* — 1[\s\S]*- \*\*#tooling\*\* — 1/);

  exportMarkdown([], file);
  assert.match(fs.readFileSync(file, 'utf8'), /_No entries in this range._/);
});
