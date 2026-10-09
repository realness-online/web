# Signing and notarizing the Mac binary

Getting a downloaded `brayness-mac` to open on a stranger's Mac took two days
(Sept 21-22, 2026). This is what worked and what broke along the way.

## Steps

```bash
bash apps/brayness/tools/desktop/build.sh      # universal binary -> artifacts/brayness-product/brayness-mac
bash apps/brayness/tools/desktop/sign.sh       # Developer ID + hardened runtime + entitlements.plist
bash apps/brayness/tools/desktop/notarize.sh   # zip, submit, wait for Accepted
bash apps/brayness/tools/desktop/gatekeeper-check.sh artifacts/brayness-product/brayness-mac
```

Order matters. Any change to the binary voids the signature, and a re-sign
voids the notary ticket. After a rebuild, run all three again.

## One-time setup

- **Identity:** "Developer ID Application: Scott Fryxell (FHE652UPZG)" in the
  login keychain. `sign.sh` finds it; override with `BRAYNESS_SIGN_IDENTITY`.
- **Notary profile:** `xcrun notarytool store-credentials brayness-notary`
  with an app-specific password (see the header of `notarize.sh`).
- **Key material:** `~/.private_keys/brayness-signing/` holds the private key,
  the certificate request, the Developer ID and G2 CA certificates, and the App
  Store Connect API key (`AuthKey_V4H22R578J.p8`). Apple lets you download the
  `.p8` only once, so keep a backup. Nothing uses it today.

## What went wrong

1. **Unsigned (ad hoc) builds get killed.** A quarantined copy exits 137.
2. **Signed without notarization is still refused.** Also exit 137.
3. **Signed and notarized, arm64 only: passed.** This build was never tested
   on Intel.
4. **Universal build, `allow-jit` only: the x86_64 slice crashes.** V8 on x86_64
   flips pages with `mprotect` instead of mapping a JIT region, so it dies with
   `Check failed: 12 == (*__error())` (exit 133). It needs
   `allow-unsigned-executable-memory` and `disable-executable-page-protection`
   as well. arm64 runs fine without them, which is why every local test passed.
   See `entitlements.plist`.
5. **Never add `get-task-allow`.** The notary service rejects it.

## Gotchas while testing

- **Exit 142 is the Gatekeeper dialog.** The binary didn't crash; macOS was
  still showing "could not verify".
- **Tickets take time to arrive.** After `Accepted`, about five minutes passed
  before `syspolicyd` logged `Inserting ticket`. Test too early and you get
  the refusal dialog.
- **A bare executable can't have a ticket stapled to it.** The first launch
  must be online so macOS can fetch the ticket.
- **`spctl` always rejects a bare executable** ("does not seem to be an app"),
  even when it's good. The real test is whether it runs from a quarantined copy.
  `gatekeeper-check.sh` does exactly that.
- **Check cdhashes per architecture.** Split the binary with
  `lipo -thin <arch>`, then compare `codesign -dvvv` against the ticket. In
  our case both slices matched, which ruled out a ticketing gap.
- **Test machines serve stale copies.** Safari got a 304 and reused an old
  zip. Serve under a fresh name (for example `brayness-mac-<submission id>.zip`)
  and compare `shasum -a 256` hashes.
- **`curl` sets no quarantine flag**, so it skips Gatekeeper. Use it to test
  the signature and entitlements alone, then double-click for the real test.
- **Browsers write different quarantine flags:** Safari writes `0083`, Brave
  writes `0281`. Every refused launch had a flag; the run that worked had
  none. Whether a non-Safari flag blocks the ticket lookup is still untested.
- **A test Mac with a wrong clock** can misjudge ticket timestamps. Turn on
  automatic date and time first.

When a launch is refused, check the test Mac's log:

```bash
log show --predicate 'subsystem == "com.apple.syspolicy"' --last 5m --info \
  | grep -iE 'ticket|reachability'
```

It shows whether the Mac reached Apple, and whether it got a ticket.

## Proven

Notarized as submission `35f36c5a`, with both slices ticketed. Opened on this
Mac (arm64, plus x86_64 under Rosetta), on a real Intel laptop, and on a
second Mac belonging to someone else.
