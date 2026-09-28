# u2d's probe: an app that tries every way out of its VM and reports each try.
# GET /probe answers JSON {name: {"refused": bool, "detail": str}}; every one
# must be refused. app-escape-check.sh copies this beside a targets.json that
# names the host's real listening ports, so the probes aim at live services.
#
# Stdlib only: it runs on the python runtime disk, like any untrusted app.

import http.server
import json
import os
import shutil
import socket
import subprocess

TARGETS = json.load(open("targets.json"))
PORT = int(os.environ["PORT"])


def own_address():
    out = subprocess.run(["ip", "-4", "-o", "addr", "show", "eth0"], capture_output=True, text=True).stdout
    return out.split()[3].split("/")[0]


def connect(host, port, seconds=1.5):
    """Refused when the TCP connect fails; a timeout (dropped) counts as refused."""
    try:
        with socket.create_connection((host, port), timeout=seconds):
            return False, f"connected to {host}:{port}"
    except OSError as error:
        return True, f"{host}:{port} {type(error).__name__}"


def reach(hosts_ports, seconds=1.5):
    tries = [connect(h, p, seconds) for h, p in hosts_ports]
    open_ = [d for refused, d in tries if not refused]
    return (not open_), "; ".join(open_) or f"{len(tries)} tries, none connected: " + ", ".join(d for _, d in tries)[:300]


def write(path):
    try:
        with open(path, "w") as f:
            f.write("x")
        return False, f"wrote {path}"
    except OSError as error:
        return True, f"{path} {error.strerror}"


def probes():
    me = own_address()
    net = me.rsplit(".", 1)[0]
    gateway = f"{net}.1"
    host_ports = TARGETS["host_ports"]
    results = {}

    # The host: every port it listens on, at every address the app might use.
    results["host services"] = reach([(a, p) for a in [gateway, *TARGETS["host_addresses"]] for p in host_ports])
    # Sibling apps: every other app address in the first eight TAPs.
    siblings = [f"172.17.{i}.2" for i in range(1, 9) if f"172.17.{i}.2" != me]
    results["sibling apps"] = reach([(a, 8080) for a in siblings])
    # Actors: the seed and the first actors, and their gateways.
    results["actors"] = reach([(f"172.16.{i}.{h}", p) for i in range(4) for h in (1, 2) for p in (22, 52, 8080)])
    # Cloud metadata, link-local.
    results["metadata"] = reach([("169.254.169.254", 80)])
    # The internet: no egress at all, by address and by name.
    results["internet"] = reach([("1.1.1.1", 443), ("1.1.1.1", 80), ("8.8.8.8", 53), *[(a, 443) for a in TARGETS.get("internet", [])]])
    try:
        socket.getaddrinfo("example.com", 443)
        results["dns"] = (False, "example.com resolved")
    except OSError as error:
        results["dns"] = (True, f"no resolution: {error}")

    # Its own box: not root, cannot gain it, cannot write its code or runtime.
    results["not root"] = (os.getuid() != 0 and os.geteuid() != 0, f"uid {os.getuid()} euid {os.geteuid()}")
    status = dict(line.split(":", 1) for line in open("/proc/self/status") if ":" in line)
    results["no new privileges"] = (status.get("NoNewPrivs", "").strip() == "1", f"NoNewPrivs {status.get('NoNewPrivs', '?').strip()}")
    results["code read-only"] = write("/app/code/escape")
    results["runtime read-only"] = write("/opt/runtime/escape")
    results["root owned"] = write("/etc/escape")
    mount = subprocess.run(["mount", "-t", "tmpfs", "x", "/mnt"], capture_output=True, text=True)
    results["cannot mount"] = (mount.returncode != 0, mount.stderr.strip()[:80])

    # Nothing of the host's is visible: no shared filesystem, no vsock, no extra disk.
    types = {line.split()[2] for line in open("/proc/mounts")}
    shared = types & {"9p", "virtiofs", "nfs", "nfs4", "cifs", "fuse"}
    results["no shared filesystem"] = (not shared, f"mount types: {sorted(types)}")
    # The kernel makes /dev/vsock whether or not a device exists; what matters
    # is whether a connect reaches the host (CID 2) on the actor agent's ports.
    vsock = []
    for port in (52, 53):
        try:
            with socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM) as s:
                s.settimeout(2)
                s.connect((2, port))
                vsock.append(f"connected to CID 2 port {port}")
        except OSError:
            pass
    results["no vsock to host"] = (not vsock, "; ".join(vsock) or "connects to CID 2 fail")
    disks = sorted(d for d in os.listdir("/sys/block") if d.startswith("vd"))
    results["only its own disks"] = (disks == ["vda", "vdb", "vdc"], f"disks: {disks}")

    # Runtimes: only the one its files asked for; the image has none of its own.
    others = [t for t in ("node", "perl", "python2", "ruby", "php") if shutil.which(t)]
    results["no other interpreter"] = (not others, f"found: {others}" if others else "none found")
    return {name: {"refused": ok, "detail": detail} for name, (ok, detail) in results.items()}


class Probe(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps(probes() if self.path == "/probe" else {"ok": True}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


# A second listener: the host must not reach any port but 8080.
def side_listener():
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("", 8081))
    s.listen()
    while True:
        conn, _ = s.accept()
        conn.sendall(b"side door\n")
        conn.close()


import threading

threading.Thread(target=side_listener, daemon=True).start()
http.server.ThreadingHTTPServer(("", PORT), Probe).serve_forever()
