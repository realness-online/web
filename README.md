# Brayness webspace

Hosted actors. One host runs many microVM actors - forks of one booted
snapshot - and each one is reachable three ways, idle in three tiers, and costs
nothing while it sleeps. The prod host is a VM in `realness-online`; this is the
code that builds it and serves it.

- `control/` - Node. The control plane: makes hosts exist, puts the code on
  them, takes them away. Reaches the live side only over its HTTP API. Run
  `node bin/webspace.js`. Its `scripts/` are the Mac and Lima build/run steps.
- `host/` - the actor API, exec, PTY, browser terminal, door (Node, standard
  library only). The live side: it runs on the host and owns actors. Its
  `scripts/` are the host syscalls, its `guest/` runs inside an actor, and its
  `clients/` are the host-shell tools. `cd control && npm run check:host` is its
  contract.
- `can/` - Node, no dependencies. `can()`, rights pages, and phone identity;
  every door imports it. `cd can && npm test`.
- `can-store/` - Node, no dependencies. Where the paths `can()` asks about
  live: one adapter per provider (`./disk`, `./gcs`), and a contract every adapter
  passes. `cd can-store && npm test`; `npm run test:gcs` hits a real bucket.
- `sync/` - Node. The sync service, the only holder of storage keys: phone
  token, then `can()`, then storage. `npm run dev` runs it locally on disk;
  `sync/scripts/deploy.sh` deploys it to Cloud Run in realness-development.
  `sync/bin/brayness-store.js` is a gsutil-like client: ls, cat, cp, rm, and
  two-way sync, all through the service. `login` signs in through Realness
  in your browser and keeps it in the macOS keychain; `TOKEN=` still wins.
  `sync/bin/brayness.js sync` syncs every plan's `## Syncs` folders both
  ways; paths inside a git repo are refused.
- Examples live in `brayness-examples`; actors download them with giget.
- `lima/fc-local.yaml` - the dev loop on this Mac.
- `dist/` - everything generated: the staged harness, boot and template check
  runs, drain logs. Ignored; a fresh clone is source only.

`control/` and `host/` are separate worlds and a test enforces it: the
host must not know the control plane exists, and control may only reach
it through the API. `cd control && npm test`.

## Starter ownership and updates

`control/scripts/ship-stage.sh` makes an allowlisted ship tree from Scott's harness. The template puts that tree in `/brayness`; each actor then owns its copy. Today this is a build path, not a versioned update service.

The planned starter will record its version and inspected file list. Brayness will propose changes to `AGENTS.md`, selected skills, extensions, and required configuration. `AGENTS.local.md`, the vault, `work/`, `artifacts/`, and Pi history stay personal. Before an update replaces a managed file, it must compare that file with the received starter; personal edits require review. Session history can explain those edits but cannot prove that all edits went through Pi.

A person can decline updates or detach from guidance while keeping hosting and sync. Export must let them take their harness and Pi history to another machine or service. Portable model access and other runtime dependencies remain open design work. Plans may move into the vault; current code still reads `plans/`.

See `plans/brayness.md` nodes k1-k4 for the decisions and unfinished work. Do not treat the planned update and export paths as available commands.

## How one is used

Someone who will not run a setup script gets a working environment.

- In three ways: a browser page, an attached terminal, the API.
- Out two ways: served from the actor while it runs, or published to a host
  and reachable with nothing running.
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
`artifacts/firecracker/webspace-archive/`; the record sections below carry what
each one proved.

## Build the template

The template is the Ubuntu 24.04 image every actor forks from: pi, git, node,
and the stock harness. Examples are not in the image: `/site` and `/app` download
them from `brayness-examples` and install their dependencies in the actor.

```bash
node control/bin/webspace.js dev build
```

`ship-stage.sh` builds one allowlisted `dist/ship/` tree for the binary and
records the local `pi --version` there. The binary compiles that version for
all targets; `harness-stage.sh` tars the same version into
`dist/brayness-harness.tar.gz`; then
`template-build.sh` fetches its inputs (checksummed, cached in `/opt/fc`) and
builds `/opt/fc/template.ext4` in the guest. After a rebuild the seed is stale.
A seed whose template, kernel, or Firecracker fingerprint changed is not forked:
`ensure_seed()` sees the mismatch and rebuilds it on the next serve, so a missed
rebuild cannot fork an old image.

Record: the template rootfs (f3), and the capability it carries, an actor that
builds a site (a1).

## Run it locally

Firecracker cannot run on macOS, so the dev loop is Lima: one aarch64 guest with
`/dev/kvm` and this directory mounted at `/mnt/fc`. Pinned: firecracker
`v1.17.0` (sha256 checked), kernel `vmlinux-6.1.155` and
`ubuntu-24.04.squashfs` from `firecracker-ci/v1.15/aarch64`; artifacts live in
the guest at `/opt/fc`.

```bash
node control/bin/webspace.js dev setup   # once: Lima, firecracker, kernel, rootfs, boot check
node control/bin/webspace.js dev host up  # each time: volume, TAP, API; waits for the seed
```

- API `http://127.0.0.1:18080/v1/health`, terminal `http://127.0.0.1:18090/`.
- `dev host down` stops it, `dev host restart` reloads the current code; a
  changed template fingerprint rebuilds the seed on the next serve.
- The log is `dist/dev-up.log`; the guest side is `control/scripts/dev-stack.sh`.
- `dev host up` waits for `seed.built`, not just for health: the API answers `ok` as
  soon as it is listening, before the seed exists, so waiting on `ok` reports a
  stack as up when it cannot make an actor.

Record: boot (f1), network and a control channel (f2), snapshot and restore
(f4), the actor-disk mechanics (f5a-c, f6), and the API (r3a-r5) with idle
tiers (r4) and the pages an actor dirties (m1).

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
- `--delete` drains first and only deletes when every actor came back
  confirmed; `--no-drain` skips the export. The delete enumerates the disks the
  instance actually has - `disks[].source.basename()` returns the _instance_
  name, so a delete loop built on it removes nothing and the actors volume
  keeps billing.
- `node control/bin/webspace.js prod probe` says which zone and machine type
  can create now (the default list is us-central1 a/b/c, us-west1 a/b,
  us-east1-b; it exits non-zero when none can).
- The idle guard stops the host when nothing has run for 30 minutes.

Record: the prod host (d3), a host from the image and one that can be deleted
(r8, r9), and the loop on x86_64 (x1).

## Move actors

An actor's durable form is its export bundle: `artifacts.tar.gz` (its `/brayness`),
`trace.jsonl`, and a manifest with both hashes and the seed it forked from.
Bundles live in `gs://realness-online-brayness/actors/<id>/bundle.tar.gz`.

```bash
# on a host, against its loopback API
curl -sS -X POST http://127.0.0.1:8080/v1/actors/<id>/export
curl -sS -X POST -H 'content-type: application/json' \
  -d '{"restore_from":"<id>"}' http://127.0.0.1:8080/v1/actors
```

The harness travels - it lives at `/brayness`, with its `work/` - and
identity does not: restoring one export twice is two actors with the same
files and different identities. Files come back,
processes do not, and nothing replays a command.

Record: export and restore (r7), and the drain proof in (r8, r9).

## Decisions

Why the system is shaped this way. Rejected alternatives are named where they
were close.

- **Self-host Firecracker.** Boot once, snapshot, fork.
- **Nested virt on GCP.** Actors wait on model calls, so density comes from
  oversubscription; bare metal is priced for CPU this is not.
- **The prod host is a VM in `realness-online`**, the server project that already
  holds the brayness agent proxy. `realness-ops` is the server repo and
  `realness` the client repo; `realness-development` is the client's dev project.
- **The d3 host is `n2-standard-4` in `us-central1-a`** - a 20 GB `pd-standard`
  boot disk plus a 30 GB `pd-standard` PD for actors: about $0.20/h running,
  $0.80/mo parked. Spot is unavailable (`PREEMPTIBLE_CPUS` in us-central1 is 0)
  and nested virt rules out every cheap family (E2, all ARM, the memory-optimized
  M1/M2/M3, and every AMD but N4D).
- **The prod host idles stopped, itself.** `gcloud compute instances stop` keeps
  the boot disk, the xfs volume (`/etc/fstab` by UUID) and `/dev/kvm`; the disks
  are the only floor, $0.80/mo. A systemd timer checks every 5 minutes and stops
  the host after 30 with no `firecracker`, no `node host/main.js` and no
  interactive login; `/run/brayness-hold` (tmpfs) holds it open for work that is
  not a running VM. h3 folds host lifecycle into the host.
- **The artifact set is the actor's home directory and the trace is its event
  log** (r7). Files come back and processes do not, and nothing replays a
  command. A bundle is `artifacts.tar.gz` (of `/brayness`) plus `trace.jsonl` plus a
  manifest holding both sha256s, the identity the actor had, and the seed it
  forked from. The harness is in `/brayness`, so it travels; identity stays
  behind, so restoring one export twice is two actors with the same files and
  different identities.
  Bundles go to `gs://realness-online-brayness/actors/<id>/bundle.tar.gz`,
  moved by the control plane because the host has no credentials.
- **Idle holds no rented capacity.** An actor is its trace, its artifacts and
  its actors directory; the microVM disk and memory are caches that can be
  rebuilt. 30 GB-months of standard PD is free, so the actors volume sits
  inside the free tier; bytes that outgrow it go to GCS at $0.02/GiB-mo, first
  5 GiB free.
- **Idle per host is $0: a parked host has no disk.** A parked host is deleted
  and rebuilt from one shared image; the durable state is the actors' traces
  and artifacts in GCS. The guest has no credentials, so the delete comes from
  the control plane, never the host's own timer. Per-host provisioned disks are
  the whole bill at hundreds of hosts (20 GB standard is $0.80/mo each), and the
  30 GB-months allowance is shared and per account, so it does not scale. The
  fleet image exists: `brayness-host`, family `brayness-host`, 20 GB geometry. A
  stopped host is a 20 GB boot plus a 30 GB actors volume, both standard, and
  `host-down.sh --delete` returns it to nothing but the image.
- **A $20/mo Compute Engine budget on `realness-online`** alerts at 50/90/100%.
  Leaving the host up trips it in about four days.
- **The Lima loop is the dev loop; prod is x86_64.** Snapshots are
  per-architecture and pinned to the Firecracker data format, so arm64 proves the
  lifecycle only (x1).
- **ubuntu-base plus the CI kernel, not the CI rootfs** - the CI rootfs has an
  empty dpkg and is a boot fixture, not an actor image.
- **The host is ours, Node standard library**, in `host/`; rejected
  firecracker-go-sdk, Kata, and flintlock. It began as Python (`host/`,
  gone after h4b); `check:host` is the contract both passed.
- **Actors get a TAP and no NAT.** Egress is h2's.
- **The safe delete is the drain, and it ships before it deletes** (r9).
  `host-drain.sh <host> [--delete]` exports every actor, streams each bundle to
  `gs://<bucket>/actors/<id>/bundle.tar.gz`, checks the object the bucket
  stored against the bundle that was sent, drops the bundle from the volume, and
  only then deletes the instance together with the disks it actually has.
  Anything unconfirmed leaves the host up, and nothing schedules a drain yet.
- **What shipped is the bucket object, not a ledger.** No local record, so a
  re-run re-exports and re-uploads; an actor with no disk (a create that died
  mid-flight) is reported and skipped rather than blocking a delete forever.
- **The drain reaches the host over `gcloud compute ssh --command="curl ..."`** -
  the API is loopback-only until h1 exists, and a tunnel would cost a background
  process and a fixed local port per host to save a second a call.
- **The density branch is dropped.** m1 measured it: a restored actor dirties
  20-26 MiB of its 512 MiB. The win is density, and density is not the critical
  path - RAM binds, storage is the cheapest dimension. The measurement script is
  archived with the checks.

### Pi inside an actor

Gotchas that bit; carry them through the h4 port.

- A Pi tool allowlist is not a security boundary.
- Pi runs as a plain user; boot setup and the command runner stay root.
- System tools come baked in the template; actors never `apt install`.
- Egress is filtered on the host, where guest root cannot reach.
- The terminal page draws libghostty-vt on a canvas; the relay stays blind.
- Pi outlives the connection; a reload reattaches, never `/new`.
- `TMPDIR=/var/tmp` keeps jiti's cache; wipes skip it.
- Measure Pi readiness by key echo, never `-p`.
- Pi writes nothing before a reply: wipe its files, never its folder.

## What is proven

Counts are checks passed; the per-node sections below carry the commands and the
gotchas. The check scripts they name are archived in
`artifacts/firecracker/webspace-archive/` - these sections are the record, not a
runbook.

- f1 - a booted microVM reaches userspace
- f2 - network plus the vsock control channel - 10/10
- f3 - the template rootfs boots and runs pi offline - 19/19
- f4 - restore reseeds and comes up at snapshot time - 7/7
- f5a - a relative drive path follows the process cwd - 3/3
- f5b - xfs reflink clones instantly, sharing extents - 6/6
- f5c - two actors hold their own disk, TAP and socket - 8/8
- f6 - a clone starts fresh; identity is machine-id + actor id - 9+15
- r3a - create and destroy over HTTP - 29/29
- r3b - exec in a named actor - 24/24
- r3c - terminal, resize, exit code - 13/13
- r3d - the Mac drives it through Lima - 13/13
- r4 - idle tiers; workspace persists across a cold boot - 23/23
- r5 - browser terminal; page, websocket frames, real browser typing - 13/13,
  including a bare URL that makes its own actor and redirects to it
- d3 - GCP x86_64 host, nested virt, xfs actors volume, self-stopping idle
  guard - 6/6 + stop/start + a guest poweroff leaving it `TERMINATED` + the
  volume swapped to 30 GB standard with reflink green again
- x1 - the loop on x86_64: template 19/19, restore 7/7, actor over the API 11/11
- r7 - a destroyed actor comes back: export, destroy, restore, 24 checks on
  the host, then the same restore from a bundle that went to
  `gs://realness-online-brayness` and back byte for byte (13 + 11 checks), with
  the 3 MiB file intact and the new actor holding its own identity
- r8 - the host loop is one command each way: `host-up.sh brayness-2 --smoke`
  made a 20 GB host from the image and had it serving an actor in 2m50s (seed
  36s, smoke 5/5), and `host-down.sh brayness-2 --delete` took the host and its
  volume away. A deleted host leaves the image as the fleet's only standing cost
- r9 - a host is deleted with a live actor on it and the actor comes back: 20
  checks, run in us-west1-b because us-central1 had no n2 capacity. The drain
  exported the actor, put its 3 MB bundle in
  `gs://realness-online-brayness/actors/<id>/bundle.tar.gz` with a matching
  md5Hash, and took the instance and both disks away; `host-up.sh` built a host
  whose creation time is new and whose volume held none of it; the bundle came
  back, the 3 MiB payload hashed identically, the identity did not, and the trace
  opens with the drained actor's own events
- a1 - an actor with no network builds a site from its own markdown, renders
  and highlights it, and the site lands in the home directory an export bundles
  - 16/16
- a2 - the host takes that tree out of the running actor and serves it at
  `/s/<id>/`, a real browser loads it and draws the diagram, and the copy dies
  with the actor - 17/17 plus the browser

## Boot (f1)

One microVM, rootfs as its disk, `boot-check.sh` asserting the guest reached
userspace. The rootfs is the unpacked squashfs in a 2 GiB ext4: 1 GiB overflows,
and e2fsprogs 1.47 needs the size spelled out as a block count with `-d`.

## Network and a control channel (f2)

Two things an actor needs before anything else: a way out, and a way in that
is not the serial console.

**Out.** The host gets a tap on `172.16.0.0/30`, NAT'd to its uplink
(`net-up.sh`). Guest addressing comes from Firecracker CI's own
`fcnet-setup.sh`, which is already in the rootfs: it turns the MAC into an
address, so `06:00:AC:10:00:02` is `172.16.0.2/30`. That script is also all it
does - **no default route, no resolver**, so `brayness-net-up` adds both. The
gateway is the other address in the /30.

**In.** A vsock device (`guest_cid` 3) and a host-local unix socket. Firecracker
maps guest vsock ports 1:1 onto unix sockets: the host connects to `uds_path`,
writes `CONNECT 52\n`, reads `OK <port>\n`, and gets a byte stream to the guest's
listener. `brayness-vsock.service` runs `socat VSOCK-LISTEN:52,fork` in the
guest, handing each connection to `brayness-agent`, which takes one JSON request
per line (`argv`, `cwd`, `stdin_b64`) and answers with one
(`exit_code`, `stdout_b64`, `stderr_b64`). Base64 so binary output survives a
line-oriented channel; no shell, so `argv` is exec'd directly and an actor that
wants a shell asks for one.

`host/clients/vsock-exec.py` is the host-side client. It exits with the guest
command's own exit code, so shell composition works:

```bash
sudo python3 /mnt/fc/host/clients/vsock-exec.py --uds /tmp/f2-v.sock -- uname -r
```

Needs root: Firecracker creates the socket as root and the socket mode does not
let other users connect.

f2's checks all run _through_ the channel, so proving them proves the channel.
Two things are worth remembering from building it:

- `socat`'s `VSOCK-LISTEN` is why the guest needs no compiled agent.
- The guest gets no routable IPv6 (only link-local), so everything egresses over
  IPv4 and the NAT path. DNS answers AAAA first, which is why
  `options single-request-reopen` is in the resolver config: glibc otherwise
  asks A and AAAA in parallel and pays for the AAAA query that cannot work.

## The template rootfs (f3)

`template-build.sh` builds the image every actor forks from, from
`ubuntu-base` 24.04 plus the CI kernel: systemd, udev, node, pi, the stock
harness, and the guest-side network and vsock files. It installs nothing
personal and no way in (locked root, no sshd, empty machine-id).
`f3-verify.sh` boots a _copy_ of the result - so the golden image stays clean
for f4 to snapshot - and runs 18 checks through the vsock channel. Two boot
blockers came out of running it: `udev` is only a _Recommends_ of systemd, so
`--no-install-recommends` leaves no `/dev` management and the boot stalls 90s on
`dev-ttyS0.device`; and `python3-minimal` ships no `json`, so the vsock agent
dies on import and every check reads as a dead channel.

## Snapshot and restore (f4)

`f4-verify.sh` boots the template, pauses it, writes a full snapshot, and loads
that snapshot into two separate Firecracker processes. A clone is a process
with an API socket and no boot config - the snapshot is the config - and its
vsock `uds_path` is moved with `vsock_override` so it does not collide with the
original's socket. Two loads of one memory image are two forks: they must not
produce the same random bytes. Both clones are the same boot (`boot_id`), and
`/dev/urandom` differs between them, so resume reseeds. The device tree carries
a `vmgenid` node. The guest also resumes at snapshot time, so the host sets its
clock over the vsock channel - the mechanism an actor start will use.

Clones run one at a time. A snapshot is memory and device state, not disk, so a
clone opens the original's drive, and a TAP can only have one VM. Which is what
f5 is about.

## An actor disk is a directory (f5a)

A snapshot stores the drive's `path_on_host` as the string it was given, and a
relative path resolves against the process's working directory. `f5a` boots a
copy of the template with `rootfs.ext4`, snapshots it, then restores it from a
second directory holding a second disk. The clone opens that second disk and
its writes land there, not in the seed. So an actor is a directory with its own
`rootfs.ext4` and a Firecracker started in it - no jailer, no mount namespace.

## xfs and reflink (f5b)

On ext4 an actor disk is a real copy (1.8 GiB, ~2.5s). We build the prod host,
so its actors directory can be xfs, where `cp --reflink=always` clones the
disk instantly and shares the template's extents until the actor writes. `f5b`
mounts a loopback xfs and measures it: two clones in 3ms, no free-space change,
a write allocated only in the written clone. The dev loop mounts the loopback
xfs; prod formats the disk. Needs root.

## Two actors at once (f5c)

One boot and snapshot, two reflinked disks on a loopback xfs, and two
Firecracker processes started in their own directories. `network_overrides`
gives each clone its own TAP and `vsock_override` its own socket. Each opens its
own `rootfs.ext4`; a file written in one is invisible to the other. That is f5:
an actor is a directory plus a process. Needs root, and `net-up.sh` first.

The second clone keeps the template's MAC-derived address, so only the first is
NAT'd - per-actor addresses are r3/h2, not f5.

## An actor starts fresh (f6)

A snapshot is a fork of a booted machine, so a restored clone inherits the seed's
identity and the seed's boot writes. `f6a-audit.sh` measures that against the
template image as baseline: the image ships an empty machine-id, and the restored
clone resumes with one the seed's boot wrote, plus the seed's hostname, journal,
`/tmp` and random-seed file. `f6-verify.sh` then boots the template once, writes
two markers the seed owns, snapshots, forks a reflinked disk per actor with its
own TAP, and runs `brayness-actor-init <id> <epoch>` on each. Before init the
clones agree on machine-id; after, machine-id, hostname, journal and `/tmp` differ
or are cleared, the clock is now, and a second init with the same id changes
nothing - a disk-only reload is the same actor. Needs root (xfs, TAPs).
`boot_id` stays shared: it is the kernel's, not the actor's, and identity is
machine-id plus actor id.

`brayness-actor-init` is installed by the template builder and called by the
host over the f2 channel, which is the one call r3's actor API makes.

## The actor API (r3a)

`control/scripts/dev-stack.sh` is the dev host: an xfs loopback volume at `/opt/fc/actors`
(persistent across runs, `FRESH=1` to wipe), TAP0 and its NAT, and
`host/` serving HTTP on 8080. `scripts/r3a-verify.sh` drives the API with
curl and asks the guest over the f2 channel.

The host builds the seed itself - boot the
template, pause, snapshot - and records what it built from in `seed/seed.json`,
so a start with a mismatched kernel, template or Firecracker rebuilds and
`create` refuses a seed that does not match. In `host/src/`, `host.js` owns TAPs and the volume,
`firecracker.js` the unix-socket REST calls, `vsock.js` the guest channel,
`actors.js` the create/destroy cycle, `server.js` the routes:
`GET /v1/health`, `GET|POST /v1/actors`, `GET|DELETE /v1/actors/{id}`.

An actor is one directory - `rootfs.ext4` reflinked from the seed (f5b),
`api.sock`, `vsock.sock`, `actor.json`, `firecracker.log` - with that
directory as Firecracker's cwd, which is what makes the relative drive path in
the snapshot resolve to its own disk (f5a). Destroy kills the process, deletes
its TAP, and removes the directory. Actors get a TAP and no NAT: their egress
is h2's. Only the seed boots on TAP0's NAT.

```bash
limactl shell fc-local sh -c 'curl -sS http://127.0.0.1:8080/v1/health'
limactl shell fc-local sh -c 'curl -sS -X POST http://127.0.0.1:8080/v1/actors'
```

## Exec in an actor (r3b)

`POST /v1/actors/{id}/exec` takes `{"argv": [...], "cwd": "...",
"stdin_b64": "..."}` and answers `{"exit_code", "stdout_b64", "stderr_b64"}`.
It is the f2 channel addressed by actor id instead of socket path: the
host resolves the id to one directory and one `vsock.sock`, so there is
no route to another actor's disk. argv is exec'd, not shell-expanded (the
guest agent has no shell); a non-zero exit code is a 200, because the exec ran.
Output stays base64 so binary survives JSON.

The channel is `socat ... fork`, so two execs in one actor run at once, and a
long exec does not block create or destroy. `r3b-verify.sh` measures that with
two 4s sleeps finishing in under 7s. Exec is synchronous and bounded by the
API's `--api-timeout` (30s); the framed PTY (r3c) is where long interactive work
goes.

## A terminal (r3c)

`host/src/pty.js` listens on 8081 for a framed terminal stream, one TCP
connection per terminal. The client's first line is
`{"actor": "a-...", "cols": 80, "rows": 24}`; the server answers
`{"ok": true}` and then relays the guest agent's frames byte for byte:

    client -> server   {"op": "data", "data_b64": "..."}
                       {"op": "resize", "cols": 100, "rows": 30}
    server -> client   {"op": "data", "data_b64": "..."}
                       {"op": "exit", "code": 0}

The other end is `brayness-pty` (vsock port 53, socat fork per connection),
which runs `/bin/bash` on a `pty.fork()` slave and copies between the master and
the pipe. `TIOCSWINSZ` on the master is what makes a resize reach the shell. The
relay never parses a frame, so the protocol has one definition and the browser
websocket (r5) can speak the same one. `scripts/pty-client.py` drives it from
the shell; `r3c-verify.sh` uses it for every check.

That leaves VT state on the client, so r5 picks an engine. Undecided: xterm.js,
or libghostty-vt if we're feeling nasty - it parses better and renders nothing,
so a canvas, selection and scrollback come with it, against an API that warns it
is unstable.

The terminal is the connection: the client closing kills the shell, so a
reconnect is a new terminal. Nothing outlives the socket.

## From the Mac (r3d)

`scripts/r3d-verify.sh` runs on the Mac and drives create, exec and a PTY
through the forwarded ports, so the API is a real network service and not
something only reachable over `limactl shell`. `lima/fc-local.yaml` maps the
Mac's 18080 to the guest's 8080 and 18081 to 8081 - explicitly, because the
Mac's 8080 is often another service and Lima's automatic forward skips a taken
host port without saying so.

An instance created before the rule existed needs it applied and a restart:

    limactl stop fc-local
    limactl edit fc-local --tty=false --set '.portForwards = [{"guestPort":8080,"hostPort":18080},{"guestPort":8081,"hostPort":18081}]'
    limactl start fc-local
    # then sudo bash /mnt/fc/control/scripts/dev-stack.sh again

The seed and the actors volume live on the guest disk and survive the restart.

## Idle tiers and workspace persistence (r4)

`POST /v1/actors/{id}/idle` puts an actor down; `POST /v1/actors/{id}/reload`
brings it back, and exec and the terminal reload on their own, so callers never
see the tiers. `tier` is `memory` or `disk`:

- **memory** - pause, snapshot `state` + `mem` into the actor directory, kill
  the process. Reload restores it: the same boot, the same processes.
- **disk** - sync the guest, kill the process, keep only the disk. Reload boots
  the actor's own disk. Files and identity persist; processes do not.

A disk-tier reload does **not** load the seed's memory. That memory carries the
seed's mounted filesystem and its caches for a disk the actor has been
writing, so the guest reads the seed's stale view - a file just written under
`/brayness` was invisible while `/etc` was fine - and dropping the caches surfaces
an unclean ext4 journal (`Bad message`). Booting the disk replays the journal and
mounts what it is actually given.

Idle syncs the guest first. A write lands in the guest's page cache and reaches
the block device later; a memory resume hides that, a cold boot does not. r3a's
checks hid this by calling `sync` after every write by hand.

### The idle sweep (h3)

The host steps actors down on its own (`host/src/lifecycle.js`, run each
minute from `host/main.js`):

- running and quiet for 15 minutes -> memory
- idle for 2 hours -> disk
- stopped for 7 days -> export, then destroy once the bundle verifies

Activity is `last_activity` in `actor.json`, written at most once a minute by
exec and by a live terminal. An actor with no verified owner is never retired.
The export is checked (manifest and bundle agree) before the destroy; there is
no remote copy yet, so nothing leaves the host volume.

## A browser terminal (r5)

`host/src/webterm.js` serves a page on 8090 and upgrades `/pty?actor=<id>`
to a websocket, then bridges websocket messages to the framed terminal stream on 8081. The websocket is a transport in front of `pty.js`, not a second terminal;
a message is one of the same JSON frames, so the bridge is a line <-> message
pump.

The page is the terminal example, `brayness-examples/terminal`: Ghostty's
libghostty-vt as WebAssembly, drawn on a canvas, so pi's TUI draws as it does in
a native terminal. `control/scripts/terminal-build.sh` fetches it with giget,
builds it, and puts `dist/` at `host/term/` (gitignored), which ships with
the host code. The door redirects with
`&exec=brayness`, and the page sends that line on every connect, so a visitor
lands in a new Pi conversation in the same hosted actor. Pi's exit lands in
bash. Past conversations stay saved and searchable through `/remember` without
sending their full history to the model on refresh.

A bare `GET /` is the door: the page cannot make an actor itself, because the
API that creates one is on loopback and the browser would need that port open, so
`host/src/webterm.js` makes one in process and redirects to it with `?actor=` on the
URL. A refresh keeps that actor; a second bare URL makes a second one.

Sign-in is Realness's. A signed pass from sync is exchanged at `POST /auth` for
an HttpOnly, SameSite cookie (`host/src/terminal-auth.js`); the page and the
`/handoff` window need it, and each websocket needs a one-use, actor-bound
ticket from `POST /ticket`. The framed terminal on 8081 verifies the same pass
itself, so an actor id alone cannot attach to either.

Lima forwards 8090 to the Mac's 18090. `scripts/r5-verify.sh` runs on the Mac:
`ws-client.py` proves the frames, and agent-browser proves a real browser typing
makes the actor answer. It also checks the bare URL redirects to an actor that
exists.

## Export and restore (r7)

`POST /v1/actors/{id}/export` writes an actor out;
`POST /v1/actors {"restore_from": "<id>"}` lands it on a fresh disk.
`GET /v1/exports` lists the bundles and `GET /v1/actors/{id}/trace` reads a
actor's events.

A bundle is three files in the volume's `exports/<id>/`:

```
artifacts.tar.gz   the actor's harness and work (/brayness), gzipped
trace.jsonl        every event the host saw
manifest.json      sha256 and size of both, the identity it had, the seed it forked from
```

The trace is the record, not a script: nothing replays it. Events are appended as
they happen - `create`, `exec` (argv, cwd, exit code, duration, output sizes),
`idle`, `reload`, `export`, `restore`, `destroy` - to `traces/<id>.jsonl` on the
volume, which destroy does not remove. A restore copies the bundle's trace onto
the new actor ahead of its own `create`, so the trace of an actor that is gone
is the head of the trace that replaced it.

**What travels is `/brayness`, and that is the whole contract.** It holds the
harness, so harness edits, Pi transcripts, and `work/`
travel together. Identity (`/etc/machine-id`, the actor id) does not:
restoring an identity would make two actors share one. An actor that writes
outside `/brayness` is outside the contract, and `ARTIFACT_PATHS` in `host/src/actors.js`
is the one place that decides. Files come back; processes do not; nothing
replays.

The mechanism is a loop mount, not a channel into the guest. A stopped actor's
disk is a file on the actors volume, so the host mounts it, tars `/brayness`, and
unmounts - no size limit, no guest-side code, no credentials. Export stops the
actor first, because a live guest writes under the mount and mounting rw
replays its journal for it, and leaves it stopped; `reload` brings it back.
Restore is the same mount with the tar going the other way, and it costs two
boots: the fresh actor starts, stops for the files, and starts again. Two
restores of one export are two actors with the same files and different
identities.

`scripts/r7-verify.sh` is the check on the host - export, destroy, restore, 21 of
them - and `scripts/r7-gcs-verify.sh` runs the same thing from the Mac with a GCS
round trip in the middle, because the host has no credentials. The bundle is
deleted from the volume before the restore, so what comes back is what the bucket
held: `gs://realness-online-brayness/actors/<id>/bundle.tar.gz`, us-central1,
standard.

## How many pages an actor dirties (m1)

A memory idle writes the guest's whole 512MB to the volume whatever the actor
used. `m1-mem-compare.sh` (in the guest, as root, dev loop only) creates a
actor, runs one of three shapes of work, memory-idles it, and compares its
`mem` with the seed's 4KB at a time - identical to the seed, zero, or differing.
It measured 20-21 MiB dirty for an actor restored and idled with nothing done to
it, 24-26 MiB after light use, and 171 MiB with node holding 100 MiB (two runs).
So a sleep that stored the difference would write ~20-26 MiB instead of 512, while
the actor's own disk writes stay what caps density. `KEEP=1` leaves the actors
up. The branch is closed: the win is density, and RAM - not storage - is what caps
a host, so storing less per sleep does not buy an actor. The script stays as the
measurement.

## A host from the image, and one that can be deleted (r8, r9)

`host-up.sh <name>` makes a host from the fleet image: boot disk, instance with
nested virt and no service account, actors volume, then `host-bootstrap.sh` on
it (`--smoke` also runs `host-smoke.sh`). `host-down.sh <name>` stops it with its
disks; `--delete` takes the disks too and leaves the image as the only cost.

`host-down.sh --delete` does not ask what is on the host. `host-drain.sh <name>
[--delete]` does: it exports every actor, streams each bundle to
`gs://realness-online-brayness/actors/<id>/bundle.tar.gz`, checks what the
bucket stored against what was sent, drops the bundle from the volume, and only
then deletes the instance and the disks it actually has. It runs on the control
plane, not the host - the host has no credentials, so it cannot upload a bundle
or decide it is safe to die.

`r9-verify.sh` is the proof, on the Mac: build a host, write 3 MiB in an actor,
drain and delete the host, check the instance and both disks are gone, build a
_second_ host (different creation time, empty volume), land the bundle from the
bucket, restore, and check the payload hash matches, the identity does not, and
the drained actor's trace opens the trace that replaced it. 20 checks.
`probe-capacity.sh` answers which zone can make a host when `host-up.sh` reports
a stockout.

## The prod host (d3)

`brayness-1` in `realness-online` (us-central1-a, `n2-standard-4`, nested virt
on). Every command runs from here and reaches the host over gcloud; the account
is `sfryxell@gmail.com`. The host mirrors the Lima layout: `/opt/fc` holds the
artifacts and `/opt/fc/actors/mnt` is the xfs actors volume.

```bash
gcloud compute ssh brayness-1 --zone=us-central1-a --command='mkdir -p ~/brayness'
gcloud compute scp --zone=us-central1-a --recurse scripts src brayness-1:~/brayness

gcloud compute ssh brayness-1 --zone=us-central1-a --command='bash ~/brayness/scripts/d3-fetch-x86_64.sh'
gcloud compute ssh brayness-1 --zone=us-central1-a --command='ROOT=/opt/fc RUNS_DIR=/home/scott/brayness/runs bash ~/brayness/scripts/boot-check.sh'
gcloud compute ssh brayness-1 --zone=us-central1-a --command='sudo bash ~/brayness/scripts/actors-volume.sh'

gcloud compute instances stop brayness-1 --zone=us-central1-a     # manual stop
gcloud compute instances start brayness-1 --zone=us-central1-a
```

`d3-fetch-x86_64.sh` is `guest-setup.sh` with the x86_64 SHA pinned; the f3
scripts now pick their arch from `uname -m`, so both hosts share them.
`actors-volume.sh` formats the actors PD (once), mounts it by UUID, and
re-runs f5b's reflink checks against real storage: 6/6, two clones in 5ms, free
space up 8K. It is 30 GB `pd-standard` - inside the free tier - and reads at
350 MB/s sequential, fast enough to boot an actor from. Stop/start is verified:
the disks, the mount and `/dev/kvm` all come back.

`idle-guard.sh` installs the timer that stops the host when nothing is
happening: every 5 minutes, stop after 30 with no `firecracker`, no
`node host/main.js` and no interactive login. `gcloud compute ssh
--command` actors are `@notty` and do not count, so work that is not a running
VM has to hold it open:

```bash
sudo bash ~/brayness/host/scripts/idle-guard.sh
sudo touch /run/brayness-hold     # tmpfs; cleared by a boot
```

A guest `poweroff` does become `TERMINATED`: with the hold removed and the
host stopped, the timer stopped the host 2.5 minutes later, no API call
involved. Resume with `gcloud compute instances start brayness-1`.

### A host from the image

The family `brayness-host` bakes /opt/fc (pinned Node included), the scripts and
the idle guard into a 20 GB-geometry image, so a host is one command:

```bash
node control/bin/webspace.js prod host up brayness-2 --smoke
```

It creates the boot disk and the instance by name, waits for ssh, adds a 30 GB
actors volume, copies `host/`, and runs its `scripts/host-bootstrap.sh` on
the host: grow the root partition if it lags, `net-up.sh`,
`actors-volume.sh`, `idle-guard.sh`, then one state line per resource.
`--smoke` then runs
`host-smoke.sh`, which builds the seed, serves on loopback, creates an actor,
execs in it, destroys it, and checks the actor's machine-id is not the seed's.

Measured: **2m50s** from nothing to a host that serves an actor (the seed is
36s of that), and 5/5 on the smoke test. `webspace prod host down brayness-2
--delete` takes it back to the image and leaves no disk behind.

Bake a new image from a stopped host that has the change; the family serves the
newest, and older images stay for rollback:

```bash
gcloud compute images create brayness-host-v<N> --family brayness-host \
  --source-disk brayness-1-boot --source-disk-zone us-central1-a
```

v3 carries Node and a source tree with only `host/`; a fresh host from it
printed `node v22.23.3 present` at bootstrap. Delete older images once a new one
passes `--smoke`.

The image already carries a grown root partition, so `growpart` reports NOCHANGE
on a host built from it; 20 GB is the floor because an image cannot be smaller
than the disk it was taken from. `net-up.sh` has to run before the
host can build a seed, or `build_seed` stops with `no fc-tap0`.

## The loop on x86_64 (x1)

`scripts/x1-verify.sh` runs on `brayness-1` and proves the port end to end: the
template is x86_64, the seed forks, and an actor runs a command and a terminal.
The template build is arch-neutral now - `template-build.sh` fetches its own
inputs and picks amd64/x64 from `uname -m`, and the scripts resolve the repo
from their own path instead of `/mnt/fc`.

```bash
# on brayness-1, after d3
sudo bash ~/brayness/scripts/template-build.sh
bash ~/brayness/scripts/f3-verify.sh          # 19/19
sudo bash ~/brayness/scripts/f4-verify.sh     # 7/7, the x1 done-when
sudo node host/main.js serve --volume /opt/fc/actors/mnt &
bash ~/brayness/scripts/x1-verify.sh          # 11/11
```

Two bugs the arm64 runs had hidden, both teardown races: `f4-verify.sh` loads
the clone onto the snapshot's TAP before the base has released it (x86_64 lost
the race, `Resource busy` on `fc-tap0`), and `boot-lib.sh`'s EXIT trap ended on
a short-circuited `declare -F`, so a passing run exited 1. Both fixed for both
hosts.

## An actor builds a site (a1)

The `/site` prompt downloads the static example and builds it:

```bash
npx giget gh:scott-fryxell/brayness-examples/static site
cd site && npm install && npm run build
brayness publish dist
```

Articles are Markdown in `content/articles/`. The output is plain HTML with its
own scripts; a page with a diagram gets `scripts/mermaid.min.js` copied in.
`/app` does the same with the app example.

## Publish it at a URL (a2)

`POST /v1/actors/{id}/publish {"path": "/brayness/site"}` runs `tar` in the guest
over the exec channel, extracts it into `published/<id>/` on the volume with
tar's `data` filter, and serves it at `/s/<id>/`. The actor keeps running; the
copy dies with the actor, because the durable thing is the export bundle and
not the copy.

In the dev loop the URL is `http://127.0.0.1:18080/s/<id>/` - Lima forwards 18080
to the API port. Nothing is reachable from outside the machine yet; that is the
open 8090 question, and h1/h2. `scripts/a2-verify.sh` is 17 checks.

## Signing the binary

`app/build.sh`, `app/sign.sh`, `app/notarize.sh`. What each run taught:

- One binary is the app. macOS opens a bare executable in Terminal, so a
  launcher `.app` buys nothing; Terminal is the floor, Ghostty an upgrade.
- Notarization uses an App Store Connect API key (profile `brayness-notary`);
  the app-specific password returned 401 twice. The `.p8` must not move - the
  profile stores its path.

- A universal binary is 376 MB and the zip about 113 MB; both slices carry the
  whole runtime. First launch needs internet, because the notarization ticket
  cannot be stapled to a bare executable.
- A ticket is not served the moment it is accepted, and a machine fetches it on
  the first launch of a quarantined binary. That launch can still refuse while
  the lookup is in flight; wait and re-run. Both causes look the same on screen,
  and the dialog is what the check script's 25s alarm kills.
- The x86_64 slice needs `allow-unsigned-executable-memory` and
  `disable-executable-page-protection` beside `allow-jit`. With `allow-jit`
  alone it dies at `Check failed: 12 == (*__error())`, exit 133; arm64 is
  unaffected, so a broken Intel build passes every local run. A re-sign voids
  the ticket, so notarize again after any re-sign.
- Every refused launch carried a quarantine flag; the one that ran carried none.
  Whether a non-Safari flag (Brave writes `0281`) blocks the ticket lookup is
  untested.
- The Developer ID certificate is not enough on its own: the Apple G2
  intermediate CA must be in the keychain, or `security find-identity` reports
  no valid identity. It does not arrive with the certificate.
- Signing needs internet; the secure timestamp comes from Apple's server.
- `spctl --assess --type exec` cannot judge a bare executable. It reports
  "valid but does not seem to be an app" for a correctly signed and notarized
  binary, so the run is the verdict, not spctl.

## Known costs

Cost and design facts. Build and runtime gotchas are below.

- Memory per actor, measured on the dev host: 86MB restored and idle, 125MB
  with node running, 230MB with pi up. The 384MB this plan used to carry was
  never measured. Density is bounded by RAM: ~30 busy actors on a 4-vCPU/16GB
  host, more when they idle. The template carries ~1.0 GiB of `node_modules`,
  but reflink shares it, so it sets the seed's size and not each actor's.
- A memory sleep is a Full snapshot: 512MB on the volume every time, fully
  allocated, whatever the actor used (measured: one idle took the volume up
  exactly 512 MiB). An actor's own writes are ~160MB after two minutes of
  light work, and reflink shares the rest with the seed. So 30GB holds ~43
  memory sleeps, or ~180 disk sleeps. Storing is roughly ten times cheaper
  than resuming with programs alive, and neither is what runs out first.
- Idle is a tier, not a shutdown: the disk is the actor and memory is
  disposable. A memory idle restores; a disk idle boots the actor's own disk,
  so files and identity persist and processes are gone.
- The actors volume is 30 GB `pd-standard` and reads at 350 MB/s sequential,
  which is fast enough to boot an actor from, and reflink works on it (6/6, two
  clones in 5ms). That keeps the volume inside the free tier; only the boot disk
  bills.
- Parked cost, measured: 20 GB boot + 30 GB actors, standard, is $0.80/mo
  because the 30 GiB-months allowance is shared and per account; the fleet
  image adds $0.12/mo (2.35 GB compressed). 20 + 10 GB would fit inside the
  allowance and cost nothing, and deleting the disks (r8) makes it $0.

## Gotchas found here

- `probe-capacity.sh` took its candidates only from `$@`, so with no arguments it
  probed nothing and still printed its summary and exited 0 - a silent no-op
  that reads like a passing run. It now defaults to a candidate list and exits
  non-zero when none of them can make a host. Found while proving host-up.
- `us-central1-a` has no `n2-standard-4` capacity right now; a stockout refuses
  both `instances create` and `instances start`, so `brayness-1` cannot be woken
  and a new host has to go to `us-west1-b` or `us-east1-b` (probed, both OK).

- comark 0.4.0 moved `language` onto `<pre>` (`<pre language="js"><code
class="language-js">`), so a highlighter regex that expects `<pre><code`
  silently stops matching and code blocks render flat. The regex must also skip
  `mermaid` fences: shiki would replace the element the browser's setup script
  looks for, and the diagram source goes with it. `plans-server.cjs` and the
  skill's builder both carried the stale regex.
- The image is only as new as the staged tarball. `dev-build.sh` stages and
  builds it, then `dev-up.sh --fresh` reseeds. Run `template-build.sh` alone
  and an actor quietly runs the previous staged harness.
- A check script that writes markdown through a heredoc must quote the
  delimiter (`<<"EOF"`). Unquoted, bash runs the backticks in a fenced block as
  command substitution and the fences vanish from the file with no error.

- `iptables-nft` (Ubuntu 24.04) wants the table flag _before_ the command:
  `iptables -t nat -C ...` works, `iptables -C -t nat ...` dies with
  `Bad argument 'nat'`.
- `fcnet-setup.sh`, the MAC-to-address script `brayness-net-up` calls, is
  Firecracker CI's and is not in ubuntu-base. It is vendored in `host/guest/`
  rather than read out of `squashfs-root`, which is a leftover of the f1 fetch
  and may not exist on a fresh host.
- Run the tap and NAT setup with `sudo`; Firecracker here runs as root, so the
  tap needs no owner set.
- Don't mount `rootfs.ext4` while a VM has it open (`f2-provision-guest.sh`
  refuses). Adding guest files is a mount and a copy; f3 replaces this with a
  built template.
- A restored snapshot needs `vsock_override`, or two VMs collide on the same
  `uds_path`. Relevant to f4/f5.
- A resumed guest keeps `/run/machine-id`; `sd_id128_get_machine()` reads it
  first, so rewriting `/etc/machine-id` alone still reports the seed's.
- journald serves a deleted journal from memory. Wiping `/var/log/journal` is
  not enough - restart it, or the seed's entries return.
- bash `local a=... b="...$a..."` on one line under `set -u` fails as an unbound
  variable: declare, then assign on the next line.
- macOS bsdtar emits `._*` members from file xattrs, and `--exclude='._*'` does
  not filter what it synthesizes. The shipped template had `._models.json`
  beside `models.json` while the repo and the tarball had neither. The build
  purges `._*` and `.DS_Store` from the tree; `debugfs` on the image confirms.
- A sparse volume image bigger than the host's free space does not fail as
  `ENOSPC`: the write past the last backed block comes back as `EIO`, and
  Firecracker reports it as `Cannot perform sync_all on the memory backing file:
I/O error (os error 5)` in the middle of a snapshot. `dev-stack.sh` checks free
  space against `SIZE` before mounting. The guest's 20 GiB root disk is what
  actually limits this; finished work dirs (`/opt/fc/f5b`, `f5c`, `f6`) are
  scratch and 2G each.
- `firecracker --version` prints the version on the first line, then a
  timestamped exit banner. Capture both and a recorded version string changes on
  every call - which made the seed fingerprint mismatch and every start rebuild
  the seed. Take the first line.
- A socat listener's command line names the program it execs
  (`EXEC:/usr/local/bin/brayness-pty`), so `pgrep -f brayness-pty` always finds
  the listener. Evidence that counts agents must match the agent's own command
  line, e.g. `[p]ython3 /usr/local/bin/brayness-pty`.
- `vsock.connect` reads the handshake without `makefile()`: a buffered reader
  hides read-ahead from `select`, and the pty relay selects on the same socket
  it handshakes on.
- The guest's page cache is not the disk. Idle runs `sync` before dropping
  memory; a cold boot reads only what actually reached the disk.
- Do not load the seed's memory over an actor's disk. The seed's mount and its
  caches are stale for a disk the actor wrote; boot the actor's disk instead.
- `pid_for_api_sock` must match `--api-sock`, not `api-sock`. A bare-name match
  never fires, so every live actor reads as stopped.
- A web terminal needs a focused text field. Typing through CDP inserts text and
  fires `input`, not `keydown`, so the page reads printable input from `input`
  and only special keys from `keydown`.

- `cp --reflink=always` cannot cross a filesystem: cloning the seed from the
  ext4 boot disk fails with `Invalid cross-device link`. The seed has to live on
  the actors volume, which is also where the host keeps it (d3e).
- `pgrep -f "sshd: "` matches the always-running listener (`sshd: /usr/sbin/sshd
-D [listener] ...`), so an activity check written that way is always true; and
  `pgrep -f <pattern>` matches any argv containing the pattern, including the
  shell running the check. Match `@pts`, and bracket the first letter.
- A GCP disk's `deviceName` decides its `/dev/disk/by-id` path, and defaults to
  `persistent-disk-1` rather than the resource name. Create it with an explicit
  `--device-name=brayness-actors` or the path will not match the script.
  The name is per-instance, so every host can use the same one.
- `--zone` and `--project` are not accepted above a subcommand: `gcloud
--project=p --zone=z compute disks create` and `gcloud compute --zone=z disks
create` both die with `unrecognized arguments: --zone=z`. Pass them per call,
  or set `CLOUDSDK_COMPUTE_ZONE` and `CLOUDSDK_CORE_PROJECT`, which is what
  `host-up.sh` does.
- Piping a gcloud call to `tail -1` hides the reason it failed: the error's
  useful line is the first of four, and the last is always `gcloud help --
SEARCH_TERMS`. `tail -5` keeps the message.
- `pkill -f <pattern>` inside an ssh `--command` kills the shell running the ssh
  command, because that shell's own command line holds the pattern. It bites
  twice over: once plainly, and once when the same command also contains the text
  the pattern matches (a restart one-liner holds both the `pkill` and the
  `nohup ... serve`). Put it in a script and run it with `bash -s`
  (`host/scripts/host-restart.sh`) so the pattern is never on the remote command line.
- A killed Firecracker that is not reaped is a _zombie_, and a zombie is still a
  process named `firecracker` - which is what every leftover check and the idle
  guard count. One would hold a host awake forever. Reaping has to poll:
  `waitpid(pid, WNOHANG)` issued right after SIGKILL returns 0 while the process
  is still dying, and nothing else ever collects it. `host-smoke.sh` and
  `r7-verify.sh` both check for leftovers, which is how this was caught.
- The Python host ran as root and left root-owned `__pycache__` in the
  source tree, and the next `scp` of the code over it failed for the login user
  with `failed to upload directory`. Chown the tree before copying
  (`host-bootstrap.sh` does).
- A disk whose name collides with an instance's is attached rather than created:
  asking for a 20 GB boot disk while the 100 GB `brayness-1` still existed booted
  the instance from the 100 GB disk and reported success. Check `lsblk`.
- `gcloud compute instances detach-disk` rejects `--disk` and `--device-name`
  together, and a `&&` chain will happily run the next command anyway if you do
  not check the exit status.
- `realness-online`'s `default-allow-ssh` rule is open to `0.0.0.0/0`; key-only
  ssh is the only thing gating port 22 on the prod host.
- A `set -eu` script with an EXIT trap exits **0** when it dies on an unbound
  variable, and `$?` is already 0 inside the trap. Exit status is not evidence:
  have the script mark its own success and make the trap return non-zero without
  the mark. The unbound read that found this came from a helper setting a
  variable for a caller who wrote `x="$(helper)"` - a command substitution is a
  subshell, so echo the status and write the body to a file.
- bash 3.2, which macOS ships, expands every word of `local a="$1" b="$2"`
  before assigning any of them, so `b` cannot read what `a` was given.
- macOS Gatekeeper blocks the cloud SDK's `gcloud-crc32c` helper, so any `gcloud
storage` call needing a local crc32c fails. Compare a bundle with the object's
  `md5Hash` and `md5 -q file | xxd -r -p | base64` instead.
- `tar -czf - <id>` already holds that directory, so an extract into a directory
  of the same name nests everything twice. And the manifest's
  `artifacts.sha256` is for the `artifacts.tar.gz` _inside_ the archive, not the
  archive the stream makes - a fresh gzip is not byte-identical, so compare after
  extracting.
- Guest RNG comes from VMGenID on kernel >= 5.18; the wall clock needs VMClock or
  a manual `clock_settime` after restore. arm64 reseeds on the CI 6.1.155
  kernel, and x1 re-proves it per-kernel.
- A vsock device owns a host unix socket, one path per VM, and an actor's unix
  sockets must fit AF_UNIX's 108-byte limit - which is why the actors volume is
  mounted at the short `/opt/fc/actors/mnt`.
- Firecracker does no network filtering. Host egress rules are mandatory; the
  guest's own rules are not a boundary.
- Snapshot files are trusted, with no host-side protection.
- Replacing a disk leaves a second `/etc/fstab` line pointed at the same mount
  point. `actors-volume.sh` deletes other entries for the mount before adding
  its own.
- A stale seed forks an old kernel or pi silently. `create` refuses on the
  `seed.json` fingerprint instead - template size and mtime, kernel, firecracker,
  arch.
- Lima's automatic port-forward skips a guest port whose host number is taken,
  silently. The dev host's ports are explicit in `lima/fc-local.yaml` (18080 ->
  8080, 18081 -> 8081, 18090 -> 8090).
- A zone stocks out across machine types, not one of them, and a stockout also
  refuses to _start_ a parked host: us-central1 took nine refusals across four
  machine types while us-west1-b took the host. `scripts/probe-capacity.sh` asks
  each candidate for real, and r9 ran in us-west1-b for that reason. `host-up.sh`
  removes the boot disk it just made when a create fails - before that, one
  refusal left 20 GB billing unattached.
- The host's first serve on a fresh host builds the seed (~36s of boot)
  before the listener answers, so `host-restart.sh` waits three minutes, not one.

## Scope

This loop is arm64; the prod host is x86_64. It validates the VM lifecycle, the
network path, and the control channel. d3 carries the same work onto the prod
host, minus snapshots. Snapshots are per-architecture and pinned to the
Firecracker data format version, so the x86_64 boot-and-snapshot proof (x1) is
still required.

`jailer` (root for cgroups, namespaces, chroot) is not used yet. `--enable-pci`
is not passed, so virtio is on the legacy MMIO transport; PCI is faster for
block and net, and worth revisiting when r3 measures anything.

## Proven how

Every script was read and run for real on 2026-09-18; the checks now live in
`artifacts/firecracker/webspace-archive/scripts/`. `dev-build.sh` kept a prior
green run, and `net-down.sh` was read only. The one-page
walkthrough of what each command does, with what it proved, is
`artifacts/firecracker/webspace-command-map.md`; the run logs from the prod
walkthrough are in `artifacts/firecracker/probe-20260918/`:

- `dev-setup.sh` - booted a microVM (`dist/boot-<utc>/`, 473 serial
  lines, `PASS: guest reached userspace`)
- `dev-up.sh` - `--fresh` wiped the volume and rebuilt the seed; health `ok`
- `host-up.sh probe-brayness-2 --smoke --zone=us-west1-b` - host created,
  bootstrapped, 5/5 smoke, serving
- `host-drain.sh` and `host-down.sh --delete` - an actor with a 100 KB payload
  exported to `gs://realness-online-brayness/actors/a-2c3939d4a288/bundle.tar.gz`
  (103,375 bytes, md5 `pFK6XsalyMdOkOmpzOKTHQ==`), then the host and both its
  disks deleted; `gcloud compute instances list` back to `brayness-1` alone
- `probe-capacity.sh` - us-central1 a/b/c and us-west1-a: no n2-standard-4;
  us-west1-b and us-east1-b: OK
