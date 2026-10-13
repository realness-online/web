# artifacts-prune

Stops `artifacts/` from growing without bound.

## Behavior

On `agent_settled`, runs `bin/artifacts-prune.js --apply --quiet` from the
harness root and notifies when it frees space. A missing script or a failed
run is ignored, so a prune never disturbs the session.

## What the script removes

`node_modules`, a build `dist` beside a `package.json`, `.git`, `.DS_Store`,
and numbered screenshot twins (`shot-4402.png` when `shot-4401.png` sits
beside it at the same size). Nothing outside `artifacts/` is touched, and
nothing newer than the grace age goes unless `--all` is passed.

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
