# File ownership (o8)

Who reads and writes stored bytes today, before o10 moves them. Each row says
which keys, who owns them, and which path reaches them. The migration (o10) and
the deny-all rules (m3) must cover every row.

## Keys

| Prefix                                            | Owner                   | Written by                                                    | Read by                                        |
| ------------------------------------------------- | ----------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `people/+A/` (harness, vault, work)               | the person              | sync (`src/files/client.js`)                                  | sync                                           |
| `people/+A/` posters, statements, events, history | the person              | browser Firebase SDK (`src/app/utils/serverless.js` `upload`) | anyone, by download URL                        |
| `people/+A/relations.html(.gz)`                   | the person              | browser SDK                                                   | owner only (`storage.rules` `is_private_name`) |
| `people/+A/rights.html`                           | the person              | sync                                                          | `can()` (`src/can/rights.js`)                  |
| `subscriptions/+A/<id>`                           | the person              | browser SDK (`src/app/use/push.js`)                           | owner; push sender (functions)                 |
| `orgs/+name/`                                     | org founder and members | sync org routes                                               | members (`src/can/members.js`)                 |
| `orgs/+name/members.html`                         | founder                 | sync org routes only                                          | sync, on every request                         |
| `commons/+name/`                                  | org founder             | `POST v1/publish`                                             | anyone                                         |
| `trash/people/+A/<day>/<time>/`                   | the person              | sync, on delete (sy15)                                        | owner (`realness trash`)                       |
| `trash/orgs/+name/<day>/<time>/`                  | founder                 | sync, on delete                                               | founder                                        |
| `admins.html`                                     | global admins           | by hand, through sync                                         | sync                                           |

## Paths that reach storage

| Path                                                                                       | Credentials                     | Goes away at                      |
| ------------------------------------------------------------------------------------------ | ------------------------------- | --------------------------------- |
| Sync service (`server/sync`, `src/sync/server.js`)                                         | service account, Cloud Run      | stays: the only storage holder    |
| Browser Firebase SDK: `upload`, `remove`, `directory`, `metadata`                          | Firebase Auth user              | m1 (private), m2 (public)         |
| Download-token URLs (`getDownloadURL` in `src/app/utils/itemid.js`, `serverless.js` `url`) | token in the URL, never expires | m2, then m3 revokes               |
| Functions (`functions/src/utils/firebase.js`)                                              | Admin SDK                       | review in o10; move to sync calls |
| `@realness.online/store/firebase` move (`src/app/persistence/store-backend.js`)            | Firebase Auth user              | m1                                |

## References that name a stored file

- itemids (`/+A/posters/<time>`) resolve to keys in `src/app/utils/itemid.js`.
- Download URLs cached in IndexedDB (`forget_download_url`); stale after o10.
- Sync records: `.pi/agent/state/sync/*.json`, keyed by server and folder.
- Pi sessions: `.pi/agent/sessions/`, synced under `people/+A/harness/`.
- `starter.json`: sha256 hex manifest of stock harness files.

## Gaps for o10

- Two writers share `people/+A/`: sync and the browser SDK. o10 picks one.
- Download URLs outlive any rule change; m3 must revoke the tokens.
- `relations.html` privacy lives only in `storage.rules`; m1 moves it behind `can()`.
