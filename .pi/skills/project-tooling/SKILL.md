---
name: project-tooling
description: Check a work project's existing scripts and ops helpers before editing, diagnosing, testing, building, or deploying it. Read the project's package.json scripts and scripts/ and tools/ dirs so you use the project's own tooling instead of guessing or reinventing. Use when about to work in apps/realness, work/seeq-app, apps/realness/tools/ops, work/decision-ontology, or any project under work/, or when the user reports a build/test/deploy/log problem in one of these projects.
metadata:
  check: 'node scripts/find-scripts.js realness-skill-check > /dev/null'
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

1. **`package.json` scripts** - the full script list. Group by purpose (test / lint / type / build / deploy / logs / dev) when deciding what runs what.
2. **`scripts/` dir** - shell/JS helper scripts.
3. **`tools/` dir** - admin/ops data scripts (often need a service account or env var).

Prefer the project's existing `npm run ...` scripts over raw tooling or reinventing a command. Run from that project's directory.

## Warnings live in code

Notes files go stale. Put a caveat where it is enforced:

- A command's `--help` text, or a refusal when the input is unsafe.
- A `note` on a step in `.pi/bin/harness/steps.js`.
- A spec that fails when the rule breaks.

Do not write `.tooling.md` in this repo.

## Across projects

For questions that span projects ("which ones can deploy?"), run `node <skill-dir>/scripts/find-scripts.js deploy`. It matches npm script names in every `work/` project and its subpackages, file names in `scripts/` and `tools/`. With no pattern it lists script counts per project. For one project, the `project_tooling` tool is enough.
