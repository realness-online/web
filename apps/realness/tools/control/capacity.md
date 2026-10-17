# Capacity preparation

For operators measuring one disposable halo. No deployment or provisioning is
part of this command. The older `tests/control/capacity.check.js` is unchanged.

## Offline check

From `apps/realness`:

```
npm run check:capacity -- --config tools/control/capacity.example.json
```

Omitting `--run` validates configuration without reading secrets, running the
sampler, or contacting a halo. Example numbers are test inputs, not approved
limits or current prices. Replace the owner, actual actor disk path, hourly
compute price, budget, and limits before approval.

## One test build

`capacity.live.example.json` prepares memory, CPU, real Pi, and leased-browser
cases with three repetitions. Its actor levels and prices are examples, not a
safe capacity claim. Calibrate the memory allocation against the measured guest
floor before selecting the final levels. The browser opens a server inside its
own actor, checks a unique page title, closes the browser session, and returns
its Chrome lease. Pi must produce the expected settled assistant reply.

Prepare a new standalone directory from the product root:

```
npm run check:capacity -- --config tools/control/capacity.live.example.json --prepare ../../artifacts/realness/capacity-build
```

Preparation reads no secret file and contacts no halo. It copies only the runner
sources, configuration, and referenced stdin sources. The directory contains an
npm entry and a SHA-256 file manifest. Existing output directories are refused.
Review the configuration before preparing; changing any bundled file requires
a new build. Copy this same directory to the disposable halo after local checks.
Its report and journal record the verified build ID when run with `--manifest`.

## Run sizes

Two runs answer two different questions, and the second one is hs-tap.

- `capacity.example.json` stops at 4 actors. Use it to check the workloads and
  the runner against a fresh halo before paying for a long run.
- `capacity.taps.example.json` walks 25, 50, 100, 150 and 200 actors on one halo.
  That is what proves the TAP ceiling (hs-tap): 200 actors on one halo with 200
  distinct addresses. 200 actors at 512 MiB each need about 100 GiB of memory, so
  this run wants a highmem machine, and the TAP count is the limit it is testing.

Halo size is a separate choice from the level count. `n2-standard-4` is 4 vCPU
and 16 GiB; `n2-standard-2` is 2 vCPU and 8 GiB, so it holds roughly half the
actors and costs roughly half. Actors are limited by memory, not by cores, so a
smaller machine buys money, not density. Measure the size you intend to run, and
see hs-d1 for what its price means against the monthly ceiling.

## Workload cases

- Memory: touch 256 MiB repeatedly for one second. Increase toward configured
  actor memory with enough space left for Node and Pi; an allocation failure
  fails the run. This default is not full-memory proof.
- CPU: sustained integer work for one second. Adjust duration and concurrency
  for representative load rather than saturation alone.
- Pi: the live example runs a real Pi child only after proxy credentials and a
  provider-side spending limit exist. Set `pi_reply: "ready"`; the runner checks the completed
  assistant reply and settled-agent event, using the acceptance rules from
  `tests/control/pi-exit.check.js`. Guest exit zero alone cannot pass this case.
- Browser: the live example uses the installed agent-browser wrapper to lease
  external Chrome and verify a page on its actor. Lease support and a reachable
  browser service are prerequisites. A
  local HTTP stub does not prove browser workload readiness.

A prepared Pi case uses these settings; its executable and model access still
need live verification:

```json
{
  "name": "pi",
  "argv": [
    "/usr/local/bin/realness",
    "--mode",
    "json",
    "--no-session",
    "--no-tools",
    "--no-skills",
    "--no-context-files",
    "Reply with exactly: ready"
  ],
  "cwd": "/realness",
  "pi_reply": "ready",
  "timeout_s": 125,
  "max_ms": 125000
}
```

Set `request_ms` above 125000 and recalculate the estimated cleanup budget.

The runner accepts explicit argv, cwd, timeout_s, max_ms, and optional stdin_file
relative to the config file. Source supplied through stdin is sent unchanged.
It does not interpret shell commands unless the configured argv names a shell.
Each level runs each case against every created actor with bounded concurrency.
Set `mixed: true` to rotate workload order across actors. Each actor runs one
case at a time; different actors can run different cases together. Set
`repetitions` for repeated rounds, up to 100. Sample counts include every round.
The report's `max_workload_overlap` counts distinct pending request types.
`max_guest_overlap` instead counts conservative guest-execution intervals.

The guest reports a monotonic workload duration D inside a request from S to E.
The shared interval from E - 0.99D to S + 0.99D is inside that execution, assuming
less than one percent clock-rate error. No guest wall-clock synchronization is
required. If transport overhead leaves no shared interval, it proves no overlap.
This measures workload lifetimes, including waits and cleanup, not CPU overlap.
Set `guest_evidence: true` on each case and `min_guest_overlap` on a mixed run to
refuse insufficient evidence. Missing guest durations or Linux memory readings
fail the run; pending requests alone cannot pass this check.

One actor or concurrency one cannot prove mixed load. The live example requires
two distinct executing workload types. Guest memory peaks produce an observed
rounded floor per level; they do not establish headroom. Repeated full-memory,
CPU, Pi, and browser cases remain required.
Results include sample count, p95, and maximum latency; these small samples do
not establish production p99 or a safe count. `safe_count` stays null.

## Safety

Run from the product root on the disposable Linux halo, with the loopback halo
API. The bundled sampler reads that machine's memory, CPU, and actor filesystem.
Using it on a laptop while testing a remote halo measures the wrong machine.
A remote sampler must be an explicit read-only command returning fresh JSON:
`memory_bytes`, `disk_bytes`, `cpu_fraction` (0 to 1).

Sampling runs before creation, between cases, and periodically during work.
Unknown resources, exceeded reserves, guest failures, slow replies, request
limits, duration limits, and interrupts stop new work. Keep enough memory reserve
for the next actor allocation; sampling cannot prevent every transient spike.
The CPU value averages a 100 ms window and can miss shorter spikes.

The budget check is an estimate for compute during the test plus per-actor
cleanup time. It does not cap model tokens, disk retention, setup time, or cloud
billing. An independent provider limit and external halo expiry are required
before a live run. Cleanup failure must never leave an unbounded paid halo.

## Live limits - not set by preparation

The plan permits n2-standard-4, $5 compute, $2 models, and two hours of halo
runtime. Before provisioning, confirm the actual hourly price and include setup,
workload deadlines, cleanup, and retained storage in the cost review.

- Use the existing `halo up <name> --expire=2h` provider-side deletion limit.
- Read back provider scheduling and attached-disk auto-delete settings.
- Set a dedicated provider model-key cap of $2 and read it back.
- Confirm the test identity has no existing actors or personal material.
- Save those provider responses under harness-root artifacts before the run.
- Keep the halo awake; do not park or restart it during measurement.

The runner cannot set or verify the provider model cap. A configuration budget
is only an estimate; it does not replace these external limits. Provisioning and
provider credential changes remain a separate approval step.

## Live run - not executed

Approve halo size, levels, workloads, latency thresholds, duration, memory/disk
reserves, model limits, hourly price, total budget, and external expiry first.
Prepare a dedicated test identity and a halo with no personal actors. Confirm
its seed and guest Node path. Keep the halo awake during the test; do not change
idle policy on a shared halo. Copy the operator files with the approved build.

After replacing example settings and preparing the build, run from that copied
build directory on the test halo. The manifest is checked before secrets or
workloads are read:

```
npm run check:capacity -- --config capacity.json --run --manifest manifest.json --secret-file /etc/realness/halo-pass-secret --journal /repository/artifacts/realness/capacity/run.jsonl
```

The journal path must be new and its parent must exist. It is created with mode 0600. Actor IDs are flushed after creation; secrets and workload output are not
written. SIGINT and SIGTERM attempt cleanup with independent request deadlines.
SIGKILL, process loss, and lost create responses need manual reconciliation.

## Actor memory and scaling

Memory measurement accepts a JSON array of named stages with explicit `argv`,
or the same full capacity configuration used for the run. Relative stdin files,
cwd, and timeout_s are preserved. The default timeout is 120 seconds; explicit
timeouts up to 1800 seconds use the same validator as capacity. The outer
request allows ten extra seconds. A workload must exit zero. Commands run in the actor, without shell parsing unless argv names
a shell. For an idle baseline, use an explicitly named `true` stage.

```
npm run realness -- development halo memory <actor> <halo> --stages=<file> --sample-ms=1000 --json
```

Samples run during each command and once after it. Rows retain the largest
observed halo and guest values independently, plus the sample count. The guest
peak determines the rounded floor; it is an observed minimum, not recommended
headroom. Sampling can miss brief peaks, and remote sampling takes time beyond
the configured interval. A failed command or invalid reading refuses a report.

Scaling accepts `--monthly-hours=N`, or `monthly_hours` in its input report.
Omitting both retains the conservative 730-hour nonstop estimate. Supply measured
or explicitly assumed running hours per halo, including wake and idle time.
The output is compute only; retained disks and other services cost extra.
The actor count must come from reviewed representative capacity evidence;
`safe_count: null` does not establish it.

```
npm run realness -- development halo scale --report=<file> --monthly-hours=100 --json
```

## Cleanup and acceptance

Set `verify_cleanup: true` to require an empty dedicated identity before
creation, then list its actors again after deletion. A successful DELETE is not
proof of absence. Remaining IDs or an unreadable listing fail the report.
The browser case passes only after both page verification and lease return.

The runner deletes only IDs it created, in reverse order. A failed create can
leave an unknown actor: `uncertain_create` requires listing actors belonging to
the dedicated test identity. Never retry creates automatically or delete by
an unrelated owner's identity. Failed deletions remain in `cleanup_failures`.

Use the approved operator commands to list actors and remove each remaining
test actor by exact ID. Then delete the named disposable halo through
`npm run realness -- development halo down <test-name> --delete`.
Record the actual attached disk names before teardown. After deletion, read
provider instance and disk inventories independently; both must confirm absence.
A permission or network error is unknown, not successful cleanup. Revoke the
dedicated model key and test credentials, and confirm browser leases are released. Guest child processes and leases need live
cleanup proof; the local fake halo cannot establish that behavior.

Keep the report and journal under the harness-root artifacts directory. A live
report needs repeated full-memory, CPU, Pi, and browser cases under overlap,
resource measurements, error counts, and verified cleanup before choosing a
safe actor count with spare capacity. hs-cap remains open until that evidence
exists.
