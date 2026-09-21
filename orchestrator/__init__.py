"""Brayness session orchestrator: fork microVM sessions from a seed snapshot.

Run it as a package from this directory (paths set up by the dev stack script):

    sudo python3 -m orchestrator serve --volume /opt/fc/sessions/mnt

Modules, in the order the work flows:

    host.py         the sessions volume, TAP devices, root
    firecracker.py  one Firecracker process and its unix-socket REST API
    vsock.py        the guest control channel (the same one f2 built)
    sessions.py     the seed, and a session's create/destroy cycle
    pty.py          the framed terminal stream into a session's pty
    webterm.py      the browser terminal: a websocket in front of pty.py
    server.py       the HTTP API
"""