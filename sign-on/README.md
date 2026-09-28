# Brayness sign-on

The page a person signs in on: a mobile number, a six-digit code, then a
hand-off to a program on the same computer.

Vue 3, Vite, Vitest, plain CSS. Built to static files, deployed to Firebase
Hosting.

```sh
npm install
npm test
npm run build      # writes dist/
npm run deploy     # build, then deploy to realness-development
```

## Hosting

Hosted at `https://brayness-sign-on.web.app`, a separate Hosting site in
`realness-development` so it does not touch the realness site.

```sh
firebase hosting:sites:create brayness-sign-on --project realness-development
```

## The hand-off

A waiting program listens on `127.0.0.1` and opens
`/sign-on?cli=<port>&state=<state>`. After the person confirms, the page POSTs
`refresh_token` and `api_key` to `http://127.0.0.1:<port>/callback` with the
same state. A top-level form POST, so nothing lands in history and a navigation
to loopback needs no local-network permission.

`brayness login` in the sync package is that waiting program.

## Config

Copy `.env.example` to `.env` and fill in the Firebase client config for the
identity project. These are public values.
