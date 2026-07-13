# Realness — Finishing Touches

## 🔎 Pre-release (web app)

- [ ] **critical code-review pass** `M` — a lot of code has landed through this
      punch list (lazy vectorize, deferred boot, support layout, OG/prerender,
      feed pagination, LCP shell). Walk the diff with a critical eye before
      launch: correctness, dead code, reuse, and any regressions in the auth /
      feed / prerender paths. Run `/code-review` (raise to `high` for broader
      coverage); triage findings back into this list.

### 🔐 Account & auth (web app only — no functions)

- [ ] **notification opt-in in onboarding** `M` — the notifications toggle
      (`components/account/as-notifications.vue`, gated on the `push`
      capability) only lives buried in Account settings today; nobody sees it
      during sign-on. Move the ask into onboarding — a real prompt for whether
      someone wants notifications, stating the cadence (broadcasts go out
      Thursdays, Pacific time) so it's not a surprise later. Web-only instances
      without `realness-functions` deployed should skip this (`push` capability
      off).

### 📜 Licensing

### 🎨 Mask & canvas

- [ ] **finish mask functionality** `L` — pen tool is incomplete: full
      draw/erase, persistence, export into the layer model. Mobile zoom (its
      dependency) has shipped.

### 📣 Discoverability & GTM

- [~] **app icon / logo design** `M` — mosaic-style realness mark, palette
  colors, smalti masks, gutter, physical motion. Final touch remaining: work
  cutouts into the mark, update `public/icons.svg`, regenerate PNGs.

### 🤝 Community

- [~] **reach out to vtracer creators** `S` — drafts written in
  `docs/plans/contact-vtracer-email.md` (Chris Tsang at `chris.2y3@outlook.com`, Peter
  Selinger at `selinger@users.sourceforge.net`). Not sent yet.
  `docs/security.md` updated per Stripe decision.

### 🧩 Platform

- [ ] **verify instance** `L` — `/verify` page and/or CLI to confirm a running
      instance matches a trusted release (extends build-manifest work).
      `scripts/verify-deploy.js`, `build-manifest.js`; write
      `docs/verify-instance-plan.md`.

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
      and admin UI** (post-release).

- [ ] **verify web push (VAPID)** `S` — only if the instance should show the
      Account notifications toggle and run scheduled broadcast. Deploy
      functions, set `VAPID_PRIVATE_KEY`, keep public key in sync in both repos,
      confirm `/capabilities` returns `push: true`, then E2E subscribe and a
      itest broadcast. **Not a launch blocker** for web-only instances.
