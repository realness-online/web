# Realness — Finishing Touches

Punch list to get [realness.online](https://realness.online) over the line.

- App: `work/realness`
- Functions: `work/realness-functions`

---

### 🔐 Account & auth

- [ ] **sign-in polish** `M` — conventional patterns (fields, states, errors), no surprising
      this is the broader
      polish. `src/views/Account.vue`, `src/components/account/`.
- [ ] **require a name** `S` — can't save account with empty name; prompt existing nameless
      users; clear validation. `src/components/account/`.

- [ ] **phone validation (Twilio Lookup)** `M` — block VoIP/throwaway numbers at sign-in
      (a lookup, not messaging). Port from seeq-app: `functions/.../services/integrity.js`,
      `handlers/http/user.js` (`check_phone_integrity`), `twilio` dep, `utils/rate-limiter.js`,
      `TWILIO_ACCOUNT_SID`/`AUTH_TOKEN`. Reject when Lookup v2 `line_type_intelligence.type !==
'mobile'`; cache on user record. Adapt seeq's `users` keying to realness identity.
      See seeq `docs/phone-fraud-prevention-plan.md`.

### 💰 Payments

- [x] **Stripe buy buttons for $100/$500 tiers** `M` — `sponsor/cta` gained
      `buy_button_id`/`publishable_key`/`checkout_url` props; Small teams ($100/yr) and Large
      organizations ($500/yr) tiers now embed their own buy buttons in `Pricing.vue`.
      Client-side embeds, no server functions. (`src/components/sponsor/cta.vue`,
      `src/views/Pricing.vue`)

### 🐛 Bugs

- [x] **PSD export stroke on shadow layers** `M` — shadow fill layers now export with
      `stroke:none`; the outline ships only in the dedicated Stroke group. (`svg-to-psd.js`)
- [x] **avatar won't render when poster already on page** `M` — fixed with a visibility-aware
      canonical election (`use/poster-instances.js`, `posters/as-avatar.vue`): the elected
      visible instance owns the shared defs, the rest reference it via `<use>`.
- [x] **main menu inaccessible in 3D mode** `M` — the 3D viewer canvas now reveals the
      per-poster menu with the same gesture as SVG mode (long-press on touch, click on
      mouse; drag stays reserved for orbit). Motion-sensor permission gesture preserved.
      (`posters/as-viewer-3d.vue`, `posters/as-figure.vue`)

### 🎨 Mask & canvas

- [x] **unreliable mobile zoom** `M` — mask surface now uses `touch-action: pinch-zoom` so the
      browser's native pinch-zoom works while masking; one finger paints, two fingers zoom.
      Selection is deferred (commits on tap-release or after a drag starts) and a second finger
      cancels it, so a pinch never strays a cell. Thinner overlay outlines. (`posters/as-svg.vue`,
      `posters/as-mask-pen.vue`)
- [ ] **finish mask functionality** `L` — pen tool is incomplete: full draw/erase,
      persistence, export into the layer model. Depends on mobile zoom.

### 📣 Discoverability & GTM

- [ ] **main app icon** `M` — `192.png`/`512.png` + maskable safe-zone; looks right installed
      on iOS/Android; feeds the social cards. `public/`, `scripts/generate-icons.js`, manifest in
      `vite.config.js`. Do before social cards.
- [ ] **social share cards** `M` — marketing URLs render proper OG/Twitter cards; image uses
      final icon. Marketing surface only (app stays private). `src/prerender/`.
- [ ] **SEO (marketing only)** `S` — title/describe/crawl the About, Pricing, Terms, Privacy
      pages; correct sitemap/robots; **app stays unindexed**. `public/robots.txt`, `sitemap.xml`,
      `src/prerender/`.
- [ ] **"Create your own Realness" CTA** `S` — button + copy pointing at the self-host path.
      `src/components/call-to-action.vue`, `sponsor/cta.vue`, About. Pairs with copywriting skill.

### 🧩 Platform

- [ ] **verify instance** `L` — `/verify` page and/or CLI to confirm a running instance
      matches a trusted release (extends build-manifest work). `scripts/verify-deploy.js`,
      `build-manifest.js`; write `docs/verify-instance-plan.md`.
