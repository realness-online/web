# Brayness webspace

Hosted actors. One host runs many microVM actors, all forked from one booted
snapshot. Each one is reachable three ways, idle in three tiers, and costs
nothing while it sleeps. The prod host is a VM in `realness-online`; this is the
code that builds it and serves it.

- `control/`: Node. The control plane: makes hosts exist, puts the code on them,
  takes them away. Reaches the live side only over its HTTP API. Run
  `node bin/webspace.js`. Its `scripts/` are the Mac and Lima build/run steps.
- `host/`: the actor API, exec, PTY, browser terminal, door (Node, standard
  library only). The live side: it runs on the host and owns actors. Its
  `scripts/` are the host syscalls, its `guest/` runs inside an actor, and its
  `clients/` are the host-shell tools. `cd control && npm run check:host` is its
  contract.
- `can/`: Node, no dependencies. `can()`, rights pages, and phone identity;
  every door imports it. `cd can && npm test`.
- `can-store/`: Node, no dependencies. Where the paths `can()` asks about live:
  one adapter per provider (`./disk`, `./gcs`), and a contract every adapter
  passes. `cd can-store && npm test`; `npm run test:gcs` hits a real bucket.
- `sync/`: Node. The sync service, the only holder of storage keys: phone token,
  then `can()`, then storage. `npm run dev` runs it locally on disk;
  `sync/scripts/deploy.sh` deploys it to Cloud Run in realness-development.
  `sync/bin/brayness-store.js` is a gsutil-like client: ls, cat, cp, rm, and
  two-way sync, all through the service. `login` signs in through Realness in
  your browser and keeps it in the macOS keychain; `TOKEN=` still wins.
  `sync/bin/brayness.js sync` syncs every plan's `## Syncs` folders both ways;
  paths inside a git repo are refused.
- Examples live in `brayness-examples`; actors download them with giget.
- `lima/fc-local.yaml`: the dev loop on this Mac.
- `dist/`: everything generated (the staged harness, boot and template check
  runs, drain logs). Ignored; a fresh clone is source only.

`control/` and `host/` are separate worlds and a test enforces it: the host must
not know the control plane exists, and control may only reach it through the
API. `cd control && npm test`.

## Starter ownership and updates

`control/scripts/ship-stage.sh` makes an allowlisted ship tree from Scott's
harness. The template puts that tree in `/brayness`; each actor then owns its
copy. Today this is a build path, not a versioned update service.

The planned starter will record its version and inspected file list. Brayness
will propose changes to `AGENTS.md`, selected skills, extensions, and required
configuration. `AGENTS.local.md`, the vault, `work/`, `artifacts/`, and Pi
history stay personal. Before an update replaces a managed file, it must compare
that file with the received starter; personal edits require review. Session
history can explain those edits but cannot prove that all edits went through Pi.

A person can decline updates or detach from guidance while keeping hosting and
sync. Export must let them take their harness and Pi history to another machine
or service. Portable model access and other runtime dependencies remain open
design work. Plans may move into the vault; current code still reads `plans/`.

See `plans/brayness.md` nodes k1-k4 for the decisions and unfinished work. Do
not treat the planned update and export paths as available commands.

## How one is used

Someone who will not run a setup script gets a working environment.

- In three ways: a browser page, an attached terminal, the API.
- Out two ways: served from the actor while it runs, or stored in sync and
  served from sync, reachable with nothing running.
- Idle three ways: a memory sleep, where programs resume; a disk sleep, where
  files come back and programs do not; or nothing at all, where the trace and
  artifacts come back into a fresh disk and the volume is gone.

## The four directions

All four run through `control/`, as `node control/bin/webspace.js <env> ...`.
Commands run on the Mac unless a step says otherwise.

| Direction          | Command               | What it does                             |
| ------------------ | --------------------- | ---------------------------------------- |
| Build the template | `dev build`           | stage the harness, build `template.ext4` |
| Run it locally     | `dev setup`, `dev up` | Lima guest, then volume + TAP + API      |
| Run a host         | `prod host up <name>` | create, bootstrap, check, serve          |
| Move actors        | `prod host drain`     | export every actor to GCS                |

The per-node proofs behind all four are archived with their runs in
`artifacts/firecracker/webspace-archive/`; the record sections in
[documentation.md](documentation.md) carry what each one proved.

## Build the template

The template is the Ubuntu 24.04 image every actor forks from: pi, git, node,
and the stock harness. Examples are not in the image: `/site` and `/app`
download them from `brayness-examples` and install their dependencies in the
actor.

```bash
node control/bin/webspace.js dev build
```

`ship-stage.sh` builds one allowlisted `dist/ship/` tree for the binary and
records the local `pi --version` there. The binary compiles that version for all
targets; `harness-stage.sh` tars the same version into
`dist/brayness-harness.tar.gz`; then `template-build.sh` fetches its inputs
(checksummed, cached in `/opt/fc`) and builds `/opt/fc/template.ext4` in the
guest. After a rebuild the seed is stale. A seed whose template, kernel, or
Firecracker fingerprint changed is not forked: `ensure_seed()` sees the mismatch
and rebuilds it on the next serve, so a missed rebuild cannot fork an old image.

Record in [documentation.md](documentation.md#what-is-proven): the template
rootfs (f3), and the capability it carries, an actor that builds a site (a1).

## Run it locally

Firecracker cannot run on macOS, so the dev loop is Lima: one aarch64 guest with
`/dev/kvm` and this directory mounted at `/mnt/fc`. Pinned: firecracker
`v1.17.0` (sha256 checked), kernel `vmlinux-6.1.155` and `ubuntu-24.04.squashfs`
from `firecracker-ci/v1.15/aarch64`; artifacts live in the guest at `/opt/fc`.

```bash
node control/bin/webspace.js dev setup   # once: Lima, firecracker, kernel, rootfs, boot check
node control/bin/webspace.js dev host up  # each time: volume, TAP, API; waits for the seed
```

- API `http://127.0.0.1:18080/v1/health`, terminal `http://127.0.0.1:18090/`
  (`/chat` on the same port), site sync `http://127.0.0.1:18096/`.
- `dev host down` stops it, `dev host restart` reloads the current code; a
  changed template fingerprint rebuilds the seed on the next serve.
- The log is `dist/dev-up.log`; the guest side is
  `control/scripts/dev-stack.sh`.
- `dev host up` waits for `seed.built`, not just for health: the API answers
  `ok` as soon as it is listening, before the seed exists, so waiting on `ok`
  reports a stack as up when it cannot make an actor.

Record in [documentation.md](documentation.md#what-is-proven): boot (f1),
network and a control channel (f2), snapshot and restore (f4), the actor-disk
mechanics (f5a-c, f6), and the API (r3a-r5) with idle tiers (r4) and the pages
an actor dirties (m1).

## Run a host

A host is a GCP VM in `realness-online` that boots the fleet image and serves
actors. Everything below runs from the Mac.

```bash
node control/bin/webspace.js prod host up brayness-2 --smoke    # create, bootstrap, check, serve
node control/bin/webspace.js prod host restart brayness-2       # push the current code, re-serve
node control/bin/webspace.js prod host down brayness-2          # park: stop, disks kept ($0.80/mo)
node control/bin/webspace.js prod host down brayness-2 --delete # drain actors, then delete ($0)
```

- The API is loopback-only; tunnel it with
  `gcloud compute ssh brayness-2 -- -N -L 8080:127.0.0.1:8080`, the terminal
  with 8090.
- `--delete` drains first and only deletes when every actor came back confirmed;
  `--no-drain` skips the export. The delete enumerates the disks the instance
  actually has. `disks[].source.basename()` returns the _instance_ name, so a
  delete loop built on it removes nothing and the actors volume keeps billing.
- `node control/bin/webspace.js prod probe` says which zone and machine type can
  create now (the default list is us-central1 a/b/c, us-west1 a/b, us-east1-b;
  it exits non-zero when none can).
- The idle guard stops the host when nothing has run for 30 minutes.

Record in [documentation.md](documentation.md#what-is-proven): the prod host
(d3), a host from the image and one that can be deleted (r8, r9), and the loop
on x86_64 (x1).

## Move actors

An actor's durable form is its export bundle: `artifacts.tar.gz` (its
`/brayness`), `trace.jsonl`, and a manifest with both hashes and the seed it
forked from. Bundles live in
`gs://realness-online-brayness/actors/<id>/bundle.tar.gz`.

```bash
# on a host, against its loopback API
curl -sS -X POST http://127.0.0.1:8080/v1/actors/<id>/export
curl -sS -X POST -H 'content-type: application/json' \
  -d '{"restore_from":"<id>"}' http://127.0.0.1:8080/v1/actors
```

The harness travels (it lives at `/brayness`, with its `work/`), and identity
does not: restoring one export twice is two actors with the same files and
different identities. Files come back, processes do not, and nothing replays a
command.

Record in [documentation.md](documentation.md#what-is-proven): export and
restore (r7), and the drain proof in (r8, r9).

## More

[documentation.md](documentation.md) holds the rest: the design decisions, what
each milestone proved with its commands, known costs, and the gotchas found
along the way.
