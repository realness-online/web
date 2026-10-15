---
name: project-tooling
description: Check a work project's existing scripts, ops helpers, and curated tooling notes before editing, diagnosing, testing, building, or deploying it. Read the project's .tooling.md (curated notes), package.json scripts, and scripts/ and tools/ dirs so you use the project's own tooling instead of guessing or reinventing. Use when about to work in apps/realness/frontend, work/seeq-app, apps/realness/tools/ops, work/decision-ontology, or any project under work/, or when the user reports a build/test/deploy/log problem in one of these projects.
metadata:
  check: "node scripts/find-scripts.js realness-skill-check > /dev/null"
  category: Tooling
  tags:
    - tooling
    - scripts
    - diagnose
    - deploy
    - project
---

# Project Tooling

Before working in a `work/<project>`, know what tooling it ships before you guess. The project's own scripts and helpers are the first thing to reach for when diagnosing, testing, building, or deploying.

## Do this first

In the project directory (`work/<project>`), check:

1. **`.tooling.md`** (if present) - curated notes. This is the highest-signal source: it names the high-value diagnostic commands and their usage, plus caveats a raw script list can't convey (e.g. "realness `check` is docs/`vp check`, not type checking").
2. **`package.json` scripts** - the full script list. Group by purpose (test / lint / type / build / deploy / logs / dev) when deciding what runs what.
3. **`scripts/` dir** - shell/JS helper scripts.
4. **`tools/` dir** - admin/ops data scripts (often need a service account or env var).

Prefer the project's existing `npm run ...` scripts over raw tooling or reinventing a command. Run from that project's directory.

## If a `.tooling.md` is missing

The scripts, `scripts/`, and `tools/` dirs are still authoritative - read `package.json` and list the dirs directly. Consider proposing a `.tooling.md` if the project has enough tooling that it would help future sessions.

## Across projects

For questions that span projects ("which ones can deploy?"), run `node <skill-dir>/scripts/find-scripts.js deploy`. It matches npm script names in every `work/` project and its subpackages, file names in `scripts/` and `tools/`, and lines of `.tooling.md`. With no pattern it lists script counts per project. For one project, the `project_tooling` tool is enough.

## Curated files known to exist

- `apps/realness/frontend/.tooling.md` - `vp` toolchain (`check`, `check:fix`), coverage and risk reports, rules tests, deploy verification.
- `apps/realness/tools/ops/.tooling.md` - proxy to the product's `functions/` + ops tools (`traffic`, `ads`).
- `apps/realness/.tooling.md` - the control/live split, the `webspace` CLI in `control/`, and the four directions.
