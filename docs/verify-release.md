# Verify a release

Realness ships a **build manifest** - a JSON file listing every file in `dist/` and its SHA-256 checksum. Anyone can confirm that `https://realness.online` serves the same bytes as a tagged release.

**Roadmap:** A fuller "verify any instance" tool (CLI, `/verify` page, release trust) is planned in [verify-instance.md](../plans/verify-instance.md).

## What this proves

| Root of trust                     | What a pass means                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| GitHub Release manifest (default) | Live site bytes match the release asset on GitHub, not a claim from the site itself    |
| Local `dist/build-manifest.json`  | Live site matches the build on your machine (deploy gate, or after you rebuild a tag)  |
| Site manifest (`--from-site`)     | Live files match the site's own manifesto only - consistency, not independent evidence |

GitHub is the independent root for outsiders. The site alone can rewrite both files and manifesto together.

## What is in the manifest?

`build-manifest.json` includes:

- `version` - from `package.json` (matches the version in the app header)
- `git_commit` - full git SHA of the tree that was built
- `built_at` - ISO timestamp when the manifest was generated
- `bundle_sha256` - hash over all path + digest pairs (one-line fingerprint)
- `files` - map of URL path (e.g. `/assets/index-abc.js`) to `sha256:...`

OS junk (`.DS_Store`, `Thumbs.db`, other dotfiles) is stripped from `dist/` and never listed. `verify:deploy` also skips those paths if an older manifest still lists them.

The manifest is **not** a diff of `main` vs production. It attests to a **specific build** (one commit, one `npm run build`).

## How we produce it

After `npm run build`, `node scripts/build-manifest.js` walks `dist/`, hashes each file, and writes `dist/build-manifest.json`. Deploy uploads `dist/` to Firebase Hosting, so the manifest is also live at:

https://realness.online/build-manifest.json

Release flow: build, deploy (local-manifest verify), then attach the same file to the GitHub release:

```bash
gh release create $npm_package_version dist/build-manifest.json
```

`npm run deploy` ends with a local-manifest check (operator gate):

```bash
node scripts/verify-deploy.js --manifest dist/build-manifest.json --url https://realness.online
```

## Verify production (GitHub as root of trust)

```bash
npm run verify:deploy
```

Same thing, explicit:

```bash
node scripts/verify-deploy.js --release --url https://realness.online
```

- `--release` alone uses `package.json` version
- `--release 2.5.8` or `--release v2.5.8` pins a tag
- `--release latest` uses the newest GitHub release that has a `build-manifest.json` asset
- `--repo owner/name` overrides the default (`realness-online/web`)

This downloads the manifest from GitHub Releases, then hashes each listed path on the live site.

## Site-only consistency check

```bash
npm run verify:deploy:site
```

Fetches the manifesto from the site. Useful as a smoke test; not independent evidence.

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

1. Compare local `dist/build-manifest.json` to the GitHub release asset, or
2. Run `verify-deploy` with `--manifest dist/build-manifest.json`.

Use the same Node version and `package-lock.json` for reproducible hashes.
