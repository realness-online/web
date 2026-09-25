"""Command line for the session orchestrator.

    sudo python3 -m orchestrator serve --volume /opt/fc/sessions/mnt
    sudo python3 -m orchestrator seed  --volume /opt/fc/sessions/mnt --rebuild

`serve` builds the seed if there is not a matching one, then answers on the
host's network: the HTTP API on `--port`, the framed terminal stream on
`--pty-port`, and the browser terminal on `--web-port`. `seed` stops after
building it, which is what host provisioning wants. Defaults are the dev loop's
paths, which live in the fc-local Lima guest (the dev stack script sets them up).
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import threading

from . import door, pty, server, sessions, webterm


def add_shared_arguments(parser):
    parser.add_argument("--volume", default="/opt/fc/sessions/mnt",
                        help="mounted xfs sessions volume")
    parser.add_argument("--template", default="/opt/fc/template.ext4",
                        help="template rootfs the seed copies")
    parser.add_argument("--kernel", default="/opt/fc/vmlinux-6.1.155")
    parser.add_argument("--firecracker", default="/opt/fc/firecracker")
    parser.add_argument("--guest-mac", default="06:00:AC:10:00:02",
                        help="the template's MAC; fcnet-setup.sh derives its address")
    parser.add_argument("--guest-cid", type=int, default=3)
    parser.add_argument("--vsock-port", type=int, default=52)
    parser.add_argument("--vcpu", type=int, default=2)
    parser.add_argument("--mem-mib", type=int, default=512)
    parser.add_argument("--tap-prefix", default="fc-tap")
    parser.add_argument("--seed-tap", default="fc-tap0", help="owned by net-up.sh")
    parser.add_argument("--boot-timeout", type=float, default=60.0,
                        help="seconds to wait for the guest agent")
    parser.add_argument("--api-timeout", type=float, default=30.0,
                        help="seconds for one Firecracker or guest call")


def parse_args(argv):
    parser = argparse.ArgumentParser(prog="orchestrator", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    serve_parser = sub.add_parser("serve", help="build the seed if needed, then serve the API")
    add_shared_arguments(serve_parser)
    serve_parser.add_argument("--listen", default="0.0.0.0")
    serve_parser.add_argument("--port", type=int, default=8080)
    serve_parser.add_argument("--pty-port", type=int, default=8081,
                             help="framed terminal stream (see orchestrator/pty.py)")
    serve_parser.add_argument("--web-port", type=int, default=8090,
                             help="browser terminal: page + websocket (orchestrator/webterm.py)")

    seed_parser = sub.add_parser("seed", help="build the seed snapshot and exit")
    add_shared_arguments(seed_parser)
    seed_parser.add_argument("--rebuild", action="store_true",
                            help="rebuild even if the fingerprint matches")

    return parser.parse_args(argv)


def build_store(args):
    store = sessions.SessionStore(
        volume=args.volume,
        template=args.template,
        kernel=args.kernel,
        firecracker_binary=args.firecracker,
        guest_mac=args.guest_mac,
        guest_cid=args.guest_cid,
        vsock_port=args.vsock_port,
        vcpu_count=args.vcpu,
        mem_mib=args.mem_mib,
        tap_prefix=args.tap_prefix,
        seed_tap=args.seed_tap,
        boot_timeout=args.boot_timeout,
        api_timeout=args.api_timeout,
    )
    warning = store.reflink_warning()
    if warning:
        logging.getLogger("orchestrator").warning(warning)
    return store


def main(argv=None):
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        stream=sys.stdout,
    )
    args = parse_args(sys.argv[1:] if argv is None else argv)
    store = build_store(args)

    if args.command == "seed":
        record = store.ensure_seed(rebuild=args.rebuild)
        logging.getLogger("orchestrator").info("seed ready: %s", record["record"])
        return 0

    store.ensure_seed()
    pty_server = pty.make_server(store, args.listen, args.pty_port)
    threading.Thread(target=pty_server.serve_forever, daemon=True).start()
    web_server = webterm.make_server(args.listen, args.web_port, args.pty_port,
                                     new_session=store.create)
    threading.Thread(target=web_server.serve_forever, daemon=True).start()
    # Requests a session makes of its host, e.g. `brayness publish`.
    the_door = door.Door(store, site_url=os.environ.get("BRAYNESS_SITE_URL", "/s/{id}/"))
    threading.Thread(target=the_door.serve_forever, daemon=True).start()
    server.serve(store, args.listen, args.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())