---
name: planning
description: >-
  Plan complex or creative work as a directed acyclic graph (DAG / mind-map)
  before executing, keeping the human as the decider at every gate. Use when a
  task branches, explodes like a mind map, or is a creative project - anything
  with parallel or dependent pieces a linear checklist would flatten. Produces
  an ordered, reviewable plan, checks in at each gate, then executes. Built from
  the Building an Advanced Agentic Harness article's Planner role, inverted so
  the harness plans and the human decides.
metadata:
  check: "node ../../bin/check-skills.js planning"
  category: Workflow
  tags:
    - planning
    - dag
    - mind-map
    - orchestration
    - human-in-the-loop
---

# Planning

If a plan is named, load it before asking questions.

Plan work as a directed acyclic graph before doing it. The agent proposes, you
approve, then execution runs. This skill never runs a crew solo.

## Roles

Five fixed names, used across this skill, AGENTS.md, and plan files:

1. **Explorer** - figure out what the task really is. Skip once the ask is clear.
2. **Planner** - shape branchy work into a DAG and stop at Gate 1. Trivial or
   linear work passes straight through.
3. **Worker** - run nodes in topological order.
4. **Critic** - verify each node, cheapest deterministic check first.
5. **Promoter** - decide if verified work is worth showing off; most is not.

No aliases like "research phase" or "promote step."

## When to use

Work that branches, rejoins, or has dependencies between pieces. Skip trivial or
linear tasks - planning has a cost.

## Core rule

Nodes are units of work, edges are dependencies. Build the graph, check in at
each gate, and never self-run the whole DAG.

## Process

### 1. Planner - build the DAG

For code work, read `soundness` before proposing the solution architecture.
Use its rules for module boundaries, data flow, dependencies, platform choices,
and verification. This skill owns work order and gates, not coding standards.

- One node per unit of work: id, one-line goal, effort (cheap/medium/expensive).
- Node ids lead the label (`a1`, `b3`), are unique in the file, and are never
  dropped - no range shorthand.
- Edges only where one node depends on another. No cycles - a cycle means the
  plan is muddled.
- Split anything that would become a paragraph to describe.
- One plan, one file, one DAG, whatever its size. Never split a plan.

### 2. Planner - render the DAG

**Use Mermaid**, so it renders in Obsidian, GitHub, and editors:

````
```mermaid
flowchart LR
  a["a research angle"] --> b["b pick sources"]
  b --> d["d assemble"]
  c["c draft section 1"] --> d
  d --> G{{"🚦 GATE 1<br/>shape approved"}}

  classDef gate fill:#7e531c,stroke:#dfad6d,color:#e1be89;
  classDef done fill:none,stroke:#525252,stroke-dasharray:3 3,color:#525252;
  classDef active fill:#356e6e,stroke:#74b9b9,color:#ecebe4;
  classDef blocked fill:#933237,stroke:#ed8b8b,color:#ecebe4;
  class G gate;
  class a done;
  class b active;
```
````

Node ids lead the label (`a1`, `b3`) so the table can refer to them. Gates use
the `{{...}}` hexagon and the `gate` classDef. Keep labels to a few words and put
effort in the table, not the graph.

Inside a mermaid fence, ASCII only: `-` for dashes, `"` for quotes, `...` for an
ellipsis, `-->` or `->` for an arrow. Prose keeps its wider characters.

Before showing a DAG in chat, run `bin/mermaid-fit.js <file>`. Pi's feed shows
the raw fence when a diagram is wider than the pane. Show a short-label copy in
chat until it passes; the plan file keeps its labels.

The four `classDef` lines are fixed. Copy the block above; do not invent fills.

**Status is color plus emoji**, so it reads in any renderer and in plain text:

| Status      | Emoji | classDef                |
| ----------- | ----- | ----------------------- |
| done        | ✅    | `done` (dimmed, dashed) |
| in progress | 🔄    | `active` (blue)         |
| blocked     | ⛔    | `blocked` (red)         |
| not started | none  | default                 |
| gate        | 🚦    | `gate` (amber)          |

The emoji leads the label (`"✅ a1 research angle"`) and matches the node's
`class` line. Update both as work moves. Finished work dims so the eye lands on
what is left.

**The node list dims too.** A finished row's id is struck through,
`| ~~a1~~ ✅ |`. Markdown renders that as `<del>`, so any viewer dims the
whole row with `tr:has(del) { opacity: 0.45 }` and GitHub shows it crossed
out. One line above the table names the legend.

ASCII only for a throwaway sketch that will never persist.

`bin/plan-shape.js` checks these rules and runs in `npm test`.

### Plan file shape

One order, every time. Text above the nodes does not get read.

```
# Title

<DAG>

## Nodes
<table>

## Notes
<who it is for, context, depends on>

### Decisions
### Open questions
```

- The DAG and the node table come first, directly under the title.
- `## Nodes` and `## Notes` are the only `##` headings, plus an optional
  `## Syncs` between them: the folders a task on this plan may touch, one
  per bullet. Everything else goes in one `## Notes` section, below the nodes.
- Decisions, open questions, definitions, gates, and verification are `###`
  subheads inside Notes.
- Every table id appears in the DAG, and every DAG id in the table.
- Explanatory graphics beside the work DAG sit between the DAG and `## Nodes`,
  each with a caption. They are not checked for size.
- A caption for a diagram stays beside its fence. The first diagram has none;
  the title carries it.
- Multiple diagrams: first is the work DAG, the rest follow with their captions,
  all above `## Nodes`.
- Nothing sits above the DAG except the title.

**Put the DAG in a plan file.** `<plans>/<plan>.md`, or a companion
`<plans>/<plan>.plan.md` if that file should stay pure spec. Read `<plans>` from
`brayness.plans` in `package.json`. One file per plan,
normally with one work DAG. A diagram that only explains may sit beside it.
Gate decisions land in Decisions as one-liners, nowhere else.

**A plan is active only while it sits in the plans folder.** The plan tools read
that folder alone. A plan filed outside it, such as in a vault Area, is parked:
the shape still counts, but it is not checked, not rendered, and not worked.
Move it back to the plans folder to resume it. The `vault` skill owns that
structure; this skill owns the file's shape.

**Every plan opens with a diagram**, even a rough one. Work that sequences gets
a DAG. Work that does not - a project log, a research note, a design draft -
gets a graphic that says the same thing: a timeline, a data flow, a stage list,
a map. Mark a rough one `Preliminary.` under the fence and build it from claims
the document already makes. Invent nothing to fill it in.

### 3. Planner - keep it readable

Word bloat is the nemesis. Judge every line: **does this change a decision, or
could the code say it?** If neither, cut it.

Write ideas, not explanations: one idea per line, seven to ten words where
possible. The reader knows what to do; no instructions addressed to them, no
hedges, no reasoning they did not ask for.

The opening line of Notes names who it is for: one sentence naming the target
customer, so every node can be judged against them.

Carries: decisions and what was rejected, one line each. Open questions, as
questions. What to do next and how to judge it. What the code cannot say -
gotchas that bite, why the thing exists at all.

Does not carry:

- A changelog. Git holds history. No dated "what changed" list, no gate log, no
  "approved on" section, no restating how the plan got here.
- Settled questions. Move the decision to Decisions and delete the question.
- Nodes a decision absorbed. When a branch is picked, the choosing node
  disappears and the choice stands alone.

Finished nodes stay, dimmed, until the human says to prune. Pruning removes
the node, its edges, its row, and any mention elsewhere. Never prune on your
own.

- A decision explained twice - as a bullet, then prose, then a rationale
  paragraph. Or a rejected option kept as its own paragraph.
- Restated docstrings or how a function works inside.
- Prose explaining a command.

Trim words on the way out of a session, not later. Say what you cut. See the
`readable` skill for the sentence-level pass.

### 4. Gate 1 - approve the shape

Present the rendered DAG and order. Ask one question: is the shape right? Only
topology counts - added, removed, or merged nodes, wrong dependencies, wrong
order. Wait for the go before executing. Revise and re-present if wrong. Record
the outcome as a Decisions line, not a gate log.

### 5. Worker - execute

Apply `soundness` when writing or changing code; add relevant specialist skills.
Production quality is part of each node, not a later cleanup phase.

Topological order, dependencies first, parallel where independent.

Plain execution is the default. A node that iterates toward a measurable target
runs as an autoresearch loop; there are no subagents.

### 6. Critic - verify

Apply the `critic` skill after each node or merge point. If a node changes the
shape of later work, stop and check in before the next gate.

### 7. Promoter - when it earns it

Triggers: a feature genuinely worth showing off, or docs good enough to show.
Channels are YouTube, TikTok, and `About.vue`; motion graphics preferred (see
`hyperframes`). Promoter nodes gate on the feature being verified, and the human
approves before it ships. Most nodes skip this.

### 8. Gate 2

Summarize what ran. Ask whether it meets the plan. Done is your call.

## Human in the loop

- Every gate pauses. No autonomous crew run.
- One question at a time; no question bombs.
- Explain stakes and options in plain words before any question form.
- A node that would change the shape mid-run means stop and re-present.
- Underspecified task? Ask before building the DAG, not after.

## Related

- `soundness` - default solution architecture and code quality rules.
- `critic` - the Critic role.
- `project-tooling` - read a project's scripts before planning work inside it.
- `skill-writer` - when a node needs a capability you lack: find an existing skill, or write one.
- `hyperframes` - motion graphics for the Promoter role.

## Source

- "Building an Advanced Agentic Harness" (data4sci, 2026-07-15), clipped to
  the vault at `Resources/Engineering/Tools/Building an Advanced Agentic Harness.md`.
- "The Harness Is the Thing" -
  <https://scott-fryxell.github.io/blog/the-harness-is-the-thing/>

## Plan conventions

- `plans/` is the project list; vault/Projects holds files (active), Areas holds parked.
- Projects builds, Areas learns; one subject can be both. Todo's is ignored.
- One plan file per plan, no companions; normally one work DAG per plan.
- Check companion plans before scoping nodes.
- Plan lines: seven to ten words; apply the rule during reviews.
- Skip what reference repos already teach. Labels beat pane fit.
- Independent nodes still run one at a time.
- Run `npm run plans` after plan edits.
