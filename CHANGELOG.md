# Changelog

## 2026-07-13 → 07-15 — v2.5.11

- **realness-design realign** — views and components drop invented class hooks
  for markup state (`data-*`, semantic elements, Scheme.org where it already
  lived), rename `--on-emphasis` to `--contrast`, and align Vue lifecycle
  aliases / event handlers with the design skill conventions.
  (`src/App.vue`, `src/views/*`, `src/components/**`, `src/style/`)
- **Markdown as an element stylesheet** — content typography moved out of a
  Stylus mixin into `src/style/elements/markdown.styl`, same pattern as the
  other element sheets.
- **Notification opt-in onboarding** — once per device after sign-in, a modal
  offers push when the instance supports it.
  (`src/components/profile/as-notification-prompt.vue`, `src/App.vue`)
- **Mosaic logo smalti wobble** — clipped fragment paths on each tile, paced
  off the glint cycle, so the mark has more physical glitter when animation
  is on. (`src/components/icon.vue`)
- **Preferences markup tidy** — notifications fieldset rename, tweakpane
  slide simplified to attribute selectors; orphan scratch `grid.svg` removed
  (preference grid already uses `icons.svg#grid`).
- **`npm run verify`** — deploy checksum CLI defaults clarified; docs updated
  for independent GitHub-manifest checks against any live URL.
  (`scripts/verify-deploy.js`, `docs/verify-release.md`, `package.json`)
- **Test coverage surge** — new and expanded specs across posters, profile,
  views, sync/persistence, potrace, and utils (~2k net test lines).

## 2026-07-12 → 07-13 — v2.5.10

- **Codebase-wide bug-fix pass** — a systematic review across persistence,
  components, composables, workers, and 3D/potrace, cross-referenced
  against coverage/refactor-risk data, surfaced and fixed real bugs: a
  mutex that could double-acquire a lock, a sync-queue race risking data
  loss, a tracer-worker cross-contamination race, poster SVGs silently
  losing keyboard focusability, a stuck sign-in flow on a wrong SMS code,
  a textarea keymap that could silently delete typed text, Three.js
  geometries/materials/textures leaking on every infinite-scroll
  mount/unmount, several divide-by-zero/Infinity bugs in the color
  histogram and posterization code, and worker error handling that could
  leave the upload queue silently stalled forever on one failed image.
  Every fix landed with a regression test; full detail in
  `plans/code-review-findings.md`.
- **Cloud archive consistency** — a poster's 7 component files (main +
  6 layers) could end up permanently split across live/archive storage if
  only some of the concurrent moves succeeded; partial failures now roll
  back cleanly to a fully un-archived state instead of leaving orphaned
  files. (`src/persistence/Cloud.js`, `src/utils/serverless.js`)
- **Pricing page rewritten as real HTML** — tier content (features, copy)
  is now hand-authored markup per the project's semantic-HTML convention,
  instead of being generated from a JS data array. (`src/views/Pricing.vue`)
- **Poster video export overhauled** — fixed an ~8x-too-fast playback bug
  (frames sampled once but encoded at a much higher rate than they were
  captured), then tuned for quality: frames now cross-fade into each other
  for smooth motion instead of a stepped hold, bitrate and resolution raised
  to a real 1440p/14 Mbps encode instead of the previous under-bitrated
  1080p output. (`src/utils/svg-to-video.js`, `src/components/download-vector.vue`)

## 2026-07-11 — v2.5.9

- **Materials-and-roles design system** — palette converted to OKLCH (fixing
  an inverted OKLCH→RGB conversion matrix along the way), materials became
  static CSS custom properties with derived lighten/fill/darken weights, and
  a new `--info` role gives status messaging a neutral color distinct from
  `--accent`. Backed by automated contrast/harmony guardrail tests so future
  palette tuning can't silently break contrast. (`src/style/variables.styl`,
  `src/utils/color-converters.js`, `docs/color-system.md`,
  `tests/style/color-harmony.spec.js`,
  `tests/style/oklch-conversion-accuracy.spec.js`)
- **`/colors` view** — the material/role palette renders live in-app as a
  design tool, not just docs: swatches, roles, a "Geology over surfaces"
  demo, and a Depth demo wired to live custom properties. Widened alongside
  `/account` for a less cramped content container.
  (`src/views/Colors.vue`, `src/router.js`)
- **Stylus → native CSS migration** — element styles that don't need a
  preprocessor mixin or a derived breakpoint moved to plain `.css`; Stylus
  stays only where real mixins or breakpoint math are needed (`dialog`,
  `nav`, `form-controls`, `svg`). (`src/style/`)
- **Shared `focus-ring()` mixin** — fixed several places where keyboard
  focus indicators were silently dropped. (`src/style/mixins/standards.styl`,
  `src/App.vue`, `profile/as-dialog-preferences.vue`,
  `thoughts/as-feed-toggle.vue`)
- **Realness mosaic logo** — the app icon/logo went from a placeholder glyph
  to a mosaic-style mark: palette colors, smalti masks, an even gutter, and
  physical, interaction-driven motion — per-tile ambient drift, a two-palette
  color cycle, and a press-to-flatten snap that rewinds to zero via the Web
  Animations API instead of resuming mid-cycle. Tile markup was later
  refactored onto `data-tile` attributes with a `<use>` overlay for the press
  color-snap, and press handling moved to pointer capture so it's reliable on
  touch, not just mouse `:active`. (`src/components/icon.vue`,
  `public/icons.svg`, `scripts/generate-icons.js`)
- **Pricing split into a per-tier carousel** — `/pricing` now redirects to
  `/pricing/endorse`, with `/pricing/:tier` driving which of the three tiers
  (Endorse, Teams, Organizations) is shown; tier nav links, prev/next
  buttons, and touch swipe all stay in sync with the URL.
  (`src/views/Pricing.vue`, `src/router.js`, `src/prerender/entry-server.js`)
- **Switched from a source-available license to GPL-2.0** — closes the gap
  that let closed forks exist under the old terms, while keeping
  self-hosting/redistribution as already granted. The "Realness" name/logos
  stay trademarked outside the GPL grant; commercial tiers become a support
  and indemnification contract, not a license gate. `src/potrace/`, a JS
  port of Peter Selinger's potrace via node-potrace, now carries proper
  GPL-2.0 attribution. (`LICENSE`, `README.md`, `package.json`,
  `src/potrace/README.md`)
- **Drag-and-drop image upload** — dropping a photo (or SVG) onto the app
  queues it the same way paste already does; dropped/pasted SVGs now resize
  through the vectorize rasterize path instead of failing the raster-only
  assumption the resize step made before. (`src/App.vue`,
  `src/use/vectorize.js`)
- Small fixes along the way: an invisible compose caret in dark mode, a
  malformed `--basalt-transparent` reference in the sign-out dialog, `h6`
  font-size pinned constant by a `clamp()` bound-order bug, button/checkbox
  styling leaks on the Colors Roles demo, a `display: block` override
  clobbering the Colors header, the sponsor Buy Button reflowing tier cards
  while its iframe loads, and the generated support-page TOC no longer
  tracked in git (built at `dev` start instead).

## 2026-07-04 — v2.5.8

- **Instance capabilities** — the app probes `/capabilities` on its own
  origin at runtime to discover optional `realness-functions` features (push,
  phone integrity), falling back to a shipped `capabilities.json` (all features
  off) for web-only instances. No build-time env vars required. Web push
  notifications gate on the `push` capability and phone sign-on runs a Twilio
  Lookup check before SMS when `phone_integrity` is on. Firebase auth split
  into `serverless-auth.js` with its own vendor chunk so the auth bundle only
  loads when needed. (`src/use/instance-capabilities.js`,
  `src/utils/phone-integrity.js`, `src/utils/serverless-auth.js`,
  `firebase.json`, `README.md`)
- **Deleted posters stay gone** — when an admin deletes a poster, visitors
  who had it cached kept seeing an empty figure with 404-ing geology layers,
  and the cached HTML let `build_local_directory` resurrect it on every
  directory read (wiping the DB was the only fix). `as-figure` now detects
  missing cutout layers on posters new enough to have them and emits
  `missing`; `remove_missing_poster` purges the poster HTML, shadow, and every
  geology layer key from IndexedDB, clears the author's cached directories,
  and re-reads the main poster directory from the network to reconcile the
  feed. Admin delete (`Large.delete`) also purges local layer keys so they
  don't linger and 404 after a delete. (`posters/as-figure.vue`,
  `views/Thoughts.vue`, `persistence/Large.js`, `utils/geology.js`)
- **Root indexable** — the home route dropped its `noindex, nofollow` meta so
  search engines can crawl the app shell, not just the marketing pages.
  (`index.html`)
- **Thoughts shell drops after mount** — the static `<h1>Thoughts</h1>` LCP
  shell is removed from the DOM once Vue mounts, so the prerendered
  placeholder doesn't linger over the live feed. (`views/Thoughts.vue`)
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
dark mode by 2018 and steady releases through v1.x. Experiments from 2018 to
2022 led to the poster emerging as the core creative object. Most of that
social surface was deliberately shed in 2026 (v2.5.3) to focus the app on
posters and thoughts.
