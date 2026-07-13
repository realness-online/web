# Verify Instance

Status: active
Related: finishing-touches — "verify instance"

## Goal

Anyone hosting or using Realness should answer:

1. **What version is this?** (e.g. `2.5.0`, git SHA)
2. **Does it match a known good build?** (checksums agree)
3. **Is this the official app or a self-hosted fork?** (origin + optional publisher trust)

The tool should work for:

- `https://realness.online`
- A team instance (`https://our-union.realness...` or custom domain)
- Local preview (`http://localhost:5173` after `npm run build && npm run serve`)

Related today: [verify-release.md](../docs/verify-release.md) (manifest format and `verify-deploy.js`).

## Current state

Phase 0 done or in progress:

- `scripts/build-manifest.js` runs after `npm run build`
- `dist/build-manifest.json` deploys with Firebase Hosting
- `scripts/verify-deploy.js` + `npm run verify:deploy` (defaults to realness.online)
- `docs/verify-release.md` for manual steps
- About page links to manifest and docs

Gaps:

- Manifest not on production until next deploy
- GitHub release may not yet attach manifest every time
- No UI, no arbitrary-instance UX, no trust registry

### What "legit" means

| Check                    | Pass means                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------- |
| **Manifest present**     | `{origin}/build-manifest.json` exists and parses                                   |
| **Files match manifest** | Every path in `files` hashes to the listed `sha256:` on that host                  |
| **Known release**        | `version` + `git_commit` match a GitHub release or tagged build we publish         |
| **Bundle fingerprint**   | `bundle_sha256` matches the release artifact (fast single-field check)             |
| **Version in UI**        | In-app version (Thoughts header) matches manifest `version` (optional cross-check) |

Legit does **not** mean "equals `main` today." It means "equals **this** tagged release commit after a standard build."

### Manifest contract (stable for tools)

Path: `/build-manifest.json` on the instance origin.

```json
{
  "version": "2.5.0",
  "git_commit": "full40charsha",
  "built_at": "ISO-8601",
  "origin": "https://realness.online",
  "bundle_sha256": "sha256:...",
  "files": {
    "/index.html": "sha256:...",
    "/assets/index-abc123.js": "sha256:..."
  }
}
```

Future optional fields (Phase 3+):

- `manifest_schema`: `1`
- `publisher`: `realness-online` (for hosted-community instances)
- `signature`: detached sig over canonical JSON (see below)

Tools should tolerate unknown keys.

## Approach

### Product surfaces

| Surface                                                             | Audience               | Notes                               |
| ------------------------------------------------------------------- | ---------------------- | ----------------------------------- |
| **CLI** `realness-verify` or `npm run verify:instance -- --url URL` | Developers, moderators | Extends `verify-deploy.js`          |
| **Web page** `/verify` on realness.online                           | Anyone                 | Paste URL, see green/red report     |
| **npm package** (later)                                             | CI, community scripts  | Thin wrapper over same core library |

### Core library (`src/verify/` or `scripts/lib/verify-instance.js`)

```js
verify_instance({
  instance_url,           // required, e.g. https://realness.online
  trust_manifest_url,     // optional: GitHub release manifest to compare against
  trust_release_tag,      // optional: v2.5.0 → fetch release asset
  sample_only,            // optional: only check bundle_sha256 + index.html + main chunk
  on_progress             // optional callback for UI
}) → {
  ok: boolean,
  instance: { version, git_commit, bundle_sha256, origin },
  checks: [{ id, label, ok, detail }],
  mismatches: [{ path, expected, actual }]
}
```

Checks run in order; fail fast optional for CLI, full report for UI.

### CLI UX (Phase 1)

```bash
# Default: verify host against its own manifest
npm run verify:instance -- --url https://realness.online

# Compare instance to official release manifest (from GitHub)
npm run verify:instance -- \
  --url https://our-community.example \
  --release v2.5.0

# Quick fingerprint only (fewer HTTP requests)
npm run verify:instance -- --url https://realness.online --quick
```

Output:

```text
Instance:  https://realness.online
Version:   2.5.0
Commit:    abc123...
Bundle:    sha256:...  OK
Files:     142/142 OK
Release:   matches github.com/realness-online/web v2.5.0  OK
Result:    LEGIT
```

Non-zero exit code on failure for CI.

### Web UX (Phase 2)

Route: `/verify` (or linked from About footer).

```
[ https://realness.online          ] [ Verify ]

Checks
  ✓ Manifest loaded
  ✓ 142 files match manifest
  ✓ Matches release v2.5.0 (GitHub)
  ✗ In-app version says 2.4.0 (stale cache?)  ← optional

Learn more → verify-release.md
```

- No sign-in required
- Runs client-side fetches to the **target origin** (CORS must allow or use a tiny same-origin proxy on our host only for the checker page)
- For third-party instances, user pastes URL; we never send their data server-side if client-side is enough

**CORS note:** Verification fetches static assets on the target host. If `build-manifest.json` is served with permissive CORS (or from same origin when verifying self), browser verification works. For cross-origin instances, Phase 2 may need `Access-Control-Allow-Origin` on manifest + assets, or a "copy manifest URL" flow that runs CLI locally.

### Trust sources (Phase 2–3)

| Source                         | Use                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Self manifest**              | Instance hosts `/build-manifest.json`; tool verifies files on same origin                             |
| **GitHub release asset**       | `build-manifest.json` attached to `vX.Y.Z` - compare instance to upstream                             |
| **Published fingerprint list** | Small JSON in repo `releases/fingerprints.json` mapping `bundle_sha256` → version (fast mirror check) |
| **Signed manifest** (later)    | Sigstore / minisign on manifest; tool ships public key                                                |

Official realness.online should pass both self-check and GitHub release match after each deploy.

### Phases

#### Phase 1 - CLI "verify instance" (next)

- [ ] Rename or wrap `verify-deploy.js` → `verify-instance.js` with `--url` required
- [ ] `--release vX.Y.Z` downloads manifest from GitHub release assets
- [ ] `--quick` checks `bundle_sha256` + `index.html` + largest `/assets/*.js` only
- [ ] Human-readable summary + JSON `--format json` for CI
- [ ] Document in `verify-release.md` and package.json script `verify:instance`
- [ ] Attach manifest on every `release:gh` in release checklist

#### Phase 2 - `/verify` page

- [ ] Vue view or static page
- [ ] Input: instance URL; optional: expected release tag
- [ ] Reuse core verify library (import from `src/verify/` if used in browser - may need to duplicate hash logic without Node fs)
- [ ] Link from About footer ("Verify an instance")
- [ ] i18n-free, minimal copy

#### Phase 3 - Publisher and communities

- [ ] `publisher` field in manifest for licensed hosts
- [ ] Doc: community moderators run verify before pointing members at an instance
- [ ] Optional allowlist file in repo for known community origins (not required for legitimacy, only for "recognized host")

#### Phase 4 - Signed manifests

- [ ] Sign `build-manifest.json` at release time
- [ ] Tool verifies signature before checksum loop
- [ ] Key rotation doc

### Instance types

| Type                   | Verify against                                                        |
| ---------------------- | --------------------------------------------------------------------- |
| Official               | GitHub release manifest + self manifest                               |
| Self-hosted (licensed) | Self manifest; optional `--release` to prove they ship upstream build |
| Dev / localhost        | Self manifest only; expect different `origin`                         |
| Unknown                | Self manifest only; warn if no matching GitHub release                |

### Security and limits

- Verification proves **static deploy integrity**, not runtime behavior (no proof that Firebase rules, Stripe, or API keys are honest).
- A malicious host could serve a good manifest once and bad JS to targeted users - mitigated by checking **all** listed files, not just manifest (full mode).
- Service worker cache: verifier uses `cache: 'no-store'`; document hard-refresh for humans.
- Do not log instance URLs with PII in analytics.

### Open questions

1. **CORS** on community domains - require hosts to set headers, or CLI-only for third parties?
2. **Partial manifests** for large deploys - is `--quick` enough for "legit enough" or always full?
3. **In-app version** - inject `git_commit` into UI next to `2.5.0` for one-glance check?
4. **Separate package** - publish `@realness.online/verify` or keep scripts in monorepo?
5. **Wasm/workers** - include in manifest always (already in `dist/` walk)?

## Out of scope

- Proving runtime honesty of Firebase rules, Stripe, or API keys.
- Claiming the deploy "matches `main`" in user-facing copy.

## Verification

- Moderator can paste a community URL into `/verify` or run one CLI command and get a clear LEGIT / NOT LEGIT result.
- Official deploy fails CI if `verify:instance` does not pass before or after deploy.
- README and About link to this plan and `docs/verify-release.md`.
- No claim of "matches main" in user-facing copy - only version, commit, and checksums.

### References

- [verify-release.md](../docs/verify-release.md) - how to run verification today
- `scripts/build-manifest.js` - manifest generator
- `scripts/verify-deploy.js` - Phase 0 verifier
- About footer - `build-manifest.json`, link to this plan when shipped
