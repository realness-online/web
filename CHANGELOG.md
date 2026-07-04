# Changelog

User-visible and infrastructure changes to [realness.online](https://realness.online).
Newest first. The launch punch list lives in `docs/finishing-touches-plan.md`.

## Unreleased

- **Preload Lato Light** — the home-route shell `<h1>` renders Lato 300, but
  only the 400 subset was preloaded, so the LCP element repainted when Light
  arrived after CSS parse. Preloading Light closes the FCP→LCP gap Lighthouse
  showed under throttling. (`index.html`)
- **Dated poster labels** — poster SVGs announce "Poster from <day>" (from the
  itemid's created-at) instead of the generic "Poster", in both `as-svg` and
  the referenced-poster path in `as-figure`.

## 2026-07-04 — v2.5.7

### Performance: static LCP shell for the home route

- **Static Thoughts shell** — `index.html` now renders
  `<section id="thoughts"><h1>Thoughts</h1></section>` inside `#app`, so the LCP
  text paints on first HTML parse (styled by the already render-blocking entry
  CSS) instead of waiting for Vue to mount. A head script gates the shell to
  `location.pathname === '/'` via `html[data-route='thoughts']`, so `/account`
  and `/:profile` — which share `index.html` as the SPA fallback — don't flash
  "Thoughts". An empty placeholder `<header>` (min-height 2.6rem) reserves the
  real header's height to limit layout shift on mount. Prerender injection
  unaffected: the `#app` replace regex adds no `<div>`, so marketing pages still
  fully swap the shell out. (`index.html`)

### Accessibility 100

- **Poster SVG labels** — `role="img"` + `aria-label` +
  `aria-roledescription="poster"` on the live poster SVG (`posters/as-svg.vue`);
  dynamic `aria-label`/`aria-pressed` on the icon-only avatar toggle
  (`posters/as-button-avatar.vue`).
- **Icon-only link sweep** — `aria-label` on the messenger `sms:` link
  (`profile/as-messenger.vue`, also converted from a JS `window.open` to a
  native `href`) and the author-menu delete button (`posters/as-menu-author.vue`).
  Cleared Lighthouse's last accessibility audit: 74 → **100**.

### Infrastructure & fixes

- **Fonts cached a year** — `/fonts/**` now `max-age=31536000, immutable` in
  `firebase.json` (was 1 day via the generic asset rule). Rename subsets if ever
  regenerated.
- **Deleted posters drop from visitor feeds** — missing/empty poster loads no
  longer render a blank figure for signed-out visitors.
- **3D poster menu buttons** — previously-reported dead buttons no longer
  reproduce (verified desktop + phone; hit-testing confirmed clean live).

### Measured (Lighthouse, live prod)

**93 Performance / 100 Accessibility / 100 Best Practices** (SEO 63 — root is
deliberately noindex; marketing pages are indexable). FCP 1.7 s, LCP 2.0 s
(shell `<h1>`), TBT 20 ms, CLS 0.002. Start of week: LCP 3.0–5.4 s,
accessibility 74. Total byte weight ~928 KB → ~679 KB.

## 2026-07-03 — Removed EXIF metadata feature

- **EXIF capture + overlay removed** — the iOS Photos picker re-exports a
  sanitized `image.jpg` that strips camera/date/GPS before our code runs, so the
  feature delivered nothing on the common iOS path. Deleted `utils/exif.js`,
  `as-poster-exif.vue`, `account/as-exif.vue`, the `include_exif` preference,
  and all capture in `vectorize.js`. Rationale and the in-app-camera path
  forward: `docs/monopoly.md`.

## 2026-07-02 — Performance: lazy vectorize, trimmed preconnects, deferred boot, CLS fix

- **Lazy vectorize on first paint** — `use_vectorize` (potrace, persistence,
  Queue, Storage) now loads via dynamic import after `requestAnimationFrame`
  instead of blocking the critical path. App boot imports fell by ~80KB. The
  file input directive and all injected refs/functions are stubbed until the
  real module arrives, then synced via watchers. (`src/App.vue`)
- **Deferred `init_serverless`** — Firebase initialization moved after Vue mount
  so first paint isn't blocked by auth setup. Same for SW registration.
  (`src/main.js`)
- **Trimmed preconnects** — removed 8 unused `preconnect`/`dns-prefetch` links
  to `apis.google.com`, `googleapis.com`, `firebaseapp.com`, `google.com`,
  `gstatic.com`, `storage.googleapis.com`. Only `firebasestorage.googleapis.com`
  preconnect remains. (`index.html`)
- **Lazy InstallGuide + PreferencesMenu** — both components in the documentation
  dialog now use `defineAsyncComponent` so the 242KB `android-chrome.mp4` video
  and preferences panel code don't load on every page view.
  (`src/components/as-dialog-documentation.vue`)
- **CLS shell** — `#app` gets `min-height: 100dvh` so the loading SVG
  replacement by Vue doesn't shift the layout. (`index.html`)
- **Stable feed render time** — `Thoughts rendered` performance mark improved
  from 4.2s to ~2.7s across runs (36% faster). `feed_needs_refresh` not fired on
  vectorize load to avoid double feed fetch.

## 2026-07-02 — Support layout, build-time TOC, scroll & swipe

- **Support layout** — site-nav rendered once by `support-layout.vue` in both
  App.vue and PrerenderShell (static HTML), replacing 5 hand-rolled copies.
  Safe-area ownership moved from `section.page` (shared with app pages) onto the
  nav itself. `section.page` zeroes its top padding when the nav precedes it via
  an adjacent-sibling rule. (`src/components/support-layout.vue`, `src/App.vue`,
  `src/components/site-nav.vue`, `src/style/elements/section.styl`)
- **Build-time TOC** — `scripts/generate-toc.js` precomputes heading trees from
  markdown content and writes `src/prerender/toc.js` before the Vite build.
  Documentation, Terms, and Privacy views import the static arrays instead of
  calling `markdown_toc()` at runtime. (`scripts/generate-toc.js`,
  `src/prerender/toc.js`, `src/views/Documentation.vue`, `src/views/Terms.vue`,
  `src/views/Privacy.vue`)
- **Swipe-back & scroll** — removed `history.scrollRestoration = 'manual'` from
  About.vue (was fighting swipe-back by disabling scroll memory). TOC links use
  `router-link replace` so hash clicks don't accumulate history entries (one
  swipe-back actually leaves the page). `scrollBehavior` now handles `to.hash`
  with smooth scroll and uses `rAF`-deferred `{ top: 0 }` for forward
  navigation. (`src/router.js`, `src/views/About.vue`)
- **Mobile TOC UX** — sub-level font sizes bumped from `0.58em` to `smaller`
  (~10px→~15px); `touch-action: manipulation` eliminates 300ms tap delay on all
  TOC links; heading `scroll-margin-top` accounts for safe-area so TOC-anchored
  sections clear the camera notch. Subtle `← Back` link in page headers for
  returning from deep scroll. (`src/views/Documentation.vue`,
  `src/components/legal-page.vue`, `src/style/mixins/markdown-content.styl`)
- **Pricing page** — horizontal padding to stop content riding the edges; bottom
  padding to clear the footer island; space between buy button and actions row;
  removed redundant price text (Stripe button already shows the amount).
  (`src/views/Pricing.vue`)

## 2026-07-02 — Account, performance

- **Require a name** — nameless users redirected to `/account`; validation on
  save and sign-on; profile persist skips blank display names.
- **Lazy 3D and download** — `defineAsyncComponent` for viewer and download in
  poster figures and author menu.
- **Smaller first feed page** — confirmed handled at the source: `optimize()`
  (`persistence/Cloud.js`) caps each author's current `directory.items` to
  `SIZE.MAX` (55) on save, archiving the oldest into buckets that load on
  scroll, so first paint is a bounded page per author.

## 2026-07-02 — Discoverability & social previews

- **Open Graph cards** — marketing URLs (`/about`, `/docs`, `/pricing`,
  `/terms`, `/privacy`) prerender with full `og:*` and Twitter Card tags. **OG**
  = Open Graph, the meta tag protocol Facebook defined; Slack, Discord,
  iMessage, LinkedIn, and X all read it for link previews.
- **`og.png` (1200×630)** — social image with headline ("Realness Online"),
  value prop, and CTA pill ("Make some posters today"). Generated by
  `scripts/generate-icons.js`; copy in `src/prerender/pages.js`.
- **Meta tag pass** — title 50–60 chars, description ≤125 for social truncation,
  `og:site_name`, `og:image:alt`, `og:image:type`, `og:image:width`/`height`,
  `twitter:image:alt`.
- **Support layout** — shared nav shell for marketing pages via
  `support-layout.vue`; app feed stays `noindex`.
- **Sitemap & robots** — crawlable marketing pages in `sitemap.xml`; app shell
  remains unindexed.
- **Static docs** — `public/documentation.md` and `public/llms.txt` for crawlers
  and LLM discovery.

## 2026-07-01 — Early in the v2.5.7 cycle

- **Stripe buy buttons** wired into the $100/$500 pricing tiers.
- **Mask subjects** — named path groups with grow-select/erase (WIP — save not
  wired), plus native pinch-zoom while masking.
- **3D mode poster menu gesture** — reveal the poster menu in 3D with the same
  gesture as SVG mode.

## 2026-06-29 — v2.5.6

- **Blank duplicate-poster avatars fixed** via visibility-aware canonical
  election (one rendered poster per id; the rest reference it).
- **PSD export** — stroke stripped from shadow fill layers.
- **Statement text selectable**; touch callout suppressed on tappable elements.
- **"Copy prompt" agent buttons** inline in docs and pricing.
- **SSR hardening** — prerender and standalone guards; `var(--base-line)` in
  viewport-relative `calc()`s.

## 2026-06-28 — v2.5.5

- **Account overhaul** — inline sign-in, web push notification preference,
  Stripe reduced to a CTA.
- **Pricing and legal pages** — ToS simplified (arbitration removed, venue
  kept); LICENSE and legal docs updated; `security.txt` refreshed with
  security@realness.online.

## 2026-06-17 — v2.5.4

- **Install guide** — native install prompt, platform detection, and synthetic
  install-walkthrough animations (HyperFrames-rendered) for iOS/Android.

## 2026-06-15 — v2.5.3

- **Big simplification** — removed phonebook, relations, events, and picker;
  simplified profile and poster menus; expanded documentation.
- **Preferences menu** — hints, icons, keybindings; animated silhouette toggle
  for the `only_mine` feed filter; documentation preferences panel.
- **About page refresh** with gallery cap and lore.
- **Archive location map** with self-healing `sync:index`.

## 2026-06-08 → 06-11 — v2.5.1–2.5.2

- **Prerendered marketing pages** and public site structure.
- **About page rebuilt** — integrations, feature list, balanced gallery;
  archive loading fixes.
- **Frosted-glass styling consolidated**; account UI polish; 3D "haze"
  renamed to atmosphere.

## 2026-05-31 — v2.5.0

- **Mask pen drawing tool** debuts.

## 2026-05-16 → 05-25 — v2.4.x: 3D posters land

- **3D poster viewer and export tooling** migrated in from `projects/3d`;
  scene motion refactored with test coverage; device orientation (gyro)
  handling and input disposal; iOS touch/orientation polish.

## 2026-04 → 05 — v2.3.x: platform

- **Vite+ toolchain transition.**
- **Stripe sponsorship** integrated; profile account hero; homescreen icon
  management and preferences.
- **One poster on the page** — refactored so a poster renders once no matter
  how often it's reused; caching and rendering performance work.

## 2026-02 → 04 — v2.0–v2.2: the Thoughts interface

- Interface re-centered around **Thoughts** (statements ⇄ thoughts refactor,
  navigation removed); color scheme moved green → blue.
- Safari feed performance; cutouts removed from DOM when off-screen; feed
  ordering fixes.
- **Sync folder** for exporting full poster outputs; download-video
  improvements; swipe left/right for landscape posters.
- Local dev setup simplified ("run locally like a boss").

## 2025-10 → 2026-02 — v2.0.0: the rebuild

- Offline/anonymous poster creation synced after sign-in; cutouts and shadows
  stored for later sync; **PNG and PSD export** alongside SVG; layer naming
  and cache cleanup; dark-mode color-scheme declared to the browser.

## 2024 → mid-2025 — v1.5–v1.8: the on-device tracer

- **vtracer (wasm) integrated** — the on-device color-region tracer behind the
  mosaic layers; the tracing experience instrumented and tuned.
- Offline actions merged with sign-in sync for anonymous users; iPad
  standalone detection; preferences and documentation growth.

## 2017 → 2023 — origins

First commit 2017-12-20. Realness grew up as a phone-number-identity social
PWA — profiles, avatars, statements, events, a phonebook of relations — with
dark mode by 2018 and steady releases through v1.x. Posters emerged as the
core creative object, and 2022's TensorFlow/COCO object-detection experiments
planted the seed for today's mask-subjects work. Most of that social surface
was deliberately shed in 2026 (v2.5.3) to focus the app on posters and
thoughts.
