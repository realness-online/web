# Prewalk Extension

The frontier model shapes and gates a plan; a cheap model works its nodes.

Based on Can Bölük's "Prewalk Technique": the frontier model starts the work, then
a cheaper model finishes it in the same context, so nothing is read twice.

## How it works

1. `/planning <plan>` reads a plan in the plans folder. Prewalk reads it too.
2. With `- Gate 1: approved` in the plan and a node marked `active`, the next turn runs on
   the cheap model (`openrouter/deepseek/deepseek-v4.1-flash-1017`), told to run the node's spec after each change.
3. A failing spec sends that node back to the frontier model, told to find the cause.
   An error turn on the cheap model does the same, with a notice naming the error.
4. When the node leaves `active`, the next active node starts on the cheap model again.
5. No active node, as at a gate, means the frontier model.

Editing files on an approved plan with no active node gets one hidden reminder to mark the
node `active`. Plan changes made through bash are read too. A node that leaves `active`
without a passing spec raises a warning. Spec failures, model errors, and those
warnings are logged as items in `vault/Prewalk/escalations.html`. Each node leaving `active` adds
one outcome item there: status, models used, last spec result, and whether it escalated.

## Usage

| Command             | What it does                      |
| ------------------- | --------------------------------- |
| `/prewalk`          | Status: model, plan, active nodes |
| `/prewalk <target>` | Cheap model as `provider/id`      |
| `/prewalk off`      | Stay on the frontier model        |
| `/prewalk on`       | Resume routing                    |
