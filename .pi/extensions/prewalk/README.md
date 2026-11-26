# Prewalk Extension

The frontier model shapes a plan and works its first node; a cheap model takes
the rest.

Based on Can Bölük's "Prewalk Technique": the frontier model starts the work,
then a cheaper model finishes it in the same context, so nothing is read twice.

## How it works

1. `/planning <plan>` binds the session to that plan: its folder, its file, or the one
   plan whose name holds the word. A mistyped `/plan…` command binds the same way.
   Reading other plans never moves the session off it. With no `/planning`, the first
   plan the session edits, or reads while approved with an active node, is bound instead.
2. With `- Gate 1: approved` in the plan and a node marked `active`, the frontier
   works that node only: it sets the pattern, and nothing switches yet.
3. When that node's spec passes and it leaves `active`, the pattern counts as set.
   Every later active node runs on the cheap model
   (`openrouter/deepseek/deepseek-v4.1-flash-1017`), told to run the node's spec after each change.
4. A session on the cheap model stays there, since a switch back rewrites the whole cache.
   A failing spec or a cheap-model error tells the cheap model to stop and report, and
   asks Scott for `/prewalk next`. The failed node stays on the frontier model in later
   sessions until it finishes. Scott saying he is lost still switches back at once.
5. `/prewalk next` starts a fresh session on the model the plan needs. It names the plan
   and node, and gives the old session's id so the new one can use `remember`.
6. No active node, as at a gate, means the frontier model in a fresh session. Prewalk routes only the bound
   plan; active nodes in other plans are ignored. A new
   session whose plan log already holds a passing spec runs its nodes cheap.

Editing files on an approved plan with no active node gets one hidden reminder to mark the
node `active`. Plan changes made through bash are read too. A node that leaves `active`
without a passing spec raises a warning. Spec failures, model errors, and those
warnings are logged as items in `vault/Projects/realness-planning-performance/escalations.html`. Only the session that changed the plan logs it. Each node entering
`active` adds a start item with its model, so `npm run spend` can charge turns to that
node. Each node leaving `active` adds one outcome item: status, models used, last spec
result, and whether it escalated.

## Usage

| Command             | What it does                      |
| ------------------- | --------------------------------- |
| `/prewalk`          | Status: model, plan, active nodes |
| `/prewalk next`     | Fresh session on the right model  |
| `/prewalk <target>` | Cheap model as `provider/id`      |
| `/prewalk off`      | Stay on the frontier model        |
| `/prewalk on`       | Resume routing                    |
