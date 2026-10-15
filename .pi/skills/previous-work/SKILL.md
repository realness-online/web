---
name: previous-work
description: Search past agent sessions across all three harnesses (pi, Cursor, Claude Code) when asked about earlier work. Use when the user asks "what did we do about X", "did we already discuss/try/fix X", "find that earlier session", "review previous work", or when a task smells like a repeat of something already done. Knows where each tool stores its JSONL transcripts and how to search them without tripping over ignore files.
metadata:
  check: "node scripts/search-sessions.js realness-skill-check > /dev/null"
---

# Previous Work

Raw transcript archaeology across pi, Cursor, and Claude Code. For distilled
lessons, `AGENTS.local.md` Learnings is already in context (`memory`
skill) - check it first; only dig transcripts when you need what actually
happened.

## Ranked recall first

The `remember` tool (extension `extensions/memory/`) indexes pi's own sessions
into an FTS5 store, ~4 ms a query, newest turns re-indexed automatically. Use
it before `rg`:

- `remember` search "firecracker lima mac" - ranked turns with snippets, dates,
  and the session file to reopen. Tolerates typos; the last word also matches as
  a prefix. An exchange is one row, so a question and its answer surface
  together.
- `rg` is for raw archaeology: every occurrence, exact strings, and the Cursor
  and Claude Code stores, which the index does not cover.

The store is derived, never synced, and lives at `.pi/agent/memory.db`. If it
looks empty or stale, `remember` action `index` rebuilds it (about a second for
400 sessions).

## Where sessions live

`<slug>` is the harness folder's absolute path, `/` replaced by `-`: `home-ana-realness`
for Cursor, with a leading `-` for Claude Code.

| Agent       | Path                                                              | Shape                      |
| ----------- | ----------------------------------------------------------------- | -------------------------- |
| pi          | `.pi/agent/sessions/*.jsonl`                                      | timestamp + uuid filenames |
| Cursor      | `~/.cursor/projects/<slug>/agent-transcripts/<uuid>/<uuid>.jsonl` | one dir per chat           |
| Claude Code | `~/.claude/projects/-<slug>*/*.jsonl`                             | one store per cwd          |

Notes:

- Claude fragments by working directory: a `work/<project>` session lives in
  `-<slug>-work-<project>`. Stores under an old harness name hold early work.
- Cursor keeps one store per opened folder under `~/.cursor/projects/`;
  project windows under `work/` have their own.

## All stores at once

`node <skill-dir>/scripts/search-sessions.js "<exact string>"` searches
pi, Cursor, and Claude Code in parallel and prints the top 3 files per store
with a snippet (`--limit N`, `--recent`; it skips the running session). In
`codemode`, run it beside `remember` with `Promise.all`, then `read` only the
hits worth opening.

## How to search

pi sessions are hidden from rg by the repo `.ignore` (`sessions/` pattern) -
always pass `--no-ignore`:

```bash
rg --no-ignore -li 'search term' .pi/agent/sessions/
slug=$(pwd | sed 's|^/||; s|/|-|g')
rg -li 'search term' ~/.cursor/projects/$slug/agent-transcripts/
rg -li 'search term' ~/.claude/projects/-$slug*/
```

Then narrow inside a hit (JSONL, one message per line):

```bash
rg --no-ignore -i 'term' <file> | head -5     # locate lines
ls -t <dir> | head                             # most recent first
```

Filenames carry the date (pi) or check file mtime (Cursor/Claude) to order by
recency when the user says "yesterday" or "last week".

## Ground rules

- Transcripts contain secrets and personal info. Quote the minimum that
  answers the question, and leave it in the transcript otherwise.
- Cite where the answer came from (which store, which file, the date) so the
  user can reopen the session.
- Not found is a real answer: say which stores you searched and with what
  terms instead of guessing.
- Durable lessons discovered while digging go to `AGENTS.local.md` Learnings
  (`memory` skill) so the next search is unnecessary.
