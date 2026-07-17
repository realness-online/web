# Changelog

## Unreleased

- **Verifiable releases** — Keep a changelog `## Unreleased` (hidden on `/docs` until cut); `npm version` promotes and tags, `npm run ship` publishes build-manifest + notes to GitHub. Copy points skeptics at the ritual.
- **realness-design realign** — views/components drop invented class hooks for markup state, rename `--on-emphasis` → `--contrast`, align with design skill conventions.
- **Markdown as an element stylesheet** — content typography moved from Stylus mixin into `src/style/elements/markdown.styl`.
- **Notification opt-in onboarding** — once per device after sign-in, a modal offers push when the instance supports it.
- **Mosaic logo smalti wobble** — clipped fragment paths on each tile, paced off the glint cycle, for more physical glitter.
- **Preferences markup tidy** — notifications fieldset rename, tweakpane slide simplified to attribute selectors; orphan `grid.svg` removed.
- **`npm run verify`** — deploy checksum CLI defaults clarified; docs updated for independent GitHub-manifest checks.
- **Test coverage surge** — ~2k net test lines across posters, profile, views, sync/persistence, potrace, and utils.

## v2.5.10 — 2026-07-13

- **Codebase-wide bug-fix pass** — systematic review across persistence, components, composables, workers, and 3D/potrace; fixed real bugs (mutex double-acquire, sync-queue race, tracer cross-contamination, SVG focusability, sign-in hang, textarea keymap, Three.js leaks, divide-by-zero, stalled upload queue). Every fix with a regression test.
- **Cloud archive consistency** — partial poster archive failure now rolls back cleanly instead of leaving orphaned files.
- **Pricing page rewritten as real HTML** — tier content hand-authored per semantic-HTML convention instead of generated from JS data.
- **Poster video export overhauled** — fixed ~8x-too-fast playback, cross-fade frames, 1440p/14 Mbps encode.

## v2.5.9 — 2026-07-11

- **Materials-and-roles design system** — palette converted to OKLCH, materials as static CSS custom properties with derived weights, new `--info` role. Automated contrast/harmony guardrails.
- **`/colors` view** — live palette renderer in-app with swatches, roles, geology demo, Depth demo.
- **Stylus → native CSS migration** — element styles that don't need mixins moved to plain `.css`.
- **Shared `focus-ring()` mixin** — fixed silently dropped keyboard focus indicators.
- **Realness mosaic logo** — placeholder glyph replaced with mosaic mark: palette colors, smalti masks, per-tile drift, color cycle, press-to-flatten via Web Animations API.
- **Pricing split into per-tier carousel** — `/pricing/:tier` drives tier nav, prev/next, touch swipe, all synced to URL.
- **Switched to GPL-2.0** — closed-source-license gap closed; name/logos trademarked outside GPL; commercial tiers as support contract.
- **Drag-and-drop image upload** — photos and SVGs dropped onto the app queue like paste; SVGs resize through the vectorize path.
- Small fixes: dark-mode compose caret, `--basalt-transparent` reference, `clamp()` order bug, button/checkbox style leaks, Colors header, Buy Button iframe reflow, TOC not tracked in git.

## v2.5.8 — 2026-07-04

- **Instance capabilities** — runtime `/capabilities` probe discovers optional features (push, phone integrity); falls back to shipped `capabilities.json` (all off). Firebase auth split into its own vendor chunk.
- **Deleted posters stay gone** — cached posters no longer resurrected; `remove_missing_poster` purges HTML, shadow, geology layers, and cached directories on delete.
- **Root indexable** — home route dropped `noindex` for search engines.
- **Thoughts shell drops after mount** — static `<h1>` removed from DOM once Vue mounts.
- **Preload Lato Light** — closes FCP→LCP gap from font repaint.
- **Dated poster labels** — poster SVGs announce "Poster from <day>" instead of generic "Poster".

## v2.5.7 — 2026-07-04

- **Static LCP shell for home route** — `index.html` renders `<h1>Thoughts</h1>` in `#app` at first HTML parse, gated by pathname. Placeholder `<header>` reserves real header height. LCP 2.0 s, performance 93, accessibility 100, CLS 0.002.
- **Poster SVG labels** — `role="img"` + `aria-label` + `aria-roledescription="poster"`; `aria-label` on avatar toggle, messenger `sms:` link, delete button. Lighthouse accessibility 74 → 100.
- **Fonts cached a year** — `/fonts/**` `max-age=31536000, immutable`.
- **Deleted posters drop from visitor feeds** — missing loads no longer render blank figures.

## 2026-07-03 — Removed EXIF metadata feature

- **EXIF capture + overlay removed** — iOS Photos picker strips camera/date/GPS before our code runs. Deleted exif files, preference, and capture code. Rationale: `docs/monopoly.md`.

## 2026-07-02 — Performance

- **Lazy vectorize on first paint** — `use_vectorize` loads via dynamic import after `rAF`; boot imports ~80KB lighter.
- **Deferred `init_serverless`** — Firebase auth after Vue mount to not block first paint.
- **Trimmed preconnects** — removed 8 unused preconnect/dns-prefetch links; only `firebasestorage.googleapis.com` remains.
- **Lazy InstallGuide + PreferencesMenu** — `defineAsyncComponent` for 242KB video and preferences panel.
- **CLS shell** — `#app` gets `min-height: 100dvh` to prevent layout shift on mount.
- **Stable feed render** — `Thoughts rendered` improved from 4.2s to ~2.7s.

## 2026-07-02 — Support layout, build-time TOC, scroll & swipe

- **Support layout** — site-nav rendered once by `support-layout.vue` replacing 5 hand-rolled copies.
- **Build-time TOC** — `scripts/generate-toc.js` precomputes heading trees; views import static arrays instead of runtime `markdown_toc()`.
- **Swipe-back & scroll** — removed `scrollRestoration = 'manual'`; TOC links use `router-link replace`; `scrollBehavior` handles `to.hash` with smooth scroll.
- **Mobile TOC UX** — larger sub-level fonts, `touch-action: manipulation`, heading `scroll-margin-top` for safe-area.
- **Pricing page** — padding fixes, space between buy button and actions, removed redundant price text.

## 2026-07-02 — Account, performance

- **Require a name** — nameless users redirected to `/account`; validation on save and sign-on.
- **Lazy 3D and download** — `defineAsyncComponent` for viewer and download in poster figures.
- **Smaller first feed page** — `optimize()` caps each author's directory to `SIZE.MAX` (55).

## 2026-07-02 — Discoverability & social previews

- **Open Graph cards** — marketing URLs prerender with full `og:*` and Twitter Card tags.
- **`og.png` (1200×630)** — social image with headline, value prop, CTA.
- **Meta tag pass** — titles, descriptions, `og:image:alt`, `twitter:image:alt`.
- **Sitemap & robots** — crawlable marketing pages in `sitemap.xml`; app shell unindexed.
- **Static docs** — `public/documentation.md` and `public/llms.txt` for crawlers and LLM discovery.

## 2026-07-01 — Early in the v2.5.7 cycle

- **Stripe buy buttons** wired into $100/$500 pricing tiers.
- **Mask subjects** — named path groups with grow-select/erase (WIP).
- **3D mode poster menu gesture** — reveal poster menu in 3D with same gesture as SVG mode.

## v2.5.6 — 2026-06-29

- **Blank duplicate-poster avatars fixed** — visibility-aware canonical election.
- **PSD export** — stroke stripped from shadow fill layers.
- **Statement text selectable**; touch callout suppressed on tappable elements.
- **"Copy prompt" agent buttons** inline in docs and pricing.
- **SSR hardening** — prerender and standalone guards; `var(--base-line)` in viewport-relative `calc()`s.

## v2.5.5 — 2026-06-28

- **Account overhaul** — inline sign-in, web push notification preference, Stripe reduced to CTA.
- **Pricing and legal pages** — ToS simplified (arbitration removed), LICENSE updated, `security.txt` refreshed.

## v2.5.4 — 2026-06-17

- **Install guide** — native install prompt, platform detection, synthetic walkthrough animations (HyperFrames) for iOS/Android.

## v2.5.3 — 2026-06-15

- **Big simplification** — removed phonebook, relations, events, picker; simplified profile/poster menus; expanded docs.
- **Preferences menu** — hints, icons, keybindings; animated silhouette toggle for `only_mine` feed filter.
- **About page refresh** with gallery cap and lore.
- **Archive location map** with self-healing `sync:index`.

## v2.5.1–2.5.2 — 2026-06-11

- **Prerendered marketing pages** and public site structure.
- **About page rebuilt** — integrations, feature list, balanced gallery; archive loading fixes.
- **Frosted-glass styling consolidated**; account UI polish; 3D "haze" renamed to atmosphere.

## v2.5.0 — 2026-05-31

- **Mask pen drawing tool** debuts.

## 2026-05-16 → 05-25 — v2.4.x: 3D posters land

- **3D poster viewer and export tooling** migrated in from `projects/3d`; scene motion refactored with tests; device orientation handling; iOS touch/orientation polish.

## 2026-04 → 05 — v2.3.x: platform

- **Vite+ toolchain transition.**
- **Stripe sponsorship** integrated; profile account hero; homescreen icon management.
- **One poster on the page** — deduplicated rendering; caching and performance work.

## 2026-02 → 04 — v2.0–v2.2: the Thoughts interface

- Interface re-centered around **Thoughts**; navigation removed; color scheme green → blue.
- Safari feed performance; off-screen cutout removal; feed ordering fixes.
- **Sync folder** for poster output export; download-video improvements; landscape poster swipe.
- Local dev setup simplified.

## 2025-10 → 2026-02 — v2.0.0: the rebuild

- Offline/anonymous poster creation synced after sign-in; cutouts and shadows stored for later sync; **PNG and PSD export** alongside SVG; layer naming; dark-mode color-scheme declared.

## 2024 → mid-2025 — v1.5–v1.8: the on-device tracer

- **vtracer (wasm) integrated** — on-device color-region tracer behind mosaic layers.
- Offline actions merged with sign-in sync; iPad standalone detection; preferences and docs growth.

## 2017 → 2023 — origins

First commit 2017-12-20. Realness grew up as a phone-number-identity social PWA — profiles, avatars, statements, events, phonebook — with dark mode by 2018 and steady releases through v1.x. The poster emerged as the core creative object through experiments from 2018 to 2022. Most of that social surface was shed in 2026 (v2.5.3) to focus on posters and thoughts.
