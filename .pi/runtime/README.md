# Pinned Pi runtime

This directory holds the reviewed custom Pi release for a clean checkout.
It is separate from personal state under `.pi/agent/` and from selected local
fork installations. Do not commit `node_modules/`.

- `package.json` selects local fork archives, including workspace overrides.
- `package-lock.json` locks all runtime dependencies.
- `release.json` records the fork commit, upstream tag and commit, and archive SHA-256 hashes.
- `tarballs/` contains the fork packages. Startup never downloads stock Pi.

Root `npm install` verifies the archives and runs `npm ci --ignore-scripts` here.
Root `npm start` uses this install unless a development fork is selected.
Close sessions that use this runtime before reinstalling it. The current
workspace's separate selected-fork installation is not changed by this installer.

## Deliberate updates

1. Select an upstream release in the maintained source fork. Follow `work/pi/FORK.md`.
2. Review the source and dependency changes. Preserve the previous verified release for rollback.
3. Run the fork's checks, offline build, and custom-session tests.
4. Pack the public workspace packages. Record exact fork/upstream commits and archive hashes.
5. Preserve the existing runtime dependency versions unless a dependency change is approved.
6. Verify an isolated install, SDK, CLI, compressed write/resume, and read-only decoder.
7. Review the archive list and lockfile before approving the new repository pin.

`npm run pi:update` only reinstalls this pin. It does not choose an upstream
release. Provider credentials must come from each user, never from this package.

Current release evidence is local at `artifacts/pi/release-v1.4.0/`.
The selected 1.4.0 fork commit is `08620a3b1e98130c99906789bb56193f765cb429`.
The previous 1.3.0 pin (fork `c35c4079`) stays in git history for rollback.
macOS clean-install and RPC startup checks passed. Linux and WSL remain untested.
