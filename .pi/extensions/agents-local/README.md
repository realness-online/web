# agents-local

Keeps the `work/` project table in the root `AGENTS.md` in sync with disk.

## Setup

1. Registered in repo `package.json` under `pi.extensions`.
2. The root `AGENTS.md` is personal and gitignored. When missing, it starts
   as a copy of `.pi/starter/AGENTS.md`.

## Behavior

On each session (`resources_discover`):

- Finds the harness root: the nearest folder holding `.pi/bin` and `work/`.
- Scans `work/` and rewrites the table between `<!-- agents-local:work-sync -->`
  markers in `AGENTS.md`.
- Preserves your description text for projects that still exist; adds new rows
  with README/package.json hints; drops removed directories.

Pi loads `AGENTS.md` itself; this extension adds nothing to the prompt.

### `/insert`

Splices `AGENTS.md` into `README.md` immediately before the last fenced
code block (the `npm start` command). Queues that combined document for the
next prompt only - replaces the default personal-context load for that turn.

Edit descriptions in the synced table freely. Do not hand-maintain the project
list - agents-local owns rows; you own the "What it is" column.
