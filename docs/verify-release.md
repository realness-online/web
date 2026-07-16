# Verify a release

Anyone can confirm that a live Realness instance serves the same bytes as a
tagged GitHub release - without trusting the site's own claims.

```bash
npm run verify
```

That downloads `build-manifest.json` from the newest GitHub release that has
one, then rehashes every listed file on `https://realness.online`.

```bash
npm run verify -- --url https://community.example
npm run verify -- --release 2.5.8
npm run verify -- --help
```

**Roadmap:** A `/verify` page and richer instance UX is planned in
[verify-instance.md](../plans/verify-instance.md).

## What this proves

| Root of trust                      | What a pass means                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| GitHub Release manifesto (default) | Live site bytes match the release asset on GitHub, not a claim from the site itself    |
| Local `dist/build-manifest.json`   | Live site matches the build on your machine (deploy gate)                              |
| Site manifesto (`--from-site`)     | Live files match the site's own manifesto only - consistency, not independent evidence |

GitHub is the independent root for outsiders. The site alone can rewrite both
files and manifesto together.

## What is in the manifesto?

`build-manifest.json` includes:

- `version` - from `package.json` (matches the version in the app header)
- `git_commit` - full git SHA of the tree that was built
- `built_at` - ISO timestamp when the manifesto was generated
- `bundle_sha256` - hash over all path + digest pairs (one-line fingerprint)
- `files` - map of URL path (e.g. `/assets/index-abc.js`) to `sha256:...`

OS junk (`.DS_Store`, `Thumbs.db`, other dotfiles) is stripped from `dist/` and
never listed. `npm run verify` also skips those paths if an older manifesto
still lists them.

The manifesto is **not** a diff of `main` vs production. It attests to a
**specific build** (one commit, one `npm run build`).

## Operator: publish so others can `npm run verify`

After `npm run build`, `dist/build-manifest.json` is generated. Deploy that
`dist/`, then attach **the same** manifesto to the GitHub release (do not
rebuild in between):

```bash
npm run deploy          # ends with a local-manifest check against production
npm run release:gh      # gh release create $version dist/build-manifest.json
```

Until a release has a `build-manifest.json` asset, `npm run verify` fails with
operator instructions. That is intentional - without the GitHub asset there is
no independent root of trust.

## Other checks

Deploy gate (local manifesto, not GitHub):

```bash
node scripts/verify-deploy.js --manifest dist/build-manifest.json --url https://realness.online
```

Site-only consistency (smoke test, not independent):

```bash
npm run verify:deploy:site
```

Flags:

- `--release` alone uses `package.json` version
- `--release 2.5.8` or `--release v2.5.8` pins a tag
- `--release latest` (default) uses the newest GitHub release that has a manifesto
- `--repo owner/name` overrides the default (`realness-online/web`)
