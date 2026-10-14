# brag: a brag document CLI for your terminal

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node.js >= 22.18](https://img.shields.io/badge/node-%3E%3D22.18-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)

Log your wins at work in a few seconds from the terminal, then export them as a Markdown **brag document** when it's time for a performance review, a promotion case, a 1:1 or a CV update.

## Why keep a brag document?

By review time, most of what you did six months ago is forgotten. A brag document (also called a brag doc, brag journal, or work log) is a running list of your accomplishments and their impact. `brag` makes keeping one cheap enough to do every day:

- **Fast:** one command, no app to open, works offline.
- **Impact first:** every win can record *why it mattered*, not just what you did.
- **Organised:** entries are grouped by month and week, with projects and tags.
- **Ready to share:** export any date range to Markdown, with a Highlights summary by project and tag.
- **Yours:** plain JSON and Markdown files on your own machine, no account and no cloud.

## What it looks like

```console
$ brag add "Migrated the billing service to Postgres" -i "Cut p95 query latency from 800ms to 120ms" -p billing -t backend,performance
$ brag list
October 2026
 Week of Oct 12 – Oct 18
  e36b9e  Oct 12  Migrated the billing service to Postgres
                  ↳ Cut p95 query latency from 800ms to 120ms
                  billing  #backend #performance
  bf2c80  Oct 14  Mentored a new team member through their first release
                  onboarding  #leadership
```

`brag export --title "Q4 Wins"` produces:

```markdown
# Q4 Wins

_2 wins · 2 projects · Oct 12 2026 – Oct 14 2026_

## October 2026

### Week of Oct 12 – Oct 18

- **Migrated the billing service to Postgres** _(Oct 12)_
  - Impact: Cut p95 query latency from 800ms to 120ms
  - Project: billing · #backend #performance
- **Mentored a new team member through their first release** _(Oct 14)_
  - Project: onboarding · #leadership

## Highlights

### By project

- **billing** — 1
- **onboarding** — 1

### By tag

- **#backend** — 1
- **#leadership** — 1
- **#performance** — 1
```

## Requirements

- [Node.js](https://nodejs.org/) **22.18 or newer** (`node -v` to check)
- npm (ships with Node)
- git (to clone the repo)

## Setup

```sh
git clone https://github.com/umer279/brag-cli.git
cd brag-cli
npm install
npm link
```

`npm install` also compiles the TypeScript in `src/` to `dist/`. `npm link` then registers the `brag` command globally and points it at this folder, so you can run `brag` from any directory. After changing the code, run `npm run build` and the linked `brag` picks it up, with no relinking needed.

Check that it worked:

```sh
brag --help
brag where        # prints the path of your journal file
```

### Troubleshooting `npm link`

- **`brag: command not found`**: npm's global bin folder isn't on your `PATH`. Run `npm prefix -g` and add that folder (Windows) or its `bin/` subfolder (macOS/Linux) to `PATH`, then open a new terminal.
- **`EACCES` permission errors on macOS/Linux**: don't use `sudo`. Point npm at a user-owned prefix instead (`npm config set prefix ~/.npm-global`, then add `~/.npm-global/bin` to `PATH`), or use a Node version manager such as `nvm`.
- **PowerShell says running scripts is disabled**: run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or use `brag.cmd` / a different shell.

### Uninstall

```sh
npm unlink -g brag-cli
```

## Quick start

```sh
brag add "Shipped the new onboarding flow" -i "Signup conversion +12%" -p onboarding -t frontend
brag list
brag export
```

## Commands

| Command | What it does |
| --- | --- |
| `brag add [text]` | Log a win. With no text you get interactive prompts. |
| `brag list` (`ls`) | Show entries grouped by month, then week. |
| `brag edit <id>` | Edit an entry. With no flags you get interactive prompts. |
| `brag rm <id>` | Delete an entry (asks for confirmation; `-y` skips it). |
| `brag stats` | Counts per month, project and tag. |
| `brag export` | Write a Markdown brag document, including a Highlights section. |
| `brag where` | Print the path of the journal file. |

Run `brag <command> --help` for the full option list. IDs are shown by `brag list`, and any unique prefix of an ID works.

### Adding entries

```sh
brag add "Migrated the billing service to Postgres" \
  -i "Cut p95 query latency from 800ms to 120ms" \
  -p billing \
  -t backend,performance \
  -l https://github.com/org/repo/pull/42

brag add "Mentored a new team member" -d yesterday -t leadership
brag add                                 # interactive
```

| Option | Meaning |
| --- | --- |
| `-i, --impact <text>` | Why it mattered or what the measurable result was |
| `-p, --project <name>` | Project the win belongs to |
| `-t, --tag <tag>` | Tag(s), repeatable (`-t a -t b`) or comma-separated (`-t a,b`) |
| `-l, --link <url>` | Related link(s), repeatable or comma-separated |
| `-d, --date <date>` | Date of the win (defaults to today) |

`brag edit` accepts the same options, plus `-x, --text <text>` to change the entry text.

### Filtering (`list`, `stats`, `export`)

| Option | Meaning |
| --- | --- |
| `-s, --since <date>` | Only entries on or after this date |
| `-u, --until <date>` | Only entries on or before this date |
| `-t, --tag <tag>` | Only entries with this tag (repeatable) |
| `-p, --project <name>` | Only entries for this project |
| `-w, --week` / `-m, --month` | `list` only: this week / this month |

```sh
brag list --week
brag list -t backend -p billing
brag stats -s 2026-01-01
```

### Exporting

```sh
brag export                              # → exports/brag-journal-<today>.md
brag export -s 2026-07-01 -u 2026-09-30 -o ~/Desktop/Q3-wins.md --title "Q3 Wins"
```

### Date formats

Anywhere a date is accepted you can use `YYYY-MM-DD`, `today`, `yesterday`, or a relative offset like `3d` (3 days ago) or `2w` (2 weeks ago).

## Where your data lives

| Path | Purpose |
| --- | --- |
| `data/journal.json` | Source of truth. |
| `data/journal.md` | Human-readable journal, regenerated on every add/edit/rm. |
| `exports/` | Generated exports. |

Both folders are created on first use and are gitignored, so your entries stay on your machine.

Data is stored in this project folder no matter where you run `brag` from. To keep it somewhere else (for example a private repo or a synced folder), set `BRAG_HOME`:

```sh
# macOS/Linux (add to ~/.bashrc or ~/.zshrc)
export BRAG_HOME=~/Documents/brag

# Windows PowerShell (persistent)
[Environment]::SetEnvironmentVariable("BRAG_HOME", "$HOME\Documents\brag", "User")
```

## Development

The code is TypeScript, in `src/`. `src/cli.ts` is the command entry point and `test/` holds the tests.

```sh
npm run build       # compile src/ → dist/ (the linked `brag` runs dist/cli.js)
npm run typecheck   # type-check src/ and test/ without emitting
npm test            # typecheck, then run the tests
```

Tests use Node's built-in test runner (`node --test`) and run the `.ts` files directly through Node's type stripping, so they need no build step.

## License

[MIT](LICENSE)
