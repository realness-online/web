# artifacts-prune

Stops `artifacts/` from growing without bound.

## Behavior

Pruning happens at check-in. `.pi/bin/hooks/post-commit` runs
`.pi/bin/harness/artifacts-prune.js --apply --quiet` after each commit and
prints what it freed; a failed prune never fails the commit. Build outputs
(WASM, the durable bundle, deploy staging) live under `artifacts/` too, so
nothing is deleted mid-session.

On `agent_settled`, the extension runs a dry run and, once per session, says
when `artifacts/` is over its cap and what the next commit will prune.

## What the script removes

A git checkout or worktree (a folder holding `.git`) is never touched. Elsewhere:
`node_modules`, a build `dist` beside a `package.json`, `.DS_Store`,
and numbered screenshot twins (`shot-4402.png` when `shot-4401.png` sits
beside it at the same size). When `artifacts/` is over 2 GB, it then
removes files oldest first until the total is under 2 GB. There is no
day limit. Empty folders remain. Files changed in the last 60 minutes are
kept.

A `.live` file containing a running process ID protects its folder and all
contents. Tools must create this marker to protect active work from cleanup.
Nothing outside `artifacts/` is touched. Session records are separate.

The script reports total file bytes, including protected folders. It warns
when the total is still above the cap after pruning, which means live or
recent data is holding the space. `--cap-mb N` changes the cap.

## Run it by hand

```sh
node .pi/bin/harness/artifacts-prune.js               # dry run
node .pi/bin/harness/artifacts-prune.js --apply       # delete
node .pi/bin/harness/artifacts-prune.js --all         # ignore the 60-minute grace
node .pi/bin/harness/artifacts-prune.js --age-minutes 0
```

## Setup

Registered with the other extensions in repo `package.json` under
`pi.extensions`.
