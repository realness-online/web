# Finishing Touches

Status: active
Related: none (launch spine; detail plans and `parked.md` hang off this list)

## Goal

Clear the pre-release punch list for the web app so realness.online can launch with auth, mask, discoverability, and optional platform features in known shape.

## Current state

Open items below. Mask work is detailed in `mask-subjects.md` (supersedes the mask checklist line). Verify-instance detail is in `verify-instance.md`. Deferred legal/product items live in `parked.md`.

## Approach

### Pre-release (web app)

- [~] **critical code-review pass** `M` — see `code-review-findings.md`. Full
  `src/` sweep (persistence, components, composables, utils/workers,
  views/3d/potrace) cross-referenced against `npm run test:risk`; every
  high- and medium-severity finding fixed with regression tests (mutex
  race, sync data-loss race, tracer worker race, a11y focusable
  regression, Three.js resource leak, stuck "working" states, Cloud.js
  archive rollback, divide-by-zero/Infinity bugs, worker error handling,
  and more). Only remaining open item is the `svg-to-video.js` timing
  question, held for discussion — see "Deferred" in
  `code-review-findings.md`.

### Account & auth (web app only — no functions)

- [ ] **notification opt-in in onboarding** `M` — the notifications toggle
      (`components/account/as-notifications.vue`, gated on the `push`
      capability) only lives buried in Account settings today; nobody sees it
      during sign-on. Move the ask into onboarding — a real prompt for whether
      someone wants notifications, stating the cadence (broadcasts go out
      Thursdays, Pacific time) so it's not a surprise later. Web-only instances
      without `realness-functions` deployed should skip this (`push` capability
      off).

### Licensing

### Mask & canvas

- [ ] **finish mask functionality** `L` — see `mask-subjects.md` (named subjects,
      persistence, layer export). Pen draw/erase completeness lives there.
      Mobile zoom (its dependency) has shipped.

### Discoverability & GTM

- [~] **app icon / logo design** `M` — mosaic-style realness mark, palette
  colors, smalti masks, gutter, physical motion. Final touch remaining: work
  cutouts into the mark, update `public/icons.svg`, regenerate PNGs.

### Community

- [~] **reach out to vtracer creators** `S` — drafts written in
  `contact-vtracer-email.md` (Chris Tsang at `chris.2y3@outlook.com`, Peter
  Selinger at `selinger@users.sourceforge.net`). Not sent yet.
  `docs/security.md` updated per Stripe decision.

### Platform

- [ ] **verify instance** `L` — see `verify-instance.md`. Extends
      `scripts/verify-deploy.js`, `build-manifest.js`; `/verify` page and/or CLI.

Decision table and deploy steps:
[README — Optional server features](../README.md#optional-server-features-realness-functions).

- [ ] **verify phone integrity (Twilio Lookup)** `M` — code landed
      (`check_phone_integrity`, capability-gated in `as-form-mobile.vue`) but
      **not confirmed in production**. Only runs when `phone_integrity` is true
      in `/capabilities`. To verify: deploy functions to the Firebase project,
      set `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`, redeploy, confirm
      `/capabilities` returns `phone_integrity: true`, then E2E sign-in (mobile
      passes; VoIP/virtual blocked before SMS). **Not a launch blocker** for
      web-only instances. Post-verify backlog: signup velocity by IP, integrity
      cache on profile, suspicious-carrier review queue — see **moderator logs
      and admin UI** in `parked.md`.

- [ ] **verify web push (VAPID)** `S` — only if the instance should show the
      Account notifications toggle and run scheduled broadcast. Deploy
      functions, set `VAPID_PRIVATE_KEY`, keep public key in sync in both repos,
      confirm `/capabilities` returns `push: true`, then E2E subscribe and a
      itest broadcast. **Not a launch blocker** for web-only instances.

## Out of scope

Anything deferred until users/revenue — see `parked.md`.

## Verification

Each checklist item has its own accept criteria (E2E for platform toggles, code-review for the critical pass, manual for icon/outreach). Close the item when those pass; do not treat the whole file as one gate.
