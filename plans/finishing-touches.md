# Finishing Touches

Status: active
Related: none (launch spine; detail plans and `parked.md` hang off this list)

## Goal

Clear the pre-release punch list for the web app so realness.online can launch with auth, mask, discoverability, and optional platform features in known shape.

## Current state

Open items below. Mask work is detailed in `mask-subjects.md` (supersedes the mask checklist line). Verify-instance detail is in `verify-instance.md`. Deferred legal/product items live in `parked.md`.

Shipped recently (see `CHANGELOG.md`): critical code-review pass (`plans/code-review-findings.md`), mosaic app icon/logo.

## Approach

### Account & auth (web app only — no functions)

- [x] **notification opt-in in onboarding** `M` — added
      `components/profile/as-notification-prompt.vue`, mounted once at app
      root (`App.vue`, alongside the other lazy dialogs) rather than inside
      the sign-on flow — a device-scoped `notifications_prompted` preference
      gates it, and it watches `signed_in` (current_user + valid name)
      directly, so it fires once per device on whichever path gets someone
      there first: new sign-up, an existing account on a new device, or a
      fresh install (including an already-authenticated session, e.g.
      Android installs that share browser storage). States the cadence
      (Thursdays, Pacific time). Web-only instances skip it (`push`
      capability off); already-decided devices (`on`/`blocked`) skip it too.
      The Account/Preferences toggle (`components/account/as-notifications.vue`,
      inside `preferences-menu.vue`) stays as the durable control — confirmed
      it's not buried on Account, Documentation, or About views.

### Mask & canvas

- [ ] **finish mask functionality** `L` — see `mask-subjects.md` (named subjects,
      persistence, layer export). Pen draw/erase completeness lives there.
      Mobile zoom (its dependency) has shipped.

### Community

- [x] **reach out to vtracer creator** `S` — emailed Chris Tsang
      (`chris.2y3@outlook.com`) thanking him and pointing to the docs credit.
- [x] **reach out to potrace creator** `S` — emailed Peter Selinger
      (`selinger@users.sourceforge.net`).
      `docs/security.md` updated per Stripe decision.

### Platform

- [~] **verify instance** `L` — see `verify-instance.md`. Extends
  `scripts/verify-deploy.js`, `build-manifest.js`; `/verify` page and/or CLI.
  Mid-work.

Decision table and deploy steps:
[README — Optional server features](../README.md#optional-server-features-realness-functions).

- [ ] **verify phone integrity (Twilio Lookup)** `M` — code landed
      (`check_phone_integrity`, capability-gated in `as-form-mobile.vue`) but
      **not confirmed in production**. `realness-functions` is deployed and
      ACTIVE on `realness-online`, but Secret Manager has no Twilio secrets
      yet — `/capabilities` still reports `phone_integrity: false`.
      Investigation before flipping it on surfaced real hardening gaps (see
      `realness-functions` git history / this session): - **Fail-closed**: any Twilio failure (bad keys, unpaid bill, outage)
      returns 502 → client shows "unavailable" and blocks sign-in
      site-wide, not just the one lookup. Still an open product decision
      (fail-open vs fail-closed for lookup _errors_ specifically). - **No abuse protection**: `check_phone_integrity` is a public
      `onRequest` endpoint, `cors: true`, no App Check, no rate limit — a
      scripted loop burns real Twilio spend and can drain the balance,
      which then triggers the fail-closed outage above. Firebase App Check
      is the standard fix; not yet implemented. - **E.164 validation** — fixed. Non-E.164 phone strings now get a 400
      before any Twilio call. - **Twilio balance/spend alert** — not code, a Twilio console setting;
      not yet configured. - Role-based moderator check needed for the review-queue/logs backlog
      below is tracked separately in `parked.md` (not needed to turn this
      on, only for the moderator-tooling items). - **Test coverage added**: `realness-functions/functions` had zero test
      infrastructure; added Vitest (mirrors `realness`'s house style —
      `tests/` mirrors `src/`, `vi.mock`/`vi.hoisted`, 80/80/80/80 coverage
      gates) and wrote full specs for every handler/service/util —
      56 tests, 100% statements/lines/functions, 98.6% branches (the one
      gap is dead code in `log.js`, not a real gap). Refactored the three
      `onRequest`/`onSchedule` exports to also export a plain inner handler
      function so tests can call it directly without fighting the `cors`
      middleware wrapper.
      To verify once hardening + secrets land: set
      `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`, redeploy, confirm
      `/capabilities` returns `phone_integrity: true`, then E2E sign-in
      (mobile passes; VoIP/virtual blocked before SMS). **Not a launch
      blocker** for web-only instances. Post-verify backlog: signup velocity
      by IP, integrity cache on profile, suspicious-carrier review queue —
      see **moderator logs and admin UI** in `parked.md`.

- [x] **verify web push (VAPID)** `S` — confirmed live on realness-online:
      `/capabilities` returns `push: true`; `VAPID_PRIVATE_KEY` secret set;
      `capabilities`/`check_phone_integrity`/`notification` functions ACTIVE;
      Cloud Scheduler `firebase-schedule-notification-us-central1` runs
      Thursdays 3pm Pacific; logs show two consecutive successful broadcasts
      (`sent: 1, removed: 0, failed: 0`).

## Out of scope

Anything deferred until users/revenue — see `parked.md`.

## Verification

Each checklist item has its own accept criteria (E2E for platform toggles, mask plan gates, manual for outreach). Close the item when those pass; do not treat the whole file as one gate.
