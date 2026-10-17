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
- Pi: add an explicit command only after proxy credentials and a provider-side
  spending limit exist. Set `pi_reply: "ready"`; the runner checks the completed
  assistant reply and settled-agent event, using the acceptance rules from
  `tests/control/pi-exit.check.js`. Guest exit zero alone cannot pass this case.
- Browser: add a command that leases external Chrome and verifies a page on its
  actor. Lease support and a reachable browser service are prerequisites. A
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

## Live run - not executed

Approve halo size, levels, workloads, latency thresholds, duration, memory/disk
reserves, model limits, hourly price, total budget, and external expiry first.
Prepare a dedicated test identity and a halo with no personal actors. Confirm
its seed and guest Node path. Keep the halo awake during the test; do not change
idle policy on a shared halo. Copy the operator files with the approved build.

After replacing example settings, run on the test halo from the product root:

```
npm run check:capacity -- --config /approved/capacity.json --run --secret-file /etc/realness/halo-pass-secret --journal /repository/artifacts/realness/capacity/run.jsonl
```

The journal path must be new and its parent must exist. It is created with mode 0600. Actor IDs are flushed after creation; secrets and workload output are not
written. SIGINT and SIGTERM attempt cleanup with independent request deadlines.
SIGKILL, process loss, and lost create responses need manual reconciliation.

## Cleanup and acceptance

The runner deletes only IDs it created, in reverse order. A failed create can
leave an unknown actor: `uncertain_create` requires listing actors belonging to
the dedicated test identity. Never retry creates automatically or delete by
an unrelated owner's identity. Failed deletions remain in `cleanup_failures`.

Use the approved operator commands to list actors and remove each remaining
test actor by exact ID. Then delete the named disposable halo through
`npm run realness -- development halo down <test-name> --delete`.
Verify provider instances and disks are absent, revoke test credentials, and
confirm browser leases are released. Guest child processes and leases need live
cleanup proof; the local fake halo cannot establish that behavior.

Keep the report and journal under the harness-root artifacts directory. A live
report needs repeated full-memory, CPU, Pi, and browser cases under overlap,
resource measurements, error counts, and verified cleanup before choosing a
safe actor count with spare capacity. hs-cap remains open until that evidence
exists.
