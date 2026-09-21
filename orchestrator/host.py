"""Host plumbing: the sessions volume, TAP devices, root.

These are facts the orchestrator cannot invent. Reflink is the fork mechanism
and only some filesystems have it; one TAP backs one VM (f5c); Firecracker
creates root-owned sockets and TAPs need root. Each check fails with the command
that fixes it rather than continuing into a confusing error later.
"""
from __future__ import annotations

import contextlib
import os
import subprocess
import tempfile
from pathlib import Path

REFLINK_FILESYSTEMS = ("xfs", "btrfs")


class HostError(RuntimeError):
    """The host is not in the state this needs; the message says what to run."""


def run(argv, check=True):
    """Run a host command and return its CompletedProcess, output as text."""
    result = subprocess.run(
        argv,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if check and result.returncode != 0:
        output = (result.stdout or "").strip()
        raise HostError(f"{' '.join(argv)}: exit {result.returncode}\n{output}")
    return result


def require_root(what):
    if os.geteuid() != 0:
        raise HostError(f"{what} needs root: re-run with sudo")


def is_mountpoint(path):
    return os.path.ismount(str(path))


def require_mount(path, fix):
    if not is_mountpoint(path):
        raise HostError(f"{path} is not a mount point - {fix}")


def filesystem_type(path):
    """The filesystem backing `path`, e.g. 'xfs'. Linux only, which this is."""
    result = run(["stat", "-f", "-c", "%T", str(path)])
    return result.stdout.strip()


def warn_if_no_reflink(path):
    """Reflink is how a session disk is created; a copy is not the plan.

    Not fatal here: `cp --reflink=always` fails loudly at the first create, and
    that error names the real problem.
    """
    kind = filesystem_type(path)
    if kind not in REFLINK_FILESYSTEMS:
        return f"{path} is {kind}, not {' or '.join(REFLINK_FILESYSTEMS)}: session disks will not reflink"
    return None


def tap_exists(name):
    return run(["ip", "link", "show", name], check=False).returncode == 0


def free_tap(prefix, first=1, last=63):
    """The lowest numbered free TAP name. tap0 belongs to net-up.sh."""
    for index in range(first, last + 1):
        name = f"{prefix}{index}"
        if not tap_exists(name):
            return name
    raise HostError(f"no free TAP in {prefix}{first}..{last}")


def create_tap(name):
    run(["ip", "tuntap", "add", "dev", name, "mode", "tap"])
    run(["ip", "link", "set", name, "up"])


def delete_tap(name):
    if tap_exists(name):
        run(["ip", "link", "del", name])


def is_short_enough_for_af_unix(path):
    """AF_UNIX paths cap at 108 bytes, sockets included. A long mount point
    turns into a confusing 'Cannot assign requested address' at load time."""
    return len(os.fsencode(str(path))) < 108


@contextlib.contextmanager
def mounted(disk, readonly=False):
    """Mount a disk image on a loop device for the length of the block.

    A stopped session's disk is just a file on the sessions volume, so its files
    can be read and written from the host - no channel into the guest, and no
    size limit on what moves. It has to be a stopped session: a running guest
    writes under the mount, and mounting rw replays the guest's journal for it.

    The mount point is on /run (tmpfs), not the sessions volume, so a stale
    mount can never make the volume look non-empty.
    """
    where = tempfile.mkdtemp(prefix="brayness-mnt-", dir="/run")
    try:
        run(["mount", "-o", "loop,ro" if readonly else "loop", str(disk), where])
    except BaseException:
        os.rmdir(where)
        raise
    try:
        yield Path(where)
    finally:
        result = run(["umount", where], check=False)
        if result.returncode != 0:
            raise HostError(f"could not unmount {where}: {result.stdout.strip()}")
        os.rmdir(where)
