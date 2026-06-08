# Verify a release

Realness ships a **build manifest** - a JSON file listing every file in `dist/` and its SHA-256 checksum. Anyone can confirm that `https://realness.online` serves the same bytes as a tagged release.

**Roadmap:** A fuller "verify any instance" tool (CLI, `/verify` page, release trust) is planned in [verify-instance-plan.md](./verify-instance-plan.md).

## What is in the manifest?

`build-manifest.json` includes:

- `version` - from `package.json` (matches the version in the app header)
- `git_commit` - full git SHA of the tree that was built
- `built_at` - ISO timestamp when the manifest was generated
- `bundle_sha256` - hash over all path + digest pairs (one-line fingerprint)
- `files` - map of URL path (e.g. `/assets/index-abc.js`) to `sha256:...`

The manifest is **not** a diff of `main` vs production. It attests to a **specific build** (one commit, one `npm run build`).

## How we produce it

After `npm run build`, `node scripts/build-manifest.js` walks `dist/`, hashes each file, and writes `dist/build-manifest.json`. Deploy uploads `dist/` to Firebase Hosting, so the manifest is live at:

https://realness.online/build-manifest.json

Release flow: build, deploy, then attach the same file to the GitHub release for that version.

## Verify production (no local build)

```bash
npm run verify:deploy
```

Or:

```bash
node scripts/verify-deploy.js --url https://realness.online
```

This fetches the manifest from the site, downloads each listed path, hashes the body, and reports mismatches.

## Verify against a release you built locally

```bash
git checkout v2.5.0
npm ci
npm run build
node scripts/verify-deploy.js --manifest dist/build-manifest.json --url https://realness.online
```

If every file matches, production is that build. If `main` has moved since deploy, rebuild from the tag instead of tip of `main`.

## Compare source to production

Source code alone cannot be compared to the live site. Rebuild from the commit in `git_commit`, then either:

1. Compare local `dist/build-manifest.json` to the one on the site, or
2. Run `verify-deploy` with `--manifest dist/build-manifest.json`.

Use the same Node version and `package-lock.json` for reproducible hashes.
