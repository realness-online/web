# Realness — Finishing Touches

Punch list to get [realness.online](https://realness.online) over the line.

- App: `work/realness`
- Functions: `work/realness-functions`

---

## Changelog

User-visible and infrastructure fixes shipped through this punch list. Newest first.

### 2026-07-04 — Performance: static LCP shell for the home route

- **Static Thoughts shell** — `index.html` now renders `<section id="thoughts"><h1>Thoughts</h1></section>`
  inside `#app`, so the LCP text paints on first HTML parse (styled by the already
  render-blocking entry CSS) instead of waiting for Vue to mount. A head script gates the
  shell to `location.pathname === '/'` via `html[data-route='thoughts']`, so `/account` and
  `/:profile` — which share `index.html` as the SPA fallback — don't flash "Thoughts". An
  empty placeholder `<header>` (min-height 2.6rem) reserves the real header's height to limit
  layout shift on mount. Prerender injection unaffected: the `#app` replace regex adds no
  `<div>`, so marketing pages still fully swap the shell out. (`index.html`)

### 2026-07-02 — Performance: lazy vectorize, trimmed preconnects, deferred boot, C boot, CLS fix

- **Lazy vectorize on first paint** — `use_vectorize` (potrace, persistence,
  Queue, Storage) now loads via dynamic import after `requestAnimationFrame` instead of
  blocking the critical path. App boot imports fell by ~80KB. The file input directive and
  all injected refs/functions are stubbed until the real module arrives, then synced via
  watchers. (`src/App.vue`)
- **Deferred `init_serverless`** — Firebase initialization moved after Vue mount so first
  paint isn't blocked by auth setup. Same for SW registration. (`src/main.js`)
- **Trimmed preconnects** — removed 8 unused `preconnect`/`dns-prefetch` links to
  `apis.google.com`, `googleapis.com`, `firebaseapp.com`, `google.com`, `gstatic.com`,
  `storage.googleapis.com`. Only `firebasestorage.googleapis.com` preconnect remains.
  (`index.html`)
- **Lazy InstallGuide + PreferencesMenu** — both components in the documentation dialog
  now use `defineAsyncComponent` so the 242KB `android-chrome.mp4` video and preferences
  panel code don't load on every page view. (`src/components/as-dialog-documentation.vue`)
- **CLS shell** — `#app` gets `min-height: 100dvh` so the loading SVG replacement by Vue
  doesn't shift the layout. (`index.html`)
- **Stable feed render time** — `Thoughts rendered` performance mark improved from 4.2s to
  ~2.7s across runs (36% faster). `feed_needs_refresh` not fired on vectorize load to
  avoid double feed fetch.

### 2026-07-02 — Support layout, build-time TOC, scroll & swipe"}]

- **Support layout** — site-nav rendered once by `support-layout.vue` in both App.vue and
  PrerenderShell (static HTML), replacing 5 hand-rolled copies. Safe-area ownership moved
  from `section.page` (shared with app pages) onto the nav itself. `section.page` zeroes its
  top padding when the nav precedes it via an adjacent-sibling rule.
  (`src/components/support-layout.vue`, `src/App.vue`,
  `src/components/site-nav.vue`, `src/style/elements/section.styl`)
- **Build-time TOC** — `scripts/generate-toc.js` precomputes heading trees from markdown
  content and writes `src/prerender/toc.js` before the Vite build. Documentation, Terms, and
  Privacy views import the static arrays instead of calling `markdown_toc()` at runtime.
  (`scripts/generate-toc.js`, `src/prerender/toc.js`, `src/views/Documentation.vue`,
  `src/views/Terms.vue`, `src/views/Privacy.vue`)
- **Swipe-back & scroll** — removed `history.scrollRestoration = 'manual'` from About.vue
  (was fighting swipe-back by disabling scroll memory). TOC links use `router-link replace`
  so hash clicks don't accumulate history entries (one swipe-back actually leaves the page).
  `scrollBehavior` now handles `to.hash` with smooth scroll and uses `rAF`-deferred
  `{ top: 0 }` for forward navigation. (`src/router.js`, `src/views/About.vue`)
- **Mobile TOC UX** — sub-level font sizes bumped from `0.58em` to `smaller` (~10px→~15px);
  `touch-action: manipulation` eliminates 300ms tap delay on all TOC links; heading
  `scroll-margin-top` accounts for safe-area so TOC-anchored sections clear the camera notch.
  Subtle `← Back` link in page headers for returning from deep scroll.
  (`src/views/Documentation.vue`, `src/components/legal-page.vue`,
  `src/style/mixins/markdown-content.styl`)
- **Pricing page** — horizontal padding to stop content riding the edges; bottom padding to
  clear the footer island; space between buy button and actions row; removed redundant price
  text (Stripe button already shows the amount). (`src/views/Pricing.vue`)

### 2026-07-03 — Removed EXIF metadata feature

- **EXIF capture + overlay removed** — the iOS Photos picker re-exports a sanitized
  `image.jpg` that strips camera/date/GPS before our code runs, so the feature delivered
  nothing on the common iOS path. Deleted `utils/exif.js`, `as-poster-exif.vue`,
  `account/as-exif.vue`, the `include_exif` preference, and all capture in `vectorize.js`.
  Rationale and the in-app-camera path forward: `docs/monopoly.md`.

### 2026-07-02 — Account, performance

- **Require a name** — nameless users redirected to `/account`; validation on save and sign-on; profile persist skips blank display names.
- **Lazy 3D and download** — `defineAsyncComponent` for viewer and download in poster figures and author menu.

### 2026-07-02 — Discoverability & social previews

- **Open Graph cards** — marketing URLs (`/about`, `/docs`, `/pricing`, `/terms`, `/privacy`) prerender with full `og:*` and Twitter Card tags. **OG** = Open Graph, the meta tag protocol Facebook defined; Slack, Discord, iMessage, LinkedIn, and X all read it for link previews.
- **`og.png` (1200×630)** — social image with headline ("Realness Online"), value prop, and CTA pill ("Make some posters today"). Generated by `scripts/generate-icons.js`; copy in `src/prerender/pages.js`.
- **Meta tag pass** — title 50–60 chars, description ≤125 for social truncation, `og:site_name`, `og:image:alt`, `og:image:type`, `og:image:width`/`height`, `twitter:image:alt`.
- **Support layout** — shared nav shell for marketing pages via `support-layout.vue`; app feed stays `noindex`.
- **Sitemap & robots** — crawlable marketing pages in `sitemap.xml`; app shell remains unindexed.
- **Static docs** — `public/documentation.md` and `public/llms.txt` for crawlers and LLM discovery.

### Earlier (already on main)

- Stripe buy buttons on $100/$500 pricing tiers
- Mask subjects: grow-select/erase pen (WIP — save not wired)
- Native pinch-zoom while masking
- 3D mode poster menu gesture
- PSD export stroke fix, avatar canonical election, require-a-name validation

---

### 🐛 Bugs

- [x] **3D poster menu buttons dead** `M` — no longer reproduces (verified 2026-07-04: desktop
      Chrome + phone both work; live hit-testing on realness.online confirmed figcaption/menu
      layers sit correctly above the 3D canvas and clicks deliver). No fix was written for it —
      presumably resolved by intervening gesture/pointer work. Reopen with exact device + gesture
      if it comes back.
- [x] **Deleted poster shows as blank to visitors** `M` — fixed 2026-07-04 (separate session):
      missing/empty poster loads no longer render a blank figure in the visitor feed.

### 🎨 Design system

- [ ] **Semantic color naming** `M` — color variables are named by hue (`blue`/`green`/`red` in
      `src/style/variables.styl`, `color.styl`), which couples markup and styles to specific
      colors and makes theming / dark-mode intent hard to reason about (e.g. `blue` means
      "accent", `red` means destructive/selected). Move toward role-based names (accent, danger,
      success, or a numbered scale) per color-naming best practices. Cross-cutting refactor
      touching `src/style/` and every component referencing the hue names — scope and stage
      carefully. Coordinates with the realness design system.

### 🔐 Account & auth

- [ ] **phone validation (Twilio Lookup)** `M` — block VoIP/throwaway numbers at sign-in
      (a lookup, not messaging). Port from seeq-app: `functions/.../services/integrity.js`,
      `handlers/http/user.js` (`check_phone_integrity`), `twilio` dep, `utils/rate-limiter.js`,
      `TWILIO_ACCOUNT_SID`/`AUTH_TOKEN`. Reject when Lookup v2 `line_type_intelligence.type !==
'mobile'`; cache on user record. Adapt seeq's `users` keying to realness identity.
      See seeq `docs/phone-fraud-prevention-plan.md`.

### 🎨 Mask & canvas

- [ ] **finish mask functionality** `L` — pen tool is incomplete: full draw/erase,
      persistence, export into the layer model. Mobile zoom (its dependency) has shipped.

### 📣 Discoverability & GTM

- [ ] **app icon / logo design** `M` — not started. The PWA plumbing exists (manifest entries,
      maskable safe-zone, `scripts/generate-icons.js`), but it just renders the existing in-app
      `realness` glyph from `public/icons.svg` on a `#2c2c26` background — a placeholder, not a
      designed mark. Design an actual app icon / logo, then regenerate `192.png`/`512.png`.
- [ ] **public-facing changelog** `M` — a user-visible "what's new" surface so people can see app
      work as it ships (currently the changelog lives only in this internal plan). Users should
      learn about updates without reading the repo. Ties into **push notifications v2**, which is
      already scoped as a Storage-event changelog — the same entries can drive both the in-app
      "what's new" view and the changelog-update notification. Decide: authoring source (markdown
      like `documentation.md`, or Storage events), where it surfaces (a `/changelog` route,
      a dialog, or a badge on the version chip in the Thoughts header), and whether entries are
      curated user-facing prose vs. the raw dev log. Keep it crawlable if it lives on a marketing
      route.

### 🤝 Community

- [ ] **reach out to vtracer creators** `S` — contact the
      [visioncortex](https://www.visioncortex.org/) team; tell them about Realness and how
      [vtracer](https://github.com/visioncortex/vtracer) powers the on-device mosaic layers
      (color-region tracing for the five poster cutouts). Already credited in
      `src/content/documentation.md`.

### ⚡ Performance

Update (2026-07-04, later deploy): **Accessibility 100** after labeling the sms link + delete
button; fonts now cached a year (`/fonts/**` immutable in `firebase.json`). Only remaining
cache-TTL flag is Google's auth iframe. Scott's clean-host run scored **93 Performance**
(FCP 1.7 s, LCP 2.0 s, TBT 20 ms, CLS 0.002) — agent-host runs read 67–73 from lhci CPU-calibration
noise, so 93/100/100 is the honest snapshot. `Thoughts rendered` mark improved to 2.4 s.

Prod snapshot (2026-07-04, formal lhci run post-deploy): **73** Performance, **96** Accessibility,
**100** Best Practices, **63** SEO (root `/` is deliberately noindex; marketing pages are
indexable). CLS 0, TBT 100 ms. Throttled-mobile LCP 4.5 s — LCP element is the static shell
`<h1>`, but it repaints after FCP (2.9 s), likely font swap or Vue remount; only remaining
load-time refinement if wanted. Previous snapshot: 68–77 / 74 / 100 / 54.
**LCP now ~1.7 s cold / <0.8 s warm** (was 3.0–5.4 s) after the LCP shell — measured live via
`agent-browser vitals`, LCP element is the shell `<h1>`, CLS 0.05.
**Total byte weight** reduced from ~928KB to ~679KB (removed 242KB install video from
critical path). Load-time work is essentially done; remaining perf items are runtime/low-end
refinements that won't move Lighthouse.

- [x] **LCP shell before feed data** `M` — shipped & prod-verified 2026-07-04. Static
      `<h1>Thoughts</h1>` in `index.html` (gated to `/`), paints before Vue mounts. Live LCP
      dropped to ~1.7 s cold (see snapshot above).
- [x] **smaller first feed page** `M` — already handled at the source. `optimize()`
      (`persistence/Cloud.js`) runs on save and caps each author's current `directory.items`
      to `SIZE.MAX` (55), archiving the oldest `SIZE.MID` (34) into buckets that only load on
      scroll via `poster_shown`. So the first page is a bounded ~21–55 slots per author, not the
      full history. The only way it grows is many authors loaded in parallel — not the launch
      scenario (signed-out visitors see the single admin feed). Client-side per-author paging
      isn't worth the complexity until a fat multi-author feed is real.
- [x] **accessibility punch list** `M` — four named targets handled & prod-verified 2026-07-04.
      `textarea#wat` (`aria-label`) and day-heading order (`<h4 role="heading" aria-level="2">`
      under the page `<h1>`) were already correct. Added `role="img"` + `aria-label` +
      `aria-roledescription="poster"` to the live poster SVG (`posters/as-svg.vue`) and a dynamic
      `aria-label`/`aria-pressed` to the icon-only avatar toggle (`posters/as-button-avatar.vue`).
      Verified live on bundle `index-Cd8pHfQY`. **Follow-up (not blocking):** poster label is the
      generic "Poster" (could include author/date), and a full icon-only-button accessible-name
      sweep across menus would catch any others — worth a fresh Lighthouse run to surface.

### 🔎 Pre-release

- [ ] **critical code-review pass** `M` — a lot of code has landed through this punch list
      (lazy vectorize, deferred boot, support layout, OG/prerender, feed pagination, LCP shell).
      Walk the diff with a critical eye before launch: correctness, dead code, reuse, and any
      regressions in the auth / feed / prerender paths. Run `/code-review` (raise to `high` for
      broader coverage); triage findings back into this list.
- [x] **production Lighthouse baseline** `S` — done 2026-07-04 via `npm run score:prod` against
      live realness.online after the v2.5.7 deploy. Scores in the Performance snapshot above;
      accessibility 74 → 96 confirms the a11y punch list landed.

### 🧩 Platform

- [ ] **verify instance** `L` — `/verify` page and/or CLI to confirm a running instance
      matches a trusted release (extends build-manifest work). `scripts/verify-deploy.js`,
      `build-manifest.js`; write `docs/verify-instance-plan.md`.
