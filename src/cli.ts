#!/usr/bin/env node
import path from 'node:path';
import { Command } from 'commander';
import { load, save, exportsDir, journalPath } from './store.ts';
import {
  addEntry,
  updateEntry,
  removeEntry,
  findEntry,
  filterEntries,
  knownValues,
  toISODate,
  parseDate,
} from './entries.ts';
import { writeMarkdown, exportMarkdown } from './markdown.ts';
import { formatEntry, formatList, formatCounts } from './format.ts';
import { countBy, weekStart } from './group.ts';
import type { Entry, EntryFields, Filters, Journal } from './types.ts';

interface FilterOpts {
  since?: string;
  until?: string;
  tag?: string[];
  project?: string;
  week?: boolean;
  month?: boolean;
}

interface FieldOpts {
  text?: string;
  impact?: string;
  project?: string;
  tag?: string[];
  link?: string[];
  date?: string;
}

const collect = (value: string, previous: string[] = []) => previous.concat(value);

function commit(journal: Journal): void {
  save(journal);
  writeMarkdown(journal.entries);
}

function withFilters(cmd: Command): Command {
  return cmd
    .option('-s, --since <date>', 'only entries on/after date (YYYY-MM-DD, yesterday, 2w, ...)')
    .option('-u, --until <date>', 'only entries on/before date')
    .option('-t, --tag <tag>', 'only entries with this tag (repeatable)', collect)
    .option('-p, --project <name>', 'only entries for this project');
}

function filtersFrom(opts: FilterOpts): Filters {
  let since = opts.since;
  if (opts.week) since = weekStart(toISODate(new Date()));
  if (opts.month) since = toISODate(new Date()).slice(0, 8) + '01';
  return { since, until: opts.until, tags: opts.tag, project: opts.project };
}

function entryFieldOptions(cmd: Command): Command {
  return cmd
    .option('-i, --impact <text>', 'why it mattered / measurable result')
    .option('-p, --project <name>', 'project the win belongs to')
    .option('-t, --tag <tag>', 'tag (repeatable or comma-separated)', collect)
    .option('-l, --link <url>', 'related link (repeatable or comma-separated)', collect)
    .option('-d, --date <date>', 'date of the win (YYYY-MM-DD, yesterday, 3d); default today');
}

function fieldsFrom(opts: FieldOpts): EntryFields {
  return { text: opts.text, impact: opts.impact, project: opts.project, tags: opts.tag, links: opts.link, date: opts.date };
}

async function promptFields(journal: Journal, defaults: Partial<Entry> = {}): Promise<EntryFields> {
  const { input } = await import('@inquirer/prompts');
  const { tags, projects } = knownValues(journal.entries);
  const hint = (list: string[]) => (list.length ? ` (known: ${list.slice(0, 8).join(', ')})` : '');
  return {
    text: await input({ message: 'What did you do?', default: defaults.text, required: true }),
    impact: await input({ message: 'Impact (optional):', default: defaults.impact }),
    project: await input({ message: `Project (optional)${hint(projects)}:`, default: defaults.project }),
    tags: await input({ message: `Tags, comma-separated${hint(tags)}:`, default: defaults.tags?.join(', ') }),
    links: await input({ message: 'Links, comma-separated (optional):', default: defaults.links?.join(', ') }),
    date: await input({
      message: 'Date:',
      default: defaults.date || toISODate(new Date()),
      validate: (v) => {
        try {
          parseDate(v);
          return true;
        } catch (err) {
          return (err as Error).message;
        }
      },
    }),
  };
}

const program = new Command();
program
  .name('brag')
  .description('Log your wins from the terminal and export a brag journal to Markdown')
  .version('1.0.0');

entryFieldOptions(program.command('add').argument('[text...]', 'what you did'))
  .description('log a win')
  .action(async (words: string[], opts: FieldOpts) => {
    const journal = load();
    const text = words.join(' ').trim();
    const fields = text
      ? { ...fieldsFrom(opts), text }
      : await promptFields(journal, { impact: opts.impact, project: opts.project, tags: opts.tag, links: opts.link, date: opts.date });
    const entry = addEntry(journal, fields);
    commit(journal);
    console.log(`Logged 🎉\n${formatEntry(entry)}`);
  });

withFilters(program.command('list').alias('ls'))
  .description('show entries grouped by month and week')
  .option('-w, --week', 'only this week')
  .option('-m, --month', 'only this month')
  .action((opts: FilterOpts) => {
    const journal = load();
    console.log(formatList(filterEntries(journal.entries, filtersFrom(opts))));
  });

entryFieldOptions(program.command('edit').argument('<id>', 'entry id (prefix is fine)'))
  .option('-x, --text <text>', 'new entry text')
  .description('edit an entry (no flags = interactive)')
  .action(async (id: string, opts: FieldOpts) => {
    const journal = load();
    const entry = findEntry(journal, id);
    const flagged = (['text', 'impact', 'project', 'tag', 'link', 'date'] as const).some((k) => opts[k] !== undefined);
    const changes = flagged ? fieldsFrom(opts) : await promptFields(journal, entry);
    const updated = updateEntry(journal, entry.id, changes);
    commit(journal);
    console.log(`Updated\n${formatEntry(updated)}`);
  });

program
  .command('rm')
  .alias('remove')
  .argument('<id>', 'entry id (prefix is fine)')
  .option('-y, --yes', 'skip confirmation')
  .description('delete an entry')
  .action(async (id: string, opts: { yes?: boolean }) => {
    const journal = load();
    const entry = findEntry(journal, id);
    if (!opts.yes) {
      const { confirm } = await import('@inquirer/prompts');
      console.log(formatEntry(entry));
      if (!(await confirm({ message: 'Delete this entry?', default: false }))) return;
    }
    removeEntry(journal, entry.id);
    commit(journal);
    console.log(`Deleted ${entry.id}`);
  });

withFilters(program.command('export'))
  .description('export the journal to a Markdown file')
  .option('-o, --output <file>', 'output path (default: exports/brag-journal-<today>.md)')
  .option('--title <title>', 'document title', 'Brag Journal')
  .action((opts: FilterOpts & { output?: string; title: string }) => {
    const journal = load();
    const entries = filterEntries(journal.entries, filtersFrom(opts));
    const file = path.resolve(opts.output || path.join(exportsDir(), `brag-journal-${toISODate(new Date())}.md`));
    exportMarkdown(entries, file, { title: opts.title });
    console.log(`Exported ${entries.length} entries → ${file}`);
  });

withFilters(program.command('stats'))
  .description('counts per month, project and tag')
  .action((opts: FilterOpts) => {
    const entries = filterEntries(load().entries, filtersFrom(opts));
    console.log(`${entries.length} wins total\n`);
    const sections = [
      formatCounts('By month', countBy(entries, (e) => e.date.slice(0, 7)).sort((a, b) => b[0].localeCompare(a[0]))),
      formatCounts('By project', countBy(entries, (e) => e.project)),
      formatCounts('By tag', countBy(entries, (e) => e.tags), '#'),
    ].filter(Boolean);
    console.log(sections.join('\n\n'));
  });

program
  .command('where')
  .description('print where the journal is stored')
  .action(() => console.log(journalPath()));

program.parseAsync().catch((err: Error) => {
  if (err.name === 'ExitPromptError') process.exit(130); // Ctrl+C during a prompt
  console.error(`brag: ${err.message}`);
  process.exit(1);
});
