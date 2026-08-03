# Changelog

## Unreleased

- **The favicon was a grey smudge in the tab** — the mark fills its six tiles with the smalti tessera pattern, and at 16px one tessera is about a pixel and a half, so the mosaic dithered away and the water, clay and pumice palettes averaged into a single grey. The root drawing of `icons.svg` is only ever the favicon and Safari's pinned-tab icon — every other consumer pulls a `#symbol` by id — so it now crops tight to the mark and fills flat, with pumice lifted from 0.35 to 0.72 so the ash and cinder tiles still read against a dark tab strip. `#realness` and its mosaic are untouched, and so is everywhere the mark is actually drawn.

- **Pressing the realness mark left it stuck on its solid fill** — a press snaps the six tiles together and swaps the mosaic for flat colour; letting go is supposed to fade back. The rewind that resets the drift animations collects `getAnimations()`, which hands back CSS transitions alongside keyframe animations, so it caught that fade one frame in and paused it at frame zero. Only keyframe animations get rewound now.

- **The 3D and grid preferences lost their icons** — `preference.vue`'s `icon` prop was renamed `show_icon` (as `icon` shadowed the imported `<icon>` component) and two of the three call sites in the menu still passed the old name, so the attribute fell through to the fieldset instead.

## v2.6.7 — 2026-07-31

- **Nobody could see anybody else** — v2.6.6 closed a hole that let anyone read your follow list, and in doing so took away permission to list the directory of people, so realness could only show you your own posters and thoughts. Reading the directory is allowed again, for signed-in people only. Your follow list stays private, and the phone directory is no longer readable by anyone who is not signed in.

## v2.6.6 — 2026-07-31

- **Anyone could read a person's relations file** — the guard `!path.matches('relations.html.gz')` sat on a `{path=**}` wildcard, which binds a Path rather than a string, so it never excluded the file; rules OR together, so that one permissive match handed the private follow list to any reader, signed in or not. Every match that can reach the file now excludes it by name through single-segment wildcards, and `npm run test:rules` runs `storage.rules` against the storage emulator as part of pre-commit.

- **Crawlers were locked out of the assets that render the site** — `robots.txt` disallows `/` and allows named paths back, and `/assets/` and `/fonts/` were never on that list, so the CSS, JS, and fonts behind every page we do want indexed were off limits, along with the OG images. All four are allowed now.

- **Your thoughts and posters are on screen the moment you open realness** — the feed used to wait for the whole contact list to come down from the server before it drew anything, even though your own work was already on the device. It draws what it has first, and other people fill in behind it.

- **Anything not yet on your device arrives in half the trips** — fetching a poster asked the server where the file was, then asked again for the file. Those turn out to be the same request, so realness remembers the answer.

- **Scrolling a big feed stopped stuttering** — every person in your feed made realness read through its entire local store, once each. Posters keep six layers apiece, so that added up fast on a long history. It reads once now and shares the answer.

- **Coming back to the tab is immediate** — leaving and returning kicked off filing and cleanup work that had nothing to do with what you were looking at. That runs on its own schedule now.

- **The border only lights up when realness is talking to the server** — it used to come on for anything that took a moment, including work happening entirely on your device, so it never told you much. The feed has its own quiet spinner for loading.

- **A new poster no longer rebuilds the whole feed** — any change used to reload every person on screen. Realness now knows what moved and refreshes just that.

- **Reloading no longer re-reads everyone you follow** — your own profile, thoughts, events and posters reconcile every time realness runs, so anything you make on another device still turns up right away. Reading back through other people's files is the part that runs on a schedule, and a page reload was resetting that schedule every time.

## v2.6.5 — 2026-07-28

- **Only the homepage was indexed** — Firebase appended a trailing slash to `/about`, `/docs`, `/pricing` and `/terms`, so every sitemap URL answered with a 301 and each prerendered page's `rel=canonical` pointed back at the redirecting URL. Search Console had one valid page. `trailingSlash: false` serves the prerendered HTML at the canonical URL.
- **Pressing an icon blobbed its sprite** — `svg use:active` dates from poster layer selection but matched every `<use>` in the app, so the gear (a 16-unit sprite carrying a stroke) picked up a 4px stroke that swallowed its teeth. Scoped to `svg[itemtype='/posters']`.
- **OG image is a real poster now** — a hand-picked 1280x960 jpg replaces the generated card across `index.html`, the prerender defaults, and the JSON-LD image.
- **OG candidates generated from the admin's posters** — an unlisted `/og-candidates` route mounts each landscape poster and cuts two 1200x630 frames: full bleed, and the same poster under the marketing card copy. A driver script serves `dist` and works the route in headless Chrome over the devtools protocol — no new dependencies, reusing the `CHROME_PATH` the score script already needs. `npm run og:pick` installs a chosen frame as `public/og.jpg` after checking its dimensions.
- **`npm run ship` verifies the version it just cut** — `verify` defaults to the newest GitHub release carrying a manifest, so ship was checking the previous release rather than `package.json`'s version.

## v2.6.4 — 2026-07-25

- **Download menu had no surface over a poster** — the poster footer styled its menus with a descendant selector and then reset `background`/`backdrop-filter` on anything nested, which caught the download sheet along with the author row. Footer menu rules are scoped to direct children now, and the bar's glass moved to a `::before` so the bar stops being a Backdrop Root — nested `backdrop-filter` was sampling the bar instead of the poster, leaving the sheet's blur dead.
- **PNG, PSD, and layer exports cropped the poster edges** — every raster path clones the live `<svg>`, which carries `preserveAspectRatio="xMidY… slice"` to fill its grid cell. `slice` scales to cover the target canvas, so it can only ever crop; export clones now set `xMidYMid meet` to fit the whole viewBox.
- **Download menu rebuilt** — formats are real `<button>`s (focusable, Enter activates) in a column sized to its labels; the per-layer PNG export moved from an unlabelled icon buried in the corner of the PNG button to its own chip alongside it; sheet and chip slide up on the poster grid's easing curve.

## v2.6.3 — 2026-07-24

- **Favicons and OG image matched to the bone-background icons** — `192.png`, `512.png`, and `og.png` were still generated on the old dark surface; the generator now renders them on `bone` with dark text.

## v2.6.2 — 2026-07-24

- **Storytelling mode trapped touch users** — the poster `<svg>` hardcoded `touch-action: pan-y`, blocking the horizontal swipe storytelling scrolls on; and the footer nav (the only way to reach Preferences and turn storytelling back off) unmounted whenever storytelling was on, leaving no touch-reachable escape since the toggle is keyboard-only (`w`). Fixed both: posters allow horizontal pan while storytelling, and the footer stays mounted.

## v2.6.1 — 2026-07-22

- **Homepage was blocked from indexing** — `robots.txt` disallowed `/` with no exception for the homepage itself, and `sitemap.xml` never listed it. Added `Allow: /$` and the homepage entry so Google can crawl and index it.

## v2.6.0 — 2026-07-21

- **Build no longer rewrites `public/sitemap.xml`** — every build regenerated it with today's date, leaving a perpetual uncommitted diff after each deploy. `dist/sitemap.xml` (what actually ships) is unaffected; `public/sitemap.xml` stays as the static checked-in copy until next touched deliberately.

## v2.5.13 — 2026-07-21

- **Folder sync rebuilt** — File System Access API directory handle persisted in IndexedDB, mutex-guarded queue mirrors thought/poster saves and deletes as human-readable files (date-titled thought folders, snippet-named poster SVGs/PNGs) instead of raw itemid dumps. New `sync_svg` preference toggles SVG export.
- **Account page rebuilt** — Sync folder section (choose/re-sync, live progress, Brave detection with a how-to-enable dialog) and notifications now both live under Account, visible ahead of sign-in status resolving.
- **`base-line.styl` split** — constants-only now; the actual reset/root-properties/fluid-type-scale CSS output moves to a new `reset.styl` loaded once from `index.styl`.
- **About hero fade** — tagline and hero poster now fade/rise in with the rest of the hero instead of snapping in or sitting blank; stagger tightened so the reveal settles quickly.

## v2.5.12 — 2026-07-17

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
