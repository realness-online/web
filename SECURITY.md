# Security

Brayness runs server code we did not write. The defense is a small attack
surface: what is absent cannot be exploited. Every claim below names the check
that proves it; please rerun them and tell us where we are wrong.

Report a hole: open an issue.

## Apps

Each published app is one Firecracker microVM: its own kernel, never shared.

| Claim                                                          | Check                                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| No interpreter in the base image: no node, python, perl        | `control/scripts/app-image-verify.sh` reads the image offline               |
| No harness, Pi, git, socat, sshd, or vsock agent               | same script; the boot shows no vsock or PTY unit                            |
| A runtime arrives only when the files ask, read-only           | `host/src/infer.js`, `host/test/infer.test.js`                              |
| App code is a read-only disk; the app cannot change it         | `host/guest/brayness-app-mount` mounts `ro,nosuid,nodev`                    |
| The app runs as `app`, never root, with no new privileges      | `control/scripts/app-boot-check.sh` asserts a non-root uid                  |
| No shell runs the start command                                | `host/guest/brayness-app-start` execs argv; `infer.js` refuses shell syntax |
| No vsock device: the host's only ways in are 8080 and serial   | `host/src/apps.js` boots with no `/vsock`                                   |
| An app reaches nothing: no internet, no host, no actor, no app | `host/scripts/net-up.sh`, chains `BRAYNESS-APP-*`                           |
| The host may open 8080; only replies come back                 | `BRAYNESS-APP-IN` accepts sport 8080, ESTABLISHED only                      |
| Nothing is routed to an app                                    | `FORWARD -o fc-app+ -j DROP`                                                |
| Apps and actors never share an address range or rule           | apps on `172.17/16` and `fc-app*`; actors on `172.16` and `fc-tap*`         |

Rejected: nsjail, bubblewrap, systemd-run. Code we did not write needs a kernel
boundary, not a namespace.

## Known gaps

- Caps (128 MiB, 1 vCPU) are placeholders until the memory floor is measured.
- Each app's writable root is a 1G copy; a shared read-only root is smaller.
- The escape probes (host files, volume, sibling app, actor, metadata, host)
  are not written yet.
- Apps get no egress; model calls will need a narrow door.
- Everything above is proven in a Lima development host, not yet production.
