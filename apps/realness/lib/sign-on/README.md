# Brayness sign-on

Signing in happens on the Realness frontend, `frontend/`, at `/sign-on`.
Development serves it from `https://realness-development.web.app`.
This folder keeps the pieces other code imports.

- `src/browser/flow.js`: the phone and name steps. Realness supplies the
  profile adapter, which owns loading and saving.
- `src/node/login.js`: `brayness login`, the waiting program, and keychain
  credentials.
- `src/node/host-pass.js`: host and record passes.

The root package exports the Node entries only for Node. Browser builds can't
import them.

## The hand-off

A waiting program listens on `127.0.0.1` and opens
`/sign-on?cli=<port>&state=<state>`. After the person confirms, the page POSTs
`refresh_token` and `api_key` to `http://127.0.0.1:<port>/callback` with the
same state. A top-level form POST, so nothing lands in history and a navigation
to loopback needs no local-network permission.

`SIGN_ON_URL` overrides the sign-in site for the CLI.
