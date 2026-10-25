# Realness webspace documentation

How the webspace is built and why. The [README](../README.md) covers what it is and
how to run it; this file holds the decisions, the record of what each milestone
proved, costs, and gotchas. Milestone codes like f3 or r7 are node ids; their
check scripts and runs are archived in
`artifacts/firecracker/webspace-archive/`.

## Decisions

Why the system is shaped this way. Rejected alternatives are named where they
were close.

- **Self-host Firecracker.** Boot once, snapshot, fork.
- **Nested virt on GCP.** Actors wait on model calls, so density comes from
  oversubscription; bare metal is priced for CPU this is not.
- **Each environment is one project.** Development halos, sync, proxy, sign-in,
  and storage share `realness-development`; production waits in
  `realness-online`. Early halos ran in `realness-online`; the proofs below say
  so where it matters.
- **Realness owns its proxy.** `realness-proxy` runs in `realness-development`
  beside `realness-sync`, sharing its phone pins; `realness-ops` keeps no agent
  handler and no `AGENT_PASS`.
- **The d3 halo is `n2-standard-4` in `us-central1-a`**: a 20 GB `pd-standard`
  boot disk plus a 30 GB `pd-standard` PD for actors: about
  $0.20/h running,
  $0.80/mo parked. Spot is unavailable (`PREEMPTIBLE_CPUS` in
  us-central1 is 0) and nested virt rules out every cheap family (E2, all ARM,
  the memory-optimized M1/M2/M3, and every AMD but N4D).
- **The prod halo idles stopped, itself.** `gcloud compute instances stop` keeps
  the boot disk, the xfs volume (`/etc/fstab` by UUID) and `/dev/kvm`; the disks
  are the only floor, $0.80/mo. A systemd timer checks every 5 minutes and stops
  the halo after 30 with no `firecracker`, no `node server/halo/main.js` and no
  interactive login; `/run/realness-hold` (tmpfs) holds it open for work that is
  not a running VM. h3 folds halo lifecycle into the halo.
- **The artifact set is the actor's home directory and the trace is its event
  log** (r7). Files come back and processes do not, and nothing replays a
  command. A bundle is `artifacts.tar.gz` (of `/realness`) plus `trace.jsonl`
  plus a manifest holding both sha256s, the identity the actor had, and the seed
  it forked from. The harness is in `/realness`, so it travels; identity stays
  behind, so restoring one export twice is two actors with the same files and
  different identities. Bundles go to the environment's bucket,
  `gs://realness-development-realness/actors/<id>/bundle.tar.gz`, moved by the
  control plane because the halo has no credentials.
- **Idle holds no rented capacity.** An actor is its trace, its artifacts and
  its actors directory; the microVM disk and memory are caches that can be
  rebuilt. 30 GB-months of standard PD is free, so the actors volume sits inside
  the free tier; bytes that outgrow it go to GCS at $0.02/GiB-mo, first 5 GiB
  free.
- **Idle per halo is
  $0: a parked halo has no disk.** A parked halo is deleted
  and rebuilt from one shared image; the durable state is the actors' traces and
  artifacts in GCS. The guest has no credentials, so the delete comes from the
  control plane, never the halo's own timer. Per-halo provisioned disks are the
  whole bill at hundreds of halos (20 GB standard is $0.80/mo
  each), and the 30 GB-months allowance is shared and per account, so it does
  not scale. The fleet image exists: `realness-halo`, family `realness-halo`, 20
  GB geometry. A stopped halo is a 20 GB boot plus a 30 GB actors volume, both
  standard, and `halo down --delete` returns it to nothing but the image.
- **A $20/mo Compute Engine budget on `realness-online`** alerts at 50/90/100%.
  Leaving the halo up trips it in about four days.
- **The Lima loop is the dev loop; prod is x86_64.** Snapshots are
  per-architecture and pinned to the Firecracker data format, so arm64 proves
  the lifecycle only (x1).
- **ubuntu-base plus the CI kernel, not the CI rootfs.** The CI rootfs has an
  empty dpkg and is a boot fixture, not an actor image.
- **The halo is ours, Node standard library**, in `server/halo/`; rejected
  firecracker-go-sdk, Kata, and flintlock. It began as Python (`server/halo/`, gone
  after h4b); `check:halo` is the contract both passed.
- **Actors get a TAP and no NAT.** Egress is h2's.
- **The safe delete is the drain, and it ships before it deletes** (r9).
  `halo drain <halo> [--delete]` exports every actor, streams each bundle to
  `gs://<bucket>/actors/<id>/bundle.tar.gz`, checks the object the bucket stored
  against the bundle that was sent, drops the bundle from the volume, and only
  then deletes the instance together with the disks it actually has. Anything
  unconfirmed leaves the halo up, and nothing schedules a drain yet.
- **What shipped is the bucket object, not a ledger.** No local record, so a
  re-run re-exports and re-uploads; an actor with no disk (a create that died
  mid-flight) is reported and skipped rather than blocking a delete forever.
- **The drain reaches the halo over `gcloud compute ssh --command="curl ..."`**:
  the API is loopback-only until h1 exists, and a tunnel would cost a background
  process and a fixed local port per halo to save a second a call.
- **The density branch is dropped.** m1 measured it: a restored actor dirties
  20-26 MiB of its 512 MiB. The win is density, and density is not the critical
  path. RAM binds, and storage is the cheapest dimension. The measurement script
  is archived with the checks.

### Pi inside an actor

Gotchas that bit; carry them through the h4 port.

- A Pi tool allowlist is not a security boundary.
- Pi runs as a plain user; boot setup and the command runner stay root.
- System tools come baked in the template; actors never `apt install`.
- Egress is filtered on the halo, where guest root cannot reach.
- The terminal page draws libghostty-vt on a canvas; the relay stays blind.
- Pi outlives the connection; a reload reattaches, never `/new`.
- `TMPDIR=/var/tmp` keeps jiti's cache; wipes skip it.
- Measure Pi readiness by key echo, never `-p`.
- Pi writes nothing before a reply: wipe its files, never its folder.

### Saved files, sync, and identity

- Sync carries Pi history and declared folders; other files may be lost.
- Turn-end order: history, files, pending list; each file lands old or new.
- Exact `edit` calls may defer; `write` and bash push bytes.
- Pending edits replay only onto the exact saved base.
- Pi JSONL alone never restores a lost working tree.
- Prove saved files on a fresh actor before deleting any disk:
  `check:fresh-actor`.
- Secrets never sync; the halo injects them.
- Actors read Realness-owned folders, never write or sync them.
- The halo pass is read-only, renews itself, may list paths.
- Sync is the only key holder; hosted actors cannot switch checks off.
- Sync merges Pi sessions entry by entry; other files changed on both sides keep both copies.
- Each folder has one writer: Realness or the harness.
- Each sync deploy trusts only its own project's sign-in.
- Phone numbers never appear in app URLs, logs, or referrers.
- Sync records are kept per server; switching servers starts fresh and sends no deletes.
- A delete keeps the file in `trash/people/+A/<day>/<time>/` (or `trash/orgs/+name/`, founder only) for 30 days. `realness trash` lists it; `realness restore <day/time/path>` puts it back and never overwrites.

## What is proven

Counts are checks passed; the per-node sections below carry the commands and the
gotchas. The check scripts they name are archived in
`artifacts/firecracker/webspace-archive/`. These sections are the record, not a
runbook.

- f1: a booted microVM reaches userspace
- f2: network plus the vsock control channel (10/10)
- f3: the template rootfs boots and runs pi offline (19/19)
- f4: restore reseeds and comes up at snapshot time (7/7)
- f5a: a relative drive path follows the process cwd (3/3)
- f5b: xfs reflink clones instantly, sharing extents (6/6)
- f5c: two actors hold their own disk, TAP and socket (8/8)
- f6: a clone starts fresh; identity is machine-id + actor id (9+15)
- r3a: create and destroy over HTTP (29/29)
- r3b: exec in a named actor (24/24)
- r3c: terminal, resize, exit code (13/13)
- r3d: the Mac drives it through Lima (13/13)
- r4: idle tiers; workspace persists across a cold boot (23/23)
- r5: browser terminal; page, websocket frames, real browser typing (13/13),
  including a bare URL that makes its own actor and redirects to it
- d3: GCP x86_64 halo, nested virt, xfs actors volume, self-stopping idle guard
  (6/6), plus stop/start + a guest poweroff leaving it `TERMINATED` + the volume
  swapped to 30 GB standard with reflink green again
- x1: the loop on x86_64, with template 19/19, restore 7/7, actor over the API
  11/11
- r7: a destroyed actor comes back: export, destroy, restore, 24 checks on the
  halo, then the same restore from a bundle that went to
  `gs://realness-online-realness` and back byte for byte (13 + 11 checks), with
  the 3 MiB file intact and the new actor holding its own identity
- r8: the halo loop is one command each way: `halo up realness-2 --smoke`
  made a 20 GB halo from the image and had it serving an actor in 2m50s (seed
  36s, smoke 5/5), and `halo down realness-2 --delete` took the halo and its
  volume away. A deleted halo leaves the image as the fleet's only standing cost
- r9: a halo is deleted with a live actor on it and the actor comes back: 20
  checks, run in us-west1-b because us-central1 had no n2 capacity. The drain
  exported the actor, put its 3 MB bundle in
  `gs://realness-online-realness/actors/<id>/bundle.tar.gz` with a matching
  md5Hash, and took the instance and both disks away; `halo up` built a halo
  whose creation time is new and whose volume held none of it; the bundle came
  back, the 3 MiB payload hashed identically, the identity did not, and the
  trace opens with the drained actor's own events
- a1: an actor with no network builds a site from its own markdown, renders and
  highlights it, and the site lands in the home directory an export bundles
  (16/16)
- a2: the halo takes that tree out of the running actor and serves it at
  `/s/<id>/`, a real browser loads it and draws the diagram (17/17 plus the
  browser). c1e moved the live site to sync, where the URL outlives the actor
- u2: a `fetch` handler runs in its own stripped VM. One `app-check.sh` run from
  a fresh image passed 12/12 steps: image 17/17, boot 7/7, escape 21/21, the
  `CONTROL=1` run seeing 3 holes, 96 and 64 MiB serving (37 and 6 MiB left), and
  the API, idle, and supervise checks green

### Boot (f1)

One microVM, rootfs as its disk, `boot-check.sh` asserting the guest reached
userspace. The rootfs is the unpacked squashfs in a 2 GiB ext4: 1 GiB overflows,
and e2fsprogs 1.47 needs the size spelled out as a block count with `-d`.

### Network and a control channel (f2)

Two things an actor needs before anything else: a way out, and a way in that is
not the serial console.

**Out.** The halo gets a tap on `172.16.0.0/30`, NAT'd to its uplink
(`net-up.sh`). Guest addressing comes from Firecracker CI's own
`fcnet-setup.sh`, which is already in the rootfs: it turns the MAC into an
address, so `06:00:AC:10:00:02` is `172.16.0.2/30`. That script is also all it
does - **no default route, no resolver**, so `realness-net-up` adds both. The
gateway is the other address in the /30.

**In.** A vsock device (`guest_cid` 3) and a halo-local unix socket. Firecracker
maps guest vsock ports 1:1 onto unix sockets: the halo connects to `uds_path`,
writes `CONNECT 52\n`, reads `OK <port>\n`, and gets a byte stream to the
guest's listener. `realness-vsock.service` runs `socat VSOCK-LISTEN:52,fork` in
the guest, handing each connection to `realness-agent`, which takes one JSON
request per line (`argv`, `cwd`, `stdin_b64`) and answers with one (`exit_code`,
`stdout_b64`, `stderr_b64`). Base64 so binary output survives a line-oriented
channel; no shell, so `argv` is exec'd directly and an actor that wants a shell
asks for one.

`server/halo/clients/vsock-exec.py` is the halo-side client. It exits with the guest
command's own exit code, so shell composition works:

```bash
sudo python3 /mnt/fc/server/halo/clients/vsock-exec.py --uds /tmp/f2-v.sock -- uname -r
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

### The template rootfs (f3)

`template-build.sh` builds the image every actor forks from, from `ubuntu-base`
24.04 plus the CI kernel: systemd, udev, node, pi, the stock harness, and the
guest-side network and vsock files. It installs nothing personal and no way in
(locked root, no sshd, empty machine-id). `f3-verify.sh` boots a _copy_ of the
result, so the golden image stays clean for f4 to snapshot, and runs 18 checks
through the vsock channel. Two boot blockers came out of running it: `udev` is
only a _Recommends_ of systemd, so `--no-install-recommends` leaves no `/dev`
management and the boot stalls 90s on `dev-ttyS0.device`; and `python3-minimal`
ships no `json`, so the vsock agent dies on import and every check reads as a
dead channel.

### Snapshot and restore (f4)

`f4-verify.sh` boots the template, pauses it, writes a full snapshot, and loads
that snapshot into two separate Firecracker processes. A clone is a process with
an API socket and no boot config (the snapshot is the config), and its vsock
`uds_path` is moved with `vsock_override` so it does not collide with the
original's socket. Two loads of one memory image are two forks: they must not
produce the same random bytes. Both clones are the same boot (`boot_id`), and
`/dev/urandom` differs between them, so resume reseeds. The device tree carries
a `vmgenid` node. The guest also resumes at snapshot time, so the halo sets its
clock over the vsock channel, the same mechanism an actor start will use.

Clones run one at a time. A snapshot is memory and device state, not disk, so a
clone opens the original's drive, and a TAP can only have one VM. Which is what
f5 is about.

### An actor disk is a directory (f5a)

A snapshot stores the drive's `path_on_host` as the string it was given, and a
relative path resolves against the process's working directory. `f5a` boots a
copy of the template with `rootfs.ext4`, snapshots it, then restores it from a
second directory holding a second disk. The clone opens that second disk and its
writes land there, not in the seed. So an actor is a directory with its own
`rootfs.ext4` and a Firecracker started in it, with no jailer and no mount
namespace.

### xfs and reflink (f5b)

On ext4 an actor disk is a real copy (1.8 GiB, ~2.5s). We build the prod halo,
so its actors directory can be xfs, where `cp --reflink=always` clones the disk
instantly and shares the template's extents until the actor writes. `f5b` mounts
a loopback xfs and measures it: two clones in 3ms, no free-space change, a write
allocated only in the written clone. The dev loop mounts the loopback xfs; prod
formats the disk. Needs root.

### Two actors at once (f5c)

One boot and snapshot, two reflinked disks on a loopback xfs, and two
Firecracker processes started in their own directories. `network_overrides`
gives each clone its own TAP and `vsock_override` its own socket. Each opens its
own `rootfs.ext4`; a file written in one is invisible to the other. That is f5:
an actor is a directory plus a process. Needs root, and `net-up.sh` first.

The second clone keeps the template's MAC-derived address, so only the first is
NAT'd. Per-actor addresses wait for r3/h2.

### An actor starts fresh (f6)

A snapshot is a fork of a booted machine, so a restored clone inherits the
seed's identity and the seed's boot writes. `f6a-audit.sh` measures that against
the template image as baseline: the image ships an empty machine-id, and the
restored clone resumes with one the seed's boot wrote, plus the seed's hostname,
journal, `/tmp` and random-seed file. `f6-verify.sh` then boots the template
once, writes two markers the seed owns, snapshots, forks a reflinked disk per
actor with its own TAP, and runs `realness-actor-init <id> <epoch>` on each.
Before init the clones agree on machine-id; after, machine-id, hostname, journal
and `/tmp` differ or are cleared, the clock is now, and a second init with the
same id changes nothing: a disk-only reload is the same actor. Needs root (xfs,
TAPs). `boot_id` stays shared: it is the kernel's, not the actor's, and identity
is machine-id plus actor id.

`realness-actor-init` is installed by the template builder and called by the
halo over the f2 channel, which is the one call r3's actor API makes.

### The actor API (r3a)

`tools/control/scripts/dev-stack.sh` is the dev halo: an xfs loopback volume at
`/opt/fc/actors` (persistent across runs, `FRESH=1` to wipe), TAP0 and its NAT,
and `server/halo/` serving HTTP on 8080. `scripts/r3a-verify.sh` drives the API with
curl and asks the guest over the f2 channel.

The halo builds the seed itself (boot the template, pause, snapshot) and records
what it built from in `seed/seed.json`, so a start with a mismatched kernel,
template or Firecracker rebuilds and `create` refuses a seed that does not
match. In `src/halo/`, `syscalls.js` owns TAPs and the volume, `firecracker.js` the
unix-socket REST calls, `vsock.js` the guest channel, `actors.js` the
create/destroy cycle, `server.js` the routes: `GET /v1/health`,
`GET|POST /v1/actors`, `GET|DELETE /v1/actors/{id}`.

An actor is one directory, holding `rootfs.ext4` reflinked from the seed (f5b),
`api.sock`, `vsock.sock`, `actor.json`, and `firecracker.log`, with that
directory as Firecracker's cwd, which is what makes the relative drive path in
the snapshot resolve to its own disk (f5a). Destroy kills the process, deletes
its TAP, and removes the directory. Actors get a TAP and no NAT: their egress is
h2's. Only the seed boots on TAP0's NAT.

```bash
limactl shell fc-local sh -c 'curl -sS http://127.0.0.1:8080/v1/health'
limactl shell fc-local sh -c 'curl -sS -X POST http://127.0.0.1:8080/v1/actors'
```

### Exec in an actor (r3b)

`POST /v1/actors/{id}/exec` takes
`{"argv": [...], "cwd": "...", "stdin_b64": "..."}` and answers
`{"exit_code", "stdout_b64", "stderr_b64"}`. It is the f2 channel addressed by
actor id instead of socket path: the halo resolves the id to one directory and
one `vsock.sock`, so there is no route to another actor's disk. argv is exec'd,
not shell-expanded (the guest agent has no shell); a non-zero exit code is a
200, because the exec ran. Output stays base64 so binary survives JSON.

The channel is `socat ... fork`, so two execs in one actor run at once, and a
long exec does not block create or destroy. `r3b-verify.sh` measures that with
two 4s sleeps finishing in under 7s. Exec is synchronous and bounded by the
API's `--api-timeout` (30s); the framed PTY (r3c) is where long interactive work
goes.

### A terminal (r3c)

`src/halo/pty.js` listens on 8081 for a framed terminal stream, one TCP
connection per terminal. The client's first line is
`{"actor": "a-...", "cols": 80, "rows": 24, "pass": "<halo pass>"}`. The pass is
the same five-minute bearer the API takes, so the pty is not a second door. The
server answers `{"ok": true}`, then relays the guest agent's frames byte for
byte:

    client -> server   {"op": "data", "data_b64": "..."}
                       {"op": "resize", "cols": 100, "rows": 30}
    server -> client   {"op": "data", "data_b64": "..."}
                       {"op": "exit", "code": 0}

The other end is `realness-pty` (vsock port 53, socat fork per connection),
which runs `/bin/bash` on a `pty.fork()` slave and copies between the master and
the pipe. `TIOCSWINSZ` on the master is what makes a resize reach the shell. The
relay never parses a frame, so the protocol has one definition and the browser
websocket (r5) can speak the same one. `server/halo/clients/login.js` is the shell
client: it mints a pass for one phone, creates an actor when none is named, and
releases it when the terminal exits (`KEEP=1` idles it instead). One command, no
browser:

```bash
node server/halo/clients/login.js --phone +14155550100
```

That leaves VT state on the client, so r5 picks an engine. Undecided: xterm.js,
or libghostty-vt if we're feeling nasty. It parses better and renders nothing,
so a canvas, selection and scrollback come with it, against an API that warns it
is unstable.

The terminal is the connection: the client closing kills the shell, so a
reconnect is a new terminal. Nothing outlives the socket.

### From the Mac (r3d)

`scripts/r3d-verify.sh` runs on the Mac and drives create, exec and a PTY
through the forwarded ports, so the API is a real network service and not
something only reachable over `limactl shell`. `server/lima/fc-local.yaml` maps the
Mac's 18080 to the guest's 8080, 18081 to 8081, and 18096 to 18096. It maps them
explicitly because the Mac's 8080 is often another service and Lima's automatic
forward skips a taken halo port without saying so.

An instance created before the rule existed needs it applied and a restart:

    limactl stop fc-local
    limactl edit fc-local --tty=false --set '.portForwards = [{"guestPort":8080,"hostPort":18080},{"guestPort":8081,"hostPort":18081},{"guestPort":18096,"hostPort":18096}]'
    limactl start fc-local
    # then sudo bash /mnt/fc/control/scripts/dev-stack.sh again

The seed and the actors volume live on the guest disk and survive the restart.

### Idle tiers and workspace persistence (r4)

`POST /v1/actors/{id}/idle` puts an actor down; `POST /v1/actors/{id}/reload`
brings it back, and exec and the terminal reload on their own, so callers never
see the tiers. `tier` is `memory` or `disk`:

- **memory**: pause, snapshot `state` + `mem` into the actor directory, kill the
  process. Reload restores it: the same boot, the same processes.
- **disk**: sync the guest, kill the process, keep only the disk. Reload boots
  the actor's own disk. Files and identity persist; processes do not.

A disk-tier reload does **not** load the seed's memory. That memory carries the
seed's mounted filesystem and its caches for a disk the actor has been writing,
so the guest reads the seed's stale view (a file just written under `/realness`
was invisible while `/etc` was fine), and dropping the caches surfaces an
unclean ext4 journal (`Bad message`). Booting the disk replays the journal and
mounts what it is actually given.

Idle syncs the guest first. A write lands in the guest's page cache and reaches
the block device later; a memory resume hides that, a cold boot does not. r3a's
checks hid this by calling `sync` after every write by hand.

#### The idle sweep (h3)

The halo steps actors down on its own (`src/halo/lifecycle.js`, run each minute
from `server/halo/main.js`):

- running and quiet for 15 minutes -> memory
- idle for 2 hours -> disk
- stopped for 7 days -> export, then destroy once the bundle verifies

Activity is `last_activity` in `actor.json`, written at most once a minute by
exec and by a live terminal. An actor with no verified owner is never retired.
The export is checked (manifest and bundle agree) before the destroy; there is
no remote copy yet, so nothing leaves the halo volume.

### The terminal and chat (r5, c1, x1)

Halos take no internet traffic and serve no pages. Realness serves the
terminal and chat; the gate (`src/gate/gate.js`) checks the Firebase
token, finds the person's halo, and carries:

- `/pty` websockets to the framed terminal on 8081, under a short halo pass.
- `/v1/actors/<id>/chat/{message,events,limit}` to the halo API.

The framed terminal and the API each verify the pass and the actor's owner,
so an actor id alone cannot attach or send. The terminal page is the example
`tools/examples/terminal`: Ghostty's libghostty-vt as WebAssembly on a canvas.

### A halo restart and a woken actor (x4)

A halo restart drops every actor TAP. A woken actor keeps its TAP name, because
its address is baked in, so reload rebuilds that TAP with its gateway first;
otherwise Firecracker opens a bare one and the actor has no network. A TAP held
by another running actor refuses the reload.

### Sites and admin (a1j)

Pi runs with the guest prompt `server/halo/guest/realness-chat.md`. It keeps editable
site source under `/realness/work/site`, publishes with `realness publish`, and
lists, restores, or removes with `realness-site versions|restore|remove`.
Published sites live in sync, so the URL outlives the actor (see "Publish it at
a URL").

Loops: a halo mirrors `loops/<id>/record.html` to Storage. `/admin` on the
Realness frontend lists every loop across halos; a stop is a Storage write at
`loops/<id>/stop.html` that the halo obeys on its next 30-second probe. Sync
serves the view, and `can()` admits only the admins named in `admins.html`.
Each bucket needs its own `admins.html`; without it admin login fails with 403.
Manage it with `npm run webspace -- <env> admins list|add <phone> [name]|remove <phone>`;
changes are a dry run until `--yes`, writes fail if someone else edited the
list first, and the last admin cannot be removed. Sync picks changes up within
30 seconds.
Sync answers every error `no-store`, so Hosting never keeps a site's 404 past
its first publish.

### Export and restore (r7)

`POST /v1/actors/{id}/export` writes an actor out;
`POST /v1/actors {"restore_from": "<id>"}` lands it on a fresh disk.
`GET /v1/exports` lists the bundles and `GET /v1/actors/{id}/trace` reads a
actor's events.

A bundle is three files in the volume's `exports/<id>/`:

```
artifacts.tar.gz   the actor's harness and work (/realness), gzipped
trace.jsonl        every event the halo saw
manifest.json      sha256 and size of both, the identity it had, the seed it forked from
```

The trace is the record, not a script: nothing replays it. Events are appended
as they happen (`create`, `exec` (argv, cwd, exit code, duration, output sizes),
`idle`, `reload`, `export`, `restore`, `destroy`) to `traces/<id>.jsonl` on the
volume, which destroy does not remove. A restore copies the bundle's trace onto
the new actor ahead of its own `create`, so the trace of an actor that is gone
is the head of the trace that replaced it.

**What travels is `/realness`, and that is the whole contract.** It holds the
harness, so harness edits, Pi transcripts, and `work/` travel together. Identity
(`/etc/machine-id`, the actor id) does not: restoring an identity would make two
actors share one. An actor that writes outside `/realness` is outside the
contract, and `ARTIFACT_PATHS` in `src/halo/actors.js` is the one place that
decides. Files come back; processes do not; nothing replays.

The mechanism is a loop mount, not a channel into the guest. A stopped actor's
disk is a file on the actors volume, so the halo mounts it, tars `/realness`,
and unmounts, with no size limit, no guest-side code, and no credentials. Export
stops the actor first, because a live guest writes under the mount and mounting
rw replays its journal for it, and leaves it stopped; `reload` brings it back.
Restore is the same mount with the tar going the other way, and it costs two
boots: the fresh actor starts, stops for the files, and starts again. Two
restores of one export are two actors with the same files and different
identities.

`scripts/r7-verify.sh` is the check on the halo (export, destroy, restore, 21
checks), and `scripts/r7-gcs-verify.sh` runs the same thing from the Mac with a
GCS round trip in the middle, because the halo has no credentials. The bundle is
deleted from the volume before the restore, so what comes back is what the
bucket held: `gs://realness-online-realness/actors/<id>/bundle.tar.gz`,
us-central1, standard.

### How many pages an actor dirties (m1)

A memory idle writes the guest's whole 512MB to the volume whatever the actor
used. `m1-mem-compare.sh` (in the guest, as root, dev loop only) creates a
actor, runs one of three shapes of work, memory-idles it, and compares its `mem`
with the seed's 4KB at a time: identical to the seed, zero, or differing. It
measured 20-21 MiB dirty for an actor restored and idled with nothing done to
it, 24-26 MiB after light use, and 171 MiB with node holding 100 MiB (two runs).
So a sleep that stored the difference would write ~20-26 MiB instead of 512,
while the actor's own disk writes stay what caps density. `KEEP=1` leaves the
actors up. The branch is closed: the win is density, and RAM, not storage, is
what caps a halo, so storing less per sleep does not buy an actor. The script
stays as the measurement.

### A halo from the image, and one that can be deleted (r8, r9)

`halo up <name>` makes a halo from the fleet image: boot disk, instance with
nested virt and no service account, actors volume, then `halo-bootstrap.sh` on
it (`--smoke` also runs `halo-smoke.sh`). `halo down <name>` stops it with
its disks; `--delete` takes the disks too and leaves the image as the only cost.

`halo down --delete` does not ask what is on the halo.
`halo drain <name> [--delete]` does: it exports every actor, streams each
bundle to `gs://realness-online-realness/actors/<id>/bundle.tar.gz`, checks what
the bucket stored against what was sent, drops the bundle from the volume, and
only then deletes the instance and the disks it actually has. It runs on the
control plane, not the halo, because the halo has no credentials, so it cannot
upload a bundle or decide it is safe to die.

`r9-verify.sh` is the proof, on the Mac: build a halo, write 3 MiB in an actor,
drain and delete the halo, check the instance and both disks are gone, build a
_second_ halo (different creation time, empty volume), land the bundle from the
bucket, restore, and check the payload hash matches, the identity does not, and
the drained actor's trace opens the trace that replaced it. 20 checks.
`probe-capacity.sh` answers which zone can make a halo when `halo up` reports
a stockout.

### The prod halo (d3)

`realness-1` in `realness-online` (us-central1-a, `n2-standard-4`, nested virt
on). Every command runs from here and reaches the halo over gcloud; the account
is `sfryxell@gmail.com`. The halo mirrors the Lima layout: `/opt/fc` holds the
artifacts and `/opt/fc/actors/mnt` is the xfs actors volume.

```bash
gcloud compute ssh realness-1 --zone=us-central1-a --command='mkdir -p ~/realness'
gcloud compute scp --zone=us-central1-a --recurse scripts src realness-1:~/realness

gcloud compute ssh realness-1 --zone=us-central1-a --command='bash ~/realness/scripts/d3-fetch-x86_64.sh'
gcloud compute ssh realness-1 --zone=us-central1-a --command='ROOT=/opt/fc RUNS_DIR=$HOME/realness/runs bash ~/realness/scripts/boot-check.sh'
gcloud compute ssh realness-1 --zone=us-central1-a --command='sudo bash ~/realness/scripts/actors-volume.sh'

gcloud compute instances stop realness-1 --zone=us-central1-a     # manual stop
gcloud compute instances start realness-1 --zone=us-central1-a
```

`d3-fetch-x86_64.sh` is `guest-setup.sh` with the x86_64 SHA pinned; the f3
scripts now pick their arch from `uname -m`, so both halos share them.
`actors-volume.sh` formats the actors PD (once), mounts it by UUID, and re-runs
f5b's reflink checks against real storage: 6/6, two clones in 5ms, free space up
8K. It is 30 GB `pd-standard`, inside the free tier, and reads at 350 MB/s
sequential, fast enough to boot an actor from. Stop/start is verified: the
disks, the mount and `/dev/kvm` all come back.

`idle-guard.sh` installs the timer that stops the halo when nothing is
happening: every 5 minutes, stop after 30 with no `firecracker`, no
`node server/halo/main.js` and no interactive login. `gcloud compute ssh --command`
actors are `@notty` and do not count, so work that is not a running VM has to
hold it open:

```bash
sudo bash ~/realness/server/halo/scripts/idle-guard.sh
sudo touch /run/realness-hold     # tmpfs; cleared by a boot
```

A guest `poweroff` does become `TERMINATED`: with the hold removed and the halo
stopped, the timer stopped the halo 2.5 minutes later, no API call involved.
Resume with `gcloud compute instances start realness-1`.

#### A halo from the image

The family `realness-halo` bakes /opt/fc (pinned Node included), the scripts and
the idle guard into a 20 GB-geometry image, so a halo is one command:

```bash
node tools/control/bin/webspace.js development halo up realness-2 --smoke
```

It creates the boot disk and the instance by name, waits for ssh, adds a 30 GB
actors volume, copies `server/halo/`, and runs its `scripts/halo-bootstrap.sh` on the
halo: grow the root partition if it lags, `net-up.sh`, `actors-volume.sh`,
`idle-guard.sh`, then one state line per resource. `--smoke` then runs
`halo-smoke.sh`, which builds the seed, serves on loopback, creates an actor,
execs in it, destroys it, and checks the actor's machine-id is not the seed's.
It predates the halo secrets and now kills the serving halo, so deployed halos
are checked with `check:halo` through a tunnel instead (`.tooling.md`).

Measured: **2m50s** from nothing to a halo that serves an actor (the seed is 36s
of that), and 5/5 on the smoke test.
`webspace development halo down realness-2 --delete` takes it back to the image and
leaves no disk behind.

Bake a new image from a stopped halo that has the change; the family serves the
newest, and older images stay for rollback:

```bash
gcloud compute images create realness-halo-v<N> --family realness-halo \
  --source-disk realness-1-boot --source-disk-zone us-central1-a
```

v3 carries Node and a source tree with only `server/halo/`; a fresh halo from it
printed `node v22.23.3 present` at bootstrap. Delete older images once a new one
passes `--smoke`.

The image already carries a grown root partition, so `growpart` reports NOCHANGE
on a halo built from it; 20 GB is the floor because an image cannot be smaller
than the disk it was taken from. `net-up.sh` has to run before the halo can
build a seed, or `build_seed` stops with `no fc-tap0`.

### The loop on x86_64 (x1)

`scripts/x1-verify.sh` runs on `realness-1` and proves the port end to end: the
template is x86_64, the seed forks, and an actor runs a command and a terminal.
The template build is arch-neutral: `template-build.sh` fetches its own inputs
and picks amd64/x64 from `uname -m`, and the scripts resolve the repo from their
own path instead of `/mnt/fc`.

```bash
# on realness-1, after d3
sudo bash ~/realness/scripts/template-build.sh
bash ~/realness/scripts/f3-verify.sh          # 19/19
sudo bash ~/realness/scripts/f4-verify.sh     # 7/7, the x1 done-when
sudo node server/halo/main.js serve --volume /opt/fc/actors/mnt &
bash ~/realness/scripts/x1-verify.sh          # 11/11
```

Two bugs the arm64 runs had hidden, both teardown races: `f4-verify.sh` loads
the clone onto the snapshot's TAP before the base has released it (x86_64 lost
the race, `Resource busy` on `fc-tap0`), and `boot-lib.sh`'s EXIT trap ended on
a short-circuited `declare -F`, so a passing run exited 1. Both fixed for both
halos.

### An actor builds a site (a1)

The `/site` prompt copies the starter's static example and builds it:

```bash
mkdir site && tar -C ../../.pi/examples/static -cf - . | tar -C site -xf -
cd site && npm install && npm run build
realness publish dist
```

Articles are Markdown in `content/articles/`. The output is plain HTML with its
own scripts; a page with a diagram gets `scripts/pele.global.js` copied in.
`/app` does the same with the app example.

### Publish it at a URL (a2, c1e)

With sync configured, a site lives in sync, not on an actor:

- `POST /v1/actors/{id}/publish {"path": "/realness/work/site"}` runs `tar` in
  the guest, uploads the tree as an immutable version under `sites/<id>/`, then
  points `sites/<id>/active` at it.
- Sync serves `sites/<id>/` to anyone, with no actor alive. Versions are private
  until active; restore re-points the pointer; remove clears it and keeps
  history.
- The halo writes through a signed owner pass that reaches only that owner's
  `people/+A/work/site/`, so the same source tree comes back on a fresh actor
  and the URL stays the same.

Without `SYNC_SITE_URL`, publish falls back to the volume: it extracts the tree
into `published/<id>/` and the actor's own server serves `/s/<id>/`. That copy
dies with the actor; it is for the offline unit tests, not the live loop.

In the dev loop sync listens on `127.0.0.1:18096` and the URL is
`http://127.0.0.1:18096/sites/<id>/`. Halos take no internet traffic; live app origins are x9.

### An app runs in its own VM (u2)

We manage the server. An author writes one handler, standard library only:

```js
// server.js
export default {
  async fetch(request) {
    return new Response("hi");
  },
};
```

Our server (`server/halo/guest/realness-serve.js`, on the node runtime disk) turns HTTP
on 8080 into a web `Request` and streams the `Response` back. Node runs it under
`--permission`: it reads only the handler's files and itself. A plain
`index.html` is a site: files, no VM. Anything else (a Procfile, python, a
binary, a dependency) is refused at publish with its reason.

Each handler is one Firecracker microVM from `/opt/fc/app.ext4`, with nothing an
app does not need. `SECURITY.md` lists each absence and the check that proves
it.

```bash
sudo bash /mnt/fc/control/scripts/app-image-build.sh      # the image
sudo bash /mnt/fc/control/scripts/runtime-build.sh        # node + our server, read-only
sudo bash /mnt/fc/server/halo/scripts/net-up.sh                  # fc-app rules
sudo bash /mnt/fc/control/scripts/app-image-verify.sh     # 17 checks
sudo bash /mnt/fc/control/scripts/app-boot-check.sh       # 7 checks
sudo bash /mnt/fc/control/scripts/app-escape-check.sh     # 21 refusals
sudo CONTROL=1 bash /mnt/fc/control/scripts/app-escape-check.sh  # holes seen
sudo bash /mnt/fc/control/scripts/app-memory-floor.sh     # the floor
sudo bash /mnt/fc/control/scripts/app-check.sh            # all of it: 12 steps
```

`app-check.sh` builds, verifies, and probes in one run, each step to its own log
under `dist/app-check-<time>/`. Its `escape-ctrl` step passes by failing.

- **Disks.** A reflink copy of the image is the only writable disk. The
  handler's files are a read-only ext4 labelled `app-code`, with the start
  command beside them; the node disk, labelled `rt-node`, is read-only too. The
  guest mounts both by label, so attach order does not matter.
- **Start.** `realness-app.service` mounts as root, then runs our server as
  `app` with `NoNewPrivileges`. No shell parses the command. No getty, no login.
- **Network.** App TAPs are `fc-appN` on `172.17.N.0/30`; the MAC carries the
  address. The halo may open 8080 and gets replies only from it. Nothing an app
  starts leaves, and nothing is routed to one. No vsock device is attached.
- **Memory.** The guest OS takes about 54 MiB. A handler serves at 64 MiB with 6
  left; the cap is 96, leaving about 37. On x86_64 (prod) the floor is 80 MiB,
  and 96 leaves about 27. Below the floor the boot thrashes
  rather than hitting the OOM killer, so the failure is a timeout.

What this taught:

- The Lima halo's INPUT policy is ACCEPT. A TAP no chain names is open to the
  halo, so each TAP prefix needs its own chains before its first VM.
- A Node process that spawns Firecracker waits on it forever; `unref()` the
  child, or a CLI never exits.
- The halo logger writes to stdout, so a CLI's JSON record is its last line.
- `start()` in `$(...)` runs in a subshell: ids appended to an array there never
  reach the cleanup trap. The checks write ids to a file.
- The kernel makes `/dev/vsock` with no device attached; probe a connect to CID
  2, not the file.
- 127.0.0.1 inside a VM is the VM. A probe aimed at it finds itself.
- Under `--permission` a handler cannot read `/proc`, but `os.freemem()` works:
  libuv reads MemAvailable itself, outside the fs module.
- The permission model refuses first, so an inside probe cannot reach the
  read-only disks beneath it; those are checked from the halo.
- A refusal proves nothing until a control opens the hole. `CONTROL=1` opens
  only the probe's own TAP, so other apps keep strict rules mid-run.
- In Lima, a VM's TCP SYN leaves through the NAT but no reply comes back, even
  with every rule lifted; UDP DNS works. The internet control proves packets
  leave, not that a connection completes.
- The control opens 3 of the 21 probes: halo services, actors, and DNS. Siblings
  stay shut by their own TAP rules; internet by Lima's NAT; metadata has no
  route. The rest are file, process, user, and device refusals.
- The floor script reports sizes and exits 0 below the floor; the one-run check
  asserts the 96 and 64 rows say `ok` instead.
- A run directory holds each VM's `api.sock`; `cp -R` skips it when archiving.

### Usage and the daily cap (o1, g3)

Every model call through `realness-proxy` writes one create-only file:

```
usage/+A/<day>/<time>-<actor>-<nonce>.html
```

One `/usage` item per file: model, actor, status, request and reply bytes,
prompt and completion tokens, cost. Never prompt or reply text. Tokens and cost
come from the last streamed chunk; the proxy asks OpenRouter with
`usage: {include: true}` and reads the stream as it passes, unchanged.

The ledger sits outside `people/`, so sync never writes it: `can()` lets the
owner `get` and `list` their own `usage/+A/`, and nothing else. One file per
call because Storage has no append; racing calls never conflict.

Limits are per payer, per UTC day and per UTC month: 250k tokens a day and 3M a
month free (`FREE_LIMITS` in `src/proxy/usage.js`). Free use runs a free model,
so free limits count tokens. `FREE_TOKENS_PER_DAY`, `FREE_TOKENS_PER_MONTH`,
`FREE_COST_PER_DAY`, and `FREE_COST_PER_MONTH` override them. The first call
lists the month's day folders, then the proxy counts in memory. The count is
exact for one instance.

- Over a limit: 429, `insufficient_quota`, `limit: "day"|"month"`, message
  containing "quota exceeded". Pi retries any 429 unless the text says so; this
  one it shows at once. `specs/proxy/server.spec.js` runs Pi's own classifier on
  it.
- Total unreadable: 503, and no upstream call.

Proven: `proxy` tests, and one real call to OpenRouter wrote a row to
`realness-development.appspot.com`; a second call at a 1-token cap got 429.

## Signing the binary

`tools/desktop/build.sh`, `tools/desktop/sign.sh`, `tools/desktop/notarize.sh`. What each run taught:

- One binary is the app. macOS opens a bare executable in Terminal, so a
  launcher `.app` buys nothing; Terminal is the floor, Ghostty an upgrade.
- Notarization uses an App Store Connect API key (profile `realness-notary`);
  the app-specific password returned 401 twice. The `.p8` must stay put, because
  the profile stores its path.

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
- `spctl --assess --type exec` cannot judge a bare executable. It reports "valid
  but does not seem to be an app" for a correctly signed and notarized binary,
  so the run is the verdict, not spctl.

## Known costs

Cost and design facts. Build and runtime gotchas are below.

- Memory per actor, measured on the dev halo: 86MB restored and idle, 125MB with
  node running, 230MB with pi up. The 384MB this plan used to carry was never
  measured. Density is bounded by RAM: ~30 busy actors on a 4-vCPU/16GB halo,
  more when they idle. The template carries ~1.0 GiB of `node_modules`, but
  reflink shares it, so it sets the seed's size and not each actor's.
- A memory sleep is a Full snapshot: 512MB on the volume every time, fully
  allocated, whatever the actor used (measured: one idle took the volume up
  exactly 512 MiB). An actor's own writes are ~160MB after two minutes of light
  work, and reflink shares the rest with the seed. So 30GB holds ~43 memory
  sleeps, or ~180 disk sleeps. Storing is roughly ten times cheaper than
  resuming with programs alive, and neither is what runs out first.
- Idle is a tier, not a shutdown: the disk is the actor and memory is
  disposable. A memory idle restores; a disk idle boots the actor's own disk, so
  files and identity persist and processes are gone.
- The actors volume is 30 GB `pd-standard` and reads at 350 MB/s sequential,
  which is fast enough to boot an actor from, and reflink works on it (6/6, two
  clones in 5ms). That keeps the volume inside the free tier; only the boot disk
  bills.
- Parked cost, measured: 20 GB boot + 30 GB actors, standard, is
  $0.80/mo
  because the 30 GiB-months allowance is shared and per account; the fleet image
  adds $0.12/mo
  (2.35 GB compressed). 20 + 10 GB would fit inside the allowance and cost
  nothing, and deleting the disks (r8) makes it $0.

## Gotchas found here

- `probe-capacity.sh` took its candidates only from `$@`, so with no arguments
  it probed nothing and still printed its summary and exited 0, a silent no-op
  that reads like a passing run. It now defaults to a candidate list and exits
  non-zero when none of them can make a halo. Found while proving halo-up.
- `us-central1-a` has no `n2-standard-4` capacity right now; a stockout refuses
  both `instances create` and `instances start`, so `realness-1` cannot be woken
  and a new halo has to go to `us-west1-b` or `us-east1-b` (probed, both OK).

- comark 0.4.0 moved `language` onto `<pre>`
  (`<pre language="js"><code class="language-js">`), so a highlighter regex that
  expects `<pre><code` silently stops matching and code blocks render flat. The
  regex must also skip `mermaid` fences: shiki would replace the element the
  browser's setup script looks for, and the diagram source goes with it.
  `plans-server.cjs` and the skill's builder both carried the stale regex.
- The image is only as new as the staged tarball. `dev-build.sh` stages and
  builds it, then `dev-up.sh --fresh` reseeds. Run `template-build.sh` alone and
  an actor quietly runs the previous staged harness.
- A check script that writes markdown through a heredoc must quote the delimiter
  (`<<"EOF"`). Unquoted, bash runs the backticks in a fenced block as command
  substitution and the fences vanish from the file with no error.

- `iptables-nft` (Ubuntu 24.04) wants the table flag _before_ the command:
  `iptables -t nat -C ...` works, `iptables -C -t nat ...` dies with
  `Bad argument 'nat'`.
- `fcnet-setup.sh`, the MAC-to-address script `realness-net-up` calls, is
  Firecracker CI's and is not in ubuntu-base. It is vendored in `server/halo/guest/`
  rather than read out of `squashfs-root`, which is a leftover of the f1 fetch
  and may not exist on a fresh halo.
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
  not enough. Restart it, or the seed's entries return.
- bash `local a=... b="...$a..."` on one line under `set -u` fails as an unbound
  variable: declare, then assign on the next line.
- macOS bsdtar emits `._*` members from file xattrs, and `--exclude='._*'` does
  not filter what it synthesizes. The shipped template had `._models.json`
  beside `models.json` while the repo and the tarball had neither. The build
  purges `._*` and `.DS_Store` from the tree; `debugfs` on the image confirms.
- A sparse volume image bigger than the halo's free space does not fail as
  `ENOSPC`: the write past the last backed block comes back as `EIO`, and
  Firecracker reports it as
  `Cannot perform sync_all on the memory backing file: I/O error (os error 5)`
  in the middle of a snapshot. `dev-stack.sh` checks free space against `SIZE`
  before mounting. The guest's 20 GiB root disk is what actually limits this;
  finished work dirs (`/opt/fc/f5b`, `f5c`, `f6`) are scratch and 2G each.
- `firecracker --version` prints the version on the first line, then a
  timestamped exit banner. Capture both and a recorded version string changes on
  every call, which made the seed fingerprint mismatch and every start rebuild
  the seed. Take the first line.
- A socat listener's command line names the program it execs
  (`EXEC:/usr/local/bin/realness-pty`), so `pgrep -f realness-pty` always finds
  the listener. Evidence that counts agents must match the agent's own command
  line, e.g. `[p]ython3 /usr/local/bin/realness-pty`.
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
  the actors volume, which is also where the halo keeps it (d3e).
- `pgrep -f "sshd: "` matches the always-running listener
  (`sshd: /usr/sbin/sshd -D [listener] ...`), so an activity check written that
  way is always true; and `pgrep -f <pattern>` matches any argv containing the
  pattern, including the shell running the check. Match `@pts`, and bracket the
  first letter.
- A GCP disk's `deviceName` decides its `/dev/disk/by-id` path, and defaults to
  `persistent-disk-1` rather than the resource name. Create it with an explicit
  `--device-name=realness-actors` or the path will not match the script. The
  name is per-instance, so every halo can use the same one.
- `--zone` and `--project` are not accepted above a subcommand:
  `gcloud --project=p --zone=z compute disks create` and
  `gcloud compute --zone=z disks create` both die with
  `unrecognized arguments: --zone=z`. Pass them per call, or set
  `CLOUDSDK_COMPUTE_ZONE` and `CLOUDSDK_CORE_PROJECT`, which is what
  `halo up` does.
- Piping a gcloud call to `tail -1` hides the reason it failed: the error's
  useful line is the first of four, and the last is always
  `gcloud help -- SEARCH_TERMS`. `tail -5` keeps the message.
- `pkill -f <pattern>` inside an ssh `--command` kills the shell running the ssh
  command, because that shell's own command line holds the pattern. It bites
  twice over: once plainly, and once when the same command also contains the
  text the pattern matches (a restart one-liner holds both the `pkill` and the
  `nohup ... serve`). Put it in a script and run it with `bash -s`
  (`server/halo/scripts/halo-restart.sh`) so the pattern is never on the remote command
  line.
- A killed Firecracker that is not reaped is a _zombie_, and a zombie is still a
  process named `firecracker`, and that is what every leftover check and the
  idle guard count. One would hold a halo awake forever. Reaping has to poll:
  `waitpid(pid, WNOHANG)` issued right after SIGKILL returns 0 while the process
  is still dying, and nothing else ever collects it. `halo-smoke.sh` and
  `r7-verify.sh` both check for leftovers, which is how this was caught.
- The Python halo ran as root and left root-owned `__pycache__` in the source
  tree, and the next `scp` of the code over it failed for the login user with
  `failed to upload directory`. Chown the tree before copying
  (`halo-bootstrap.sh` does).
- A disk whose name collides with an instance's is attached rather than created:
  asking for a 20 GB boot disk while the 100 GB `realness-1` still existed
  booted the instance from the 100 GB disk and reported success. Check `lsblk`.
- `gcloud compute instances detach-disk` rejects `--disk` and `--device-name`
  together, and a `&&` chain will happily run the next command anyway if you do
  not check the exit status.
- `realness-online`'s `default-allow-ssh` rule is open to `0.0.0.0/0`; key-only
  ssh is the only thing gating port 22 on the prod halo.
- A `set -eu` script with an EXIT trap exits **0** when it dies on an unbound
  variable, and `$?` is already 0 inside the trap. Exit status is not evidence:
  have the script mark its own success and make the trap return non-zero without
  the mark. The unbound read that found this came from a helper setting a
  variable for a caller who wrote `x="$(helper)"`. A command substitution is a
  subshell, so echo the status and write the body to a file.
- bash 3.2, which macOS ships, expands every word of `local a="$1" b="$2"`
  before assigning any of them, so `b` cannot read what `a` was given.
- macOS Gatekeeper blocks the cloud SDK's `gcloud-crc32c` helper, so any
  `gcloud storage` call needing a local crc32c fails. Compare a bundle with the
  object's `md5Hash` and `md5 -q file | xxd -r -p | base64` instead.
- `tar -czf - <id>` already holds that directory, so an extract into a directory
  of the same name nests everything twice. And the manifest's `artifacts.sha256`
  is for the `artifacts.tar.gz` _inside_ the archive, not the archive the stream
  makes. A fresh gzip is not byte-identical, so compare after extracting.
- Guest RNG comes from VMGenID on kernel >= 5.18; the wall clock needs VMClock
  or a manual `clock_settime` after restore. arm64 reseeds on the CI 6.1.155
  kernel, and x1 re-proves it per-kernel.
- A vsock device owns a host unix socket, one path per VM, and an actor's unix
  sockets must fit AF_UNIX's 108-byte limit, which is why the actors volume is
  mounted at the short `/opt/fc/actors/mnt`.
- Firecracker does no network filtering. Host egress rules are mandatory; the
  guest's own rules are not a boundary.
- Snapshot files are trusted, with no halo-side protection.
- Replacing a disk leaves a second `/etc/fstab` line pointed at the same mount
  point. `actors-volume.sh` deletes other entries for the mount before adding
  its own.
- A stale seed forks an old kernel or pi silently. `create` refuses on the
  `seed.json` fingerprint instead: template size and mtime, kernel, firecracker,
  arch.
- Lima's automatic port-forward skips a guest port whose host number is taken,
  silently. The dev halo's ports are explicit in `server/lima/fc-local.yaml` (18080 ->
  8080, 18081 -> 8081, 18096 -> 18096).
- A zone stocks out across machine types, not one of them, and a stockout also
  refuses to _start_ a parked halo: us-central1 took nine refusals across four
  machine types while us-west1-b took the halo. `scripts/probe-capacity.sh` asks
  each candidate for real, and r9 ran in us-west1-b for that reason.
  `halo up` removes the boot disk it just made when a create fails. Before
  that, one refusal left 20 GB billing unattached.
- The halo's first serve on a fresh halo builds the seed (~36s of boot) before
  the listener answers, so `halo-restart.sh` waits three minutes, not one.
- A halo refuses to start without both root-only secret files, 0600 root:
  `/etc/realness/model-pass-secret` and `/etc/realness/halo-pass-secret`. The
  halo pass secret is fleet-wide: the sync service mints a pass with the same
  value from Secret Manager, and any halo accepts it at its terminal.

## Scope

This loop is arm64; the prod halo is x86_64. It validates the VM lifecycle, the
network path, and the control channel. d3 carries the same work onto the prod
halo, minus snapshots. Snapshots are per-architecture and pinned to the
Firecracker data format version, so the x86_64 boot-and-snapshot proof (x1) is
still required.

`jailer` (root for cgroups, namespaces, chroot) is not used yet. `--enable-pci`
is not passed, so virtio is on the legacy MMIO transport; PCI is faster for
block and net, and worth revisiting when r3 measures anything.

## Proven how

Deployed on 2026-10-07 (x4): `check:halo` 28/28 and `check:chat` passed against
`realness-demo` through a tunnel, and a phone sign-in reached Pi in the browser
terminal.

Every script was read and run for real on 2026-09-18; the checks now live in
`artifacts/firecracker/webspace-archive/scripts/`. `dev-build.sh` kept a prior
green run, and `net-down.sh` was read only. The one-page walkthrough of what
each command does, with what it proved, is
`artifacts/firecracker/webspace-command-map.md`; the run logs from the prod
walkthrough are in `artifacts/firecracker/probe-20260918/`:

- `dev-setup.sh`: booted a microVM (`dist/boot-<utc>/`, 473 serial lines,
  `PASS: guest reached userspace`)
- `dev-up.sh`: `--fresh` wiped the volume and rebuilt the seed; health `ok`
- `halo up probe-realness-2 --smoke --zone=us-west1-b`: halo created,
  bootstrapped, 5/5 smoke, serving
- `halo drain` and `halo down --delete`: an actor with a 100 KB payload
  exported to
  `gs://realness-online-realness/actors/a-2c3939d4a288/bundle.tar.gz` (103,375
  bytes, md5 `pFK6XsalyMdOkOmpzOKTHQ==`), then the halo and both its disks
  deleted; `gcloud compute instances list` back to `realness-1` alone
- `probe-capacity.sh`: us-central1 a/b/c and us-west1-a: no n2-standard-4;
  us-west1-b and us-east1-b: OK
