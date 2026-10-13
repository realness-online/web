# Security

Brayness runs code we did not write. The defense is a small attack surface:
what is absent cannot be exploited. Every claim below names the check that
proves it; please rerun them and tell us where we are wrong.

Report a hole: open an issue.

## Apps

We manage the server. An author writes one `fetch(request)` handler in
`server.js`, standard library only; our server runs it on Node. Nothing else
runs: no frameworks, no dependencies, no other language, no binaries. A plain
site is served as files, with no VM at all.

Each handler gets one Firecracker microVM: its own kernel, never shared. Author
code is untrusted, so the walls are layered, outermost first.

Rerun every check below in one go, inside the Lima development guest:

    sudo bash /mnt/fc/control/scripts/app-check.sh

It builds the image and runtime, then runs each check to its own log. The last
run passed 12 of 12 steps.

### What we removed

| Removed                                             | Check                                                 |
| --------------------------------------------------- | ----------------------------------------------------- |
| Node from the base image; it rides a read-only disk | `app-image-verify.sh`: absent `node`                  |
| Python and Perl                                     | same: absent `python3`, `perl`                        |
| The harness, Pi, git, socat                         | same: absent `/brayness`, `pi`, `git`, `socat`        |
| The vsock agent and the terminal                    | same, from the boot: no `brayness-vsock`, `-pty`      |
| Every getty: serial, virtual terminals, the target  | same: no `getty@`, `serial-getty`, `getty.target`     |
| e2scrub timers                                      | same: no `e2scrub`                                    |
| Procfiles, Python apps, other stacks                | `server/host/test/infer.test.js`; `app-boot-check.sh` |
| Author binaries                                     | same: an executable is refused                        |
| npm dependencies, `node_modules`, bare imports      | `infer.test.js`: standard library only                |
| Author servers; we run the only one                 | `infer.test.js`: no default export is refused         |

### The VM

| Claim                                                         | Check                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| No interpreter in the base image: no node, python, perl       | `tools/control/scripts/app-image-verify.sh` reads the image offline |
| No harness, Pi, git, socat, sshd, or vsock agent              | same script                                                         |
| No login anywhere: no getty on serial or a terminal; no scrub | same script reads the boot                                          |
| No vsock device: the host's only ways in are 8080 and serial  | `app-escape-check.sh` reads Firecracker's `vm/config`               |
| Exactly three drives; code and runtime read-only              | same, from `vm/config`                                              |
| A memory cap on every VM: 96 MiB, 1 vCPU                      | same; `app-memory-floor.sh` measured the floor at 64                |

### The network

| Claim                                                          | Check                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| An app reaches nothing: no internet, no host, no actor, no app | `server/host/scripts/net-up.sh`, chains `BRAYNESS-APP-*`            |
| The host may open 8080; only replies come back                 | `BRAYNESS-APP-IN` accepts sport 8080, ESTABLISHED only              |
| Nothing is routed to an app                                    | `FORWARD -o fc-app+ -j DROP`                                        |
| Apps and actors never share an address range or rule           | apps on `172.17/16` and `fc-app*`; actors on `172.16` and `fc-tap*` |

### Inside the VM

| Claim                                                                               | Check                                                           |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Only a handler or a site is accepted; every other stack is refused                  | `src/host/infer.js`, `app-boot-check.sh`                        |
| Standard library only: no dependencies, no bare imports                             | `infer.js`; and no modules folder reaches the disk              |
| The handler runs as `app`, never root, with no new privileges                       | `app-boot-check.sh` asserts a non-root uid                      |
| Node's permission model: reads only its code; no writes, processes, workers, addons | `src/host/infer.js` `START`; `app-escape-check.sh`              |
| Code and runtime are read-only disks beneath that                                   | `server/host/guest/brayness-app-mount` mounts `ro,nosuid,nodev` |

### Escape probes

`tools/control/scripts/app-escape-check.sh` boots a probe handler beside a live
sibling. From inside, the probe tries each route below; every one must be
refused. `CONTROL=1` opens only the probe's own TAP first; that run must fail.
It opens 3 probes: host services, actors, and DNS. Sibling apps stay shut by
their own TAP rules, metadata has no route, and the internet is lost to Lima's
NAT, so those three have no working control.

| Route tried from inside an app                        | Refused by                                |
| ----------------------------------------------------- | ----------------------------------------- |
| Every port the host listens on, at every host address | `BRAYNESS-APP-IN`                         |
| A running sibling app's 8080                          | `FORWARD -o fc-app+ -j DROP`              |
| Actors and their gateways                             | `BRAYNESS-APP-OUT`                        |
| Cloud metadata, 169.254.169.254                       | `BRAYNESS-APP-OUT`                        |
| The internet, by address and by name                  | `BRAYNESS-APP-OUT`, and no NAT for 172.17 |
| Writing its code, `/tmp`, or anywhere                 | Node permissions, then read-only disks    |
| Reading `/etc/shadow`, `/proc`, the runtime           | Node permissions                          |
| Spawning a process, starting a worker                 | Node permissions                          |
| A second port reached from the host                   | replies only from 8080                    |

Rejected: nsjail, bubblewrap, systemd-run. Code we did not write needs a kernel
boundary, not a namespace.

## Known gaps

- Node's permission model refuses first, so the probe cannot reach the layers
  beneath it: read-only disks and the non-root user are checked from the host
  and in the mount script, not exercised from inside.
- Each app's writable root is a 1G copy; a shared read-only root is smaller.
- In Lima, TCP from a VM gets no answer upstream even with rules lifted, so the
  internet control proves packets leave the host, not that a reply returns.
- The sibling, metadata, and internet refusals have no control that opens them.
- Apps get no egress; model calls will need a narrow door.
- Everything above is proven in a Lima development host, not yet production.
