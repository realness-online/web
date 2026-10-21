# artifacts-prune

Stops `artifacts/` from growing without bound.

## Behavior

On `agent_settled`, runs `bin/artifacts-prune.js --apply --quiet` from the
harness root and notifies when it frees space. A missing script or a failed
run is ignored, so a prune never disturbs the session.

## What the script removes

`node_modules`, a build `dist` beside a `package.json`, `.git`, `.DS_Store`,
and numbered screenshot twins (`shot-4402.png` when `shot-4401.png` sits
beside it at the same size). When `artifacts/` is over 500 MB, it then
removes files oldest first until the total is under 500 MB. There is no
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
node bin/artifacts-prune.js               # dry run
node bin/artifacts-prune.js --apply       # delete
node bin/artifacts-prune.js --all         # ignore the 60-minute grace
node bin/artifacts-prune.js --age-minutes 0
```

## Setup

Registered with the other extensions in repo `package.json` under
`pi.extensions`.
