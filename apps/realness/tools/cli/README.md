# Personal file capabilities

The personal capability adapter for `realness`; `realness` remains a compatibility alias. It reuses the existing sync client, sign-in, and service permissions. It does not replace the desktop harness command or the VM launcher yet.

## Commands

```bash
realness files sync <local-folder> <can://~/folder/>
realness files cat <can://~/file>
realness files sync <local-folder> <can://~/folder/> --json
```

Sync is two-way. Both paths are required; nothing defaults to the whole harness. Only personal remote paths (`can://~/...`) are accepted. Destructive flags are not exposed by this adapter.

Sign-in uses the same keychain credentials as `realness-store`. `SYNC_URL` selects the service; the existing development service is the default.

## Service monitor

Run `npm run realness -- watch` from the product root. At the harness root,
`npm run realness` starts Pi instead.

The main view shows daily cost bars, the month's largest costs, actual cloud
machine power state, retained disk storage, and service problems. Routine agent,
account, sync, and billing-source details are behind `d`.

Billing covers the current invoice month, after credits, across all projects in
each configured export. Accounts without an export are outside this view. The
daily chart groups those charges by usage date; late adjustments can refer to an
earlier month. Credits can make a day's cost negative.

Cloud inventory reads the provider's machine and disk lists for configured and
billed projects. Agent "sleeping" or "idle" states never stand in for cloud
machine power state. Stopped machines still retain chargeable disks.

Model spend is the signed-in person's ledger, shown separately from cloud costs.

Billing is delayed. The screen shows the export's latest usage timestamp and
query time in details, and a short billing age in the main view. Billing queries
are cached for 15 minutes, service status for five minutes, and machine/disk
inventory for one minute. Query failures display unavailable; missing ledgers do not become zero.

Use `d` for details, `j` and `k` to scroll, `r` to refresh, and `u`, `m`, `h` for 15-second,
60-second, and five-minute local refresh intervals. Refresh does not bypass the
cloud caches. This monitor does not stop services or enforce a spending cap.

## Structured results

`--json` writes one object to stdout:

- Success: `{ "ok": true, "command": "files.sync", "result": { ... } }`
- Failure: `{ "ok": false, "command": "files.cat", "error": { "code": "service_error", "message": "...", "status": 404 } }`
- Sync conflicts exit nonzero and include the partial report in `result`.
- Reads return `path`, `encoding`, and `content`. Text uses UTF-8; binary content uses base64. Human `cat` writes the original bytes.

Codemode can invoke the public command through `tools.bash`. Check `exit_code` and truncation before parsing its output; completed writes are not undone by a later failure.

Other Node adapters can import `file_capabilities` from `src/files.js` and supply the existing authenticated client. That module holds the sync and read behavior; the CLI only routes arguments and formats results.

## Development

`tools/cli/bin/realness.js` is the public operator entry. The old
`tools/cli/bin/realness.js` forwards to it. From the product root:

```bash
npm run realness -- --help
npm run realness -- files cat <can://~/file>
```

This is a local development entry point, not a global install or an actor-image change.

Run root `npm run check:cli` for scoped checks and tests, or root `npm test` for the whole product. Tests invoke `realness` by name against the real local sync service, disk storage, and signed test credentials. Scratch files and derived sync records stay under `artifacts/realness/cli-tests/`. No cloud credentials or deployment are needed.
