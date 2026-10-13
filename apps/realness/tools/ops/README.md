# Realness operator tools

Functions live in `apps/realness/functions/`. Paths below are relative to the product root.
Run Functions commands there as `npm run test:functions`, `serve:functions`, `logs:functions`, or `deploy:functions`.
Traffic, ads, repair, and migration reporting are separate operator tools in this folder.

**Optional.** Server-side capabilities for Realness instances. Most moderators
never need this repo.

The web app (`realness`) is complete with Firebase Auth + Storage only. Deploy
this repo only when you want push notifications and/or Twilio phone integrity.
See the web app's [Optional server features](../../README.md#optional-server-features-realness-functions)
section for the decision table.

## When to use this repo

| Goal                                                  | Use this repo?                          |
| ----------------------------------------------------- | --------------------------------------- |
| Run Realness (posters, feed, phone auth, storage)     | **No** — deploy the web app only        |
| Web push (user opt-in + scheduled broadcast)          | **Yes**                                 |
| Block VoIP/virtual numbers at sign-in (Twilio Lookup) | **Yes**                                 |
| Stripe sponsorship                                    | **No** — hosted checkout in the web app |

If you deploy functions without configuring secrets, capabilities still flip
partially: `push` is `true` once functions are live, but broadcast needs
`VAPID_PRIVATE_KEY`; `phone_integrity` is `true` only when both Twilio secrets
are set.

## layout

```
functions/             firebase functions codebase (node 22, esm)
  index.js             named exports = deployed functions
  src/
    handlers/scheduled/ onSchedule handlers
    utils/             firebase (storage), push, log
firebase.functions.json  functions config
.firebaserc            project aliases
```

## functions

| name                  | type       | purpose                                          |
| --------------------- | ---------- | ------------------------------------------------ |
| capabilities          | onRequest  | public manifest of optional server features      |
| check_phone_integrity | onRequest  | Twilio Lookup gate before SMS sign-in            |
| notification          | onSchedule | broadcast a web-push notification to subscribers |

## capabilities

`GET /capabilities` returns JSON the app probes at boot on the **same origin**
(hosting rewrite in the web app's `firebase.json`):

```json
{ "push": true, "phone_integrity": false }
```

`push` is `true` whenever this repo is deployed to the instance's Firebase
project. `phone_integrity` is `true` only when Twilio Lookup credentials are
configured.

Web-only deploys ship `capabilities.json` with every flag false. Once this repo
is deployed to the same Firebase project, hosting serves the live manifest at
`/capabilities`.

The app gates UI and sign-in from these flags — see
`realness/src/use/instance-capabilities.js`. Do not add build-time env vars in
the web app for moderators; runtime probe is the source of truth.

## phone integrity (Twilio Lookup)

Optional Sybil hardening. The app calls `POST /check-phone-integrity` with
`{ "phone": "+15551234567" }` **before** Firebase sends an SMS code — only when
`phone_integrity` is true in `/capabilities`.

Lookup uses `line_type_intelligence` only (not SMS). Blocks non-mobile and
known VoIP carriers.

Twilio credentials are **Firebase Functions secrets** (Secret Manager), same
pattern as `VAPID_PRIVATE_KEY`:

```
firebase functions:secrets:set TWILIO_ACCOUNT_SID
firebase functions:secrets:set TWILIO_AUTH_TOKEN
```

Redeploy functions after both secrets exist in Secret Manager. Until then,
`phone_integrity` is false and `check_phone_integrity` returns 503.

Local emulator: copy `functions/.env.example` to `functions/.env` and fill in
the Twilio values. Point the web app at the emulator with
`VITE_FUNCTIONS_URL=http://127.0.0.1:5001/<project>/us-central1` (or your
emulator base URL).

## web push

The `notification` scheduled function signs notifications with a VAPID keypair. The
public half is a constant in source — `vapid_public_key` in both
`functions/src/utils/push.js` and the app's `src/use/push.js`, and the two must
be identical. Only the private key is a secret. Setup is two steps:

```
npx web-push generate-vapid-keys                  # generates the pair
# paste Public Key into vapid_public_key in BOTH repos (replace the placeholder)
firebase functions:secrets:set VAPID_PRIVATE_KEY  # paste Private Key here
```

Subscriptions are owner-only Storage files at `subscriptions/+<e164>/<id>.json`;
the broadcast prunes any that return 404/410.

## scripts

```
npm run serve:functions   # firebase emulators (functions)
npm --prefix functions run shell
npm run logs:functions    # tail logs
npm run deploy:functions -- --project <id>
```
