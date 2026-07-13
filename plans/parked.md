# Parked — Deferred Items

_Created 2026-06-28. Items from the finishing-touches plan that are explicitly
deferred until there are active users, revenue, or other triggering signal.
See `docs/plans/finishing-touches-plan.md` for the full plan and context._

---

## Legal / human gates (post-users)

These are the items from item #13 that were built up to drafting but the
human/paperwork steps are deferred until realness.online has active users.

**DMCA agent registration.** Terms §9 already names `security@realness.online`
as the agent, but the safe harbor isn't perfected until the agent is registered
with the U.S. Copyright Office ($6, ~15 min). Deferred — not worth the
paperwork until there are users posting content.

**E&O / cyber insurance.** The plan's protection stack identifies insurance as
the real liability backstop (behind §230 and the TOS). Deferred until there's
revenue or active users to insure against.

**DBA filing.** "Scott Fryxell, doing business as Realness" may require a
fictitious business name filing in California. Revisit when there's revenue.

**Outside counsel / attorney review.** The `docs/plans/attorney-review.md` package
(H-1–H-4, M-8) is ready for a California attorney when the time comes. No
outside counsel needed until the service is live with users.

---

## Product features (deferred)

**Passkey authentication (#19).** WebAuthn RP in `realness-functions` with
`@simplewebauthn/server` and Firebase custom tokens. Deferred — not building
for now. Firebase phone OTP is sufficient.

**Twilio Lookup phone validation (#20).** Port from seeq-app to block
VoIP/virtual numbers at sign-in. Deferred — not worth the Twilio cost and
complexity without active users.

**Custom phone number / Twilio Verify (#21).** Considered and **closed** —
staying with Firebase OTP. No dedicated Realness number for now.

**PWA share target.** Receive images from the OS share sheet straight into the
tracer. Add `share_target` (POST, `multipart/form-data`, `files: image/*`) to
the manifest; a service-worker handler stashes the file and redirects to
`/share-target`, which feeds the existing `add_to_queue` path. `generateSW`
means the POST handler needs `importScripts` (same pattern as
`public/push-handlers.js`) or a runtime route. Deferred — no iOS Safari
support, so it only helps Android and installed desktop Chromium.

---

## Non-blocking refinements (post-launch backlog)

**Storage listing size.** Firebase's list API response (~51 KB, ungzipped by
Google) is dominated by layer-variant files (`*-bold.svg`, shadows, cutouts)
filtered client-side in `Directory.js`. Moving variants into a subfolder would
let the delimiter exclude them.

---

## Moderator tooling (post-release)

**Moderator logs and admin UI** `L` — optional moderator-facing surface for
investigating instance state, modeled on seeq-app (`/admin`, `docs/logging.md`).
Realness is per-instance: scope to the moderator (`VITE_ADMIN_ID`), not a
central platform admin. Only relevant when `realness-functions` is deployed.
Candidates:

- **Cloud Logging viewer** — structured JSON from `realness-functions`
  (`log_debug` / `log_warn` / `log_error` pattern); client errors via callables
  (`log`, `error`); `list_logs` querying Cloud Logging. Table with severity
  filter, expandable rows, last-24h scroll.
- **Sybil / sign-in** — VoIP denial log from `check_phone_integrity`; optional
  `integrity.suspicious` review queue.
- **Push** — broadcast results from scheduled `notification` (sent / pruned /
  failed).
- **Capabilities** — live `/capabilities` manifest vs what the app shows.

Write `docs/moderator-admin-plan.md` before build.
