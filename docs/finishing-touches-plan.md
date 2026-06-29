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

- [ ] **Stripe buy buttons for $100/$500 tiers** `M` — create products and Stripe buy
      buttons in Stripe dashboard for Small teams ($100/yr) and Large organizations
      ($500/yr), then wire into Pricing.vue (same pattern as the $5 Endorse button in
      `sponsor/cta.vue`). No server-side functions needed — Stripe buy buttons are
      client-side embeds. `src/views/Pricing.vue`.

### 🐛 Bugs

- [ ] **PSD export stroke on shadow layers** `M` — medium/bold shadow layers carry stroke
      they shouldn't; verify by re-opening export. Locate the export/psd writer in `src`.
- [ ] **avatar won't render when poster already on page** `M` — need to reference a poster
      rendered elsewhere; likely SVG `<use>` / duplicate `id` collision. Avatar + poster render
      components.
- [ ] **main menu inaccessible in 3D mode** `M` — menu must be reachable in 3D poster mode,
      desktop + mobile. 3D view + nav interaction.

### 🎨 Mask & canvas

- [ ] **unreliable mobile zoom** `M` — pinch/zoom must work on touch so masking is precise on
      a phone. Canvas/gesture handling. _(unblocks the mask work on mobile)_
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
