# Personal file capabilities

The first personal capability adapter for `brayness`. It reuses the existing sync client, sign-in, and service permissions. It does not replace the desktop harness command or the VM launcher yet.

## Commands

```bash
brayness files sync <local-folder> <can://~/folder/>
brayness files cat <can://~/file>
brayness files sync <local-folder> <can://~/folder/> --json
```

Sync is two-way. Both paths are required; nothing defaults to the whole harness. Only personal remote paths (`can://~/...`) are accepted. Destructive flags are not exposed by this adapter.

Sign-in uses the same keychain credentials as `brayness-store`. `SYNC_URL` selects the service; the existing development service is the default.

## Structured results

`--json` writes one object to stdout:

- Success: `{ "ok": true, "command": "files.sync", "result": { ... } }`
- Failure: `{ "ok": false, "command": "files.cat", "error": { "code": "service_error", "message": "...", "status": 404 } }`
- Sync conflicts exit nonzero and include the partial report in `result`.
- Reads return `path`, `encoding`, and `content`. Text uses UTF-8; binary content uses base64. Human `cat` writes the original bytes.

Codemode can invoke the public command through `tools.bash`. Check `exit_code` and truncation before parsing its output; completed writes are not undone by a later failure.

Other Node adapters can import `file_capabilities` from `src/files.js` and supply the existing authenticated client. That module holds the sync and read behavior; the CLI only routes arguments and formats results.

## Development

The package declares the public command as `brayness`. During this workspace's development, `artifacts/brayness/cli-bin/brayness` links to the executable. From the harness root, add that directory to the current shell:

```bash
export PATH="$PWD/artifacts/brayness/cli-bin:$PATH"
```

This is a local development entry point, not a global install or an actor-image change.

Run `npm run check` from `work/brayness/cli` for scoped extension checks and tests, or `npm test` for tests only. Tests invoke `brayness` by name against the real local sync service, disk storage, and signed test credentials. Scratch files and derived sync records stay under `artifacts/brayness/cli-tests/`. No cloud credentials or deployment are needed.
