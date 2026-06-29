# Parked — Deferred Items

_Created 2026-06-28. Items from the finishing-touches plan that are explicitly
deferred until there are active users, revenue, or other triggering signal.
See `docs/finishing-touches-plan.md` for the full plan and context._

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

**Outside counsel / attorney review.** The `docs/attorney-review.md` package
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
