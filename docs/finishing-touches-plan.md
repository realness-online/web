# Realness — Finishing Touches

Punch list to get [realness.online](https://realness.online) over the line.

- App: `work/realness` — **required** for any instance
- Functions: `work/realness-functions` — **optional**; deploy only for push
  and/or Twilio Lookup (see [README — Optional server features](../README.md#optional-server-features-realness-functions))

Launch does **not** require functions. Auth, Storage, posters, feed, and Stripe
sponsorship are web-app only.

---

## 🔎 Pre-release (web app)

- [ ] **critical code-review pass** `M` — a lot of code has landed through this
      punch list (lazy vectorize, deferred boot, support layout, OG/prerender,
      feed pagination, LCP shell). Walk the diff with a critical eye before
      launch: correctness, dead code, reuse, and any regressions in the auth /
      feed / prerender paths. Run `/code-review` (raise to `high` for broader
      coverage); triage findings back into this list.

### 🎨 Design system

- [x] **Semantic color naming** `M` — role-based color variables (accent,
      danger, success, etc.) replace hue names across `src/style/` and
      components; aligns with the realness design system.

### 🔐 Account & auth (web app only — no functions)

- [ ] **Stripe checkout: sign in first** `S` — sponsorship is a hosted Stripe
      checkout link in the web app (Buy Button or `buy.stripe.com` URL); **no
      server-side Stripe in `realness-functions`**. When signed in, pass the
      phone-derived id (`me.id`, e.g. `/+15551234567`) as Stripe
      `client_reference_id`. **Gate:** if the visitor is not signed in, collect
      phone auth on `/account` (or inline on `/pricing`) before opening Stripe —
      do not send anonymous checkouts. `sponsor/cta.vue` passes
      `client_reference_id` when `me` exists but still renders checkout without
      a sign-in gate. Replace with sign-in prompt → redirect back to pricing →
      then checkout. Update `docs/security.md` third-party / Sybil sections
      accordingly (Stripe is voluntary checkout, not a server gate).

### 🎨 Mask & canvas

- [ ] **finish mask functionality** `L` — pen tool is incomplete: full
      draw/erase, persistence, export into the layer model. Mobile zoom (its
      dependency) has shipped.

### 📣 Discoverability & GTM

- [ ] **app icon / logo design** `M` — not started. The PWA plumbing exists
      (manifest entries, maskable safe-zone, `scripts/generate-icons.js`), but
      it just renders the existing in-app `realness` glyph from
      `public/icons.svg` on a `#2c2c26` background — a placeholder, not a
      designed mark. Design an actual app icon / logo, then regenerate
      `192.png`/`512.png`.
- [ ] **public-facing changelog** `M` — a user-visible "what's new" surface so
      people can see app work as it ships. Authoring source now exists:
      `CHANGELOG.md` at the repo root (raw dev log; curate for users). Ties into
      **push notifications v2**, which is already scoped as a Storage-event
      changelog — the same entries can drive both the in-app "what's new" view
      and the changelog-update notification. Decide: where it surfaces (a
      `/changelog` route, a dialog, or a badge on the version chip in the
      Thoughts header), and whether entries are curated user-facing prose vs.
      the raw dev log. Keep it crawlable if it lives on a marketing route.

### 🤝 Community

- [ ] **reach out to vtracer creators** `S` — contact the
      [visioncortex](https://www.visioncortex.org/) team; tell them about
      Realness and how [vtracer](https://github.com/visioncortex/vtracer) powers
      the on-device mosaic layers (color-region tracing for the five poster
      cutouts). Already credited in `src/content/documentation.md`.

### 🧩 Platform

- [ ] **verify instance** `L` — `/verify` page and/or CLI to confirm a running
      instance matches a trusted release (extends build-manifest work).
      `scripts/verify-deploy.js`, `build-manifest.js`; write
      `docs/verify-instance-plan.md`.

---

## Pre-release (optional — `realness-functions`)

**Skip this section** unless the instance needs push notifications and/or
Twilio phone integrity. The app probes `/capabilities` at runtime; without a
functions deploy, `capabilities.json` keeps every flag off and the web app
behaves correctly.

Decision table and deploy steps: [README — Optional server features](../README.md#optional-server-features-realness-functions).

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
      functions, set `VAPID_PRIVATE_KEY`, keep public key in sync in both
      repos, confirm `/capabilities` returns `push: true`, then E2E subscribe
      and a test broadcast. **Not a launch blocker** for web-only instances.

---

### Non-blocking refinements (post-launch backlog)

- **Storage listing size** — Firebase's list API response (~51 KB, ungzipped by
  Google) is dominated by layer-variant files (`*-bold.svg`, shadows, cutouts)
  filtered client-side in `Directory.js`. Moving variants into a subfolder would
  let the delimiter exclude them.

### Moderator tooling (post-release)

- [ ] **moderator logs and admin UI** `L` — optional moderator-facing surface
      for investigating instance state, modeled on seeq-app (`/admin`,
      `docs/logging.md`). Realness is per-instance: scope to the moderator
      (`VITE_ADMIN_ID`), not a central platform admin. **Only relevant when
      `realness-functions` is deployed** — self-hosted web-only instances skip
      backend-dependent sections entirely. Candidates:
  - **Cloud Logging viewer** — structured JSON from `realness-functions`
    (`log_debug` / `log_warn` / `log_error` pattern); client errors via
    callables (`log`, `error`); `list_logs` querying Cloud Logging (see seeq
    `handlers/http/log.js`, `list-logs` tests). Table with severity filter,
    expandable rows, last-24h scroll.
  - **Sybil / sign-in** — VoIP denial log from `check_phone_integrity`;
    optional `integrity.suspicious` review queue (see seeq
    `docs/phone-fraud-prevention-plan.md`, admin user integrity UI).
  - **Push** — broadcast results from scheduled `notification` (sent / pruned /
    failed).
  - **Capabilities** — live `/capabilities` manifest vs what the app shows.

  Write `docs/moderator-admin-plan.md` before build.
