---
name: memory
description: "Store and retrieve durable learnings about how realness actually works - success patterns, failure modes, corrections, and next-time hints. Use before doing a task similar to a past one (check AGENTS.local.md Learnings first), and after a notable outcome or a user correction (append a general learning to AGENTS.local.md, which is injected into every session). Also runs the critical refinement loop: on a correction or repeated failure, prove it with evidence, note the root cause, and propose a fix to the skill/process at fault rather than mutating it directly."
metadata:
  check: "node ../../bin/checks/check-skills.js memory"
---

# Memory

Learnings are written to `AGENTS.local.md` (or
`AGENTS.md` for rules everyone must see). `AGENTS.local.md` is loaded into the
system prompt every session by the agents-local extension, so a lesson
written there is guaranteed to be in context next session - no on-demand
recall needed. The same extension syncs the `work/` project table in that
file from disk each session; edit descriptions there, not the row list. This separates it from the vault (your knowledge) and
from `AGENTS.md` (standing rules).

Only cross-cutting lessons learned from experience belong here. Standing
policies go in `AGENTS.md`; fix-specific trivia stays with the project. Keep `AGENTS.local.md` small - every line costs tokens
in every session.

## Write after a correction or outcome

A learning is only useful if it generalizes. Before writing, restate the
lesson without naming any project, product, tool flag, file, or service. If it
still guides a decision in unrelated work, it is a learning. If it falls apart
without those names, it is a fact; route it instead:

- Project fact (deploy flags, sync rules, test numbers) - that project's
  `.tooling.md`
- Skill or process fact (plan format, poster scripts) - that skill's `SKILL.md`,
  proposed as a diff
- Tool quirk (nvim, pi, agent-browser, npm) - the skill or notes for that tool

Write the general form, not the incident: "Kill test servers by PID" beats
"Kill realness vite on 5173". When several facts share one cause, write the
cause once.

If it passes, append a bullet under a `## Learnings` section in
`AGENTS.local.md`:

```markdown
## Learnings

- [the one general, reproducible lesson]
```

Keep every entry to 5-7 words - one hint, no reasoning, no date. A general rule
is true or false regardless of when it was learned. If the lesson should
guide every agent, put it in `AGENTS.md` instead - other harnesses read
that, not `AGENTS.local.md`.

Before appending, check for a duplicate. In `codemode`, ask Jev (provider
`openrouter`, id `~typesafe/jev-latest`) one `bool` question with the candidate
and the Learnings bullets as state: "Does an existing learning already say what
the candidate says?" Above about 0.8, sharpen that entry instead; a reworded
/tmp rule scored 0.95 and a new lesson 0.12.

## Read before you act

`AGENTS.local.md` is already in your system prompt every session - check it
before acting. If a past entry says a given approach failed, say so and take
the other route.

## Critical refinement loop

On a user correction or a repeated failure, work the loop:

1. Name the exact correction/failure.
2. Gather evidence: the user's words, the failing command/output, the file path.
3. Decide whether the fault is in a skill/process or was a one-off mistake.
4. If it points at a skill defect, propose the change as a diff to that skill's `SKILL.md` (in chat, or a file under `plans/` for bigger rewrites) and wait for a human to approve before editing the
   production skill.
5. Append the learning to `AGENTS.local.md` Learnings regardless.

The producer never grades its own homework: when reviewing your own work, reason from evidence and state what is wrong plainly.
