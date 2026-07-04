# Realness — Finishing Touches

Punch list to get [realness.online](https://realness.online) over the line.

- App: `work/realness`
- Functions: `work/realness-functions`

---

## 🔎 Pre-release

- [ ] **critical code-review pass** `M` — a lot of code has landed through this
      punch list (lazy vectorize, deferred boot, support layout, OG/prerender,
      feed pagination, LCP shell). Walk the diff with a critical eye before
      launch: correctness, dead code, reuse, and any regressions in the auth /
      feed / prerender paths. Run `/code-review` (raise to `high` for broader
      coverage); triage findings back into this list.

### 🎨 Design system

- [ ] **Semantic color naming** `M` — color variables are named by hue
      (`blue`/`green`/`red` in `src/style/variables.styl`, `color.styl`), which
      couples markup and styles to specific colors and makes theming / dark-mode
      intent hard to reason about (e.g. `blue` means "accent", `red` means
      destructive/selected). Move toward role-based names (accent, danger,
      success, or a numbered scale) per color-naming best practices.
      Cross-cutting refactor touching `src/style/` and every component
      referencing the hue names — scope and stage carefully. Coordinates with
      the realness design system.

### 🔐 Account & auth

- [ ] **phone validation (Twilio Lookup)** `M` — block VoIP/throwaway numbers at
      sign-in (a lookup, not messaging). Port from seeq-app:
      `functions/.../services/integrity.js`, `handlers/http/user.js`
      (`check_phone_integrity`), `twilio` dep, `utils/rate-limiter.js`,
      `TWILIO_ACCOUNT_SID`/`AUTH_TOKEN`. Reject when Lookup v2
      `line_type_intelligence.type !== 'mobile'`; cache on user record. Adapt
      seeq's `users` keying to realness identity. See seeq
      `docs/phone-fraud-prevention-plan.md`.

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

### Non-blocking refinements (post-launch backlog)

- **Storage listing size** — Firebase's list API response (~51 KB, ungzipped by
  Google) is dominated by layer-variant files (`*-bold.svg`, shadows, cutouts)
  filtered client-side in `Directory.js`. Moving variants into a subfolder would
  let the delimiter exclude them.
