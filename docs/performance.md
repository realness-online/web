# Web app performance plan

Single place for load-time work, Safari and feed runtime, and CSS or paint concerns (`projects/web`).

## Philosophy

Defer work until needed. First paint and interactivity matter; everything else can wait. Ship less JavaScript on the critical path.

## Verification

- **Chrome Performance** or **Safari Web Inspector Timeline**: load Thoughts, scroll the Profile feed, open and close the thought overlay and dialogs, resize the window.
- Compare long tasks before and after changes; use **CPU throttle (4x)** to exaggerate.
- When investigating a hotspot, **toggle suspect CSS rules** in the Styles panel before refactoring.
- For Safari-specific feed issues, prioritize the same Timeline passes on Safari.

## Current state (snapshot)

- Font preloads for Lato (Light, Regular, Heavy) – in place
- DNS prefetch for Firebase, Google – in place
- Icon preload removed – was invalid and low value
- `manualChunks`: vendor (Vue, Firebase), utilities (libphonenumber, exifreader)
- All routes imported statically
- `init_serverless` blocks app mount
- `content-visibility` on poster `as-figure`; `will-change` on working states

## Completed work

### Safari and feed (`as-days`, Thoughts, Profile)

- **`as-days.vue` pagination sentinel** – Replaced `onUpdated` + `document.querySelector` with a ref on the last `article.day` and a watcher that calls `observe` only when the sentinel element or pagination mode warrants it. Avoids observer churn on unrelated updates.
- **`as-days.vue` feed watch** – Replaced `deep: true` on `{ statements, posters, events }` with a single computed signature (`length` + ordered `id` list per array). Refill runs when membership or order changes; avoids deep reactive traversal. In-place `posters` pushes and sorts still invalidate via id-string change.

## Planned work

### 1. Route-level code splitting (`src/router.js`)

Lazy load views so each route fetches only its component.

```js
{ path: '/posters', component: () => import('@/views/Posters') }
```

Apply to: Posters, Profile, Events, Thoughts, Relations, PhoneBook, Statements, About, Navigation.

Largest wins: Posters (potrace, as-svg stack), Profile (avatar, download, etc.).

### 2. Defer `init_serverless` (`src/main.js`)

Mount the app immediately; run `init_serverless` in the background. First route (About or Navigation) may render before auth. Sync and views that need auth should already handle loading states.

Options:

- Mount with a loading shell, resolve serverless, then show content
- Mount immediately and let `auth_changed` drive the UI; sync and router handle unauthenticated

### 3. Font preload scope (`index.html`)

Preload only **Lato-Regular** for above-the-fold LCP. Remove Light and Heavy preload; browsers fetch those on first use. Regular is the critical face.

### 4. Lazy dialogs (`App.vue`)

DialogPreferences, DialogDocumentation: use `defineAsyncComponent`. Load only when the user opens Settings or Documentation.

### 5. Lazy `FpsComponent` (`App.vue`)

Already behind `v-if="info"`. Use `defineAsyncComponent` so the FPS bundle loads only when `info` becomes true.

### 6. `preconnect` for Firebase (`index.html`)

Add `rel="preconnect"` for `https://firebasestorage.googleapis.com` (primary storage). Stronger than `dns-prefetch`: DNS + TCP + TLS. Use where you know you will fetch soon.

### 7. Scope `will-change` (`App.vue` and components)

Remove or limit `will-change` on `.working-border` and `main#realness.working`. Apply only during active animation, or rely on transform and opacity without `will-change` if the compositor already handles it. Prevents unnecessary layer promotion when idle.

Also review: `projects/web/src/components/posters/as-animation.vue` (`will-change: fill-opacity`), `projects/web/src/components/working-border.vue` (`will-change: transform`). Idle layer promotion hurts scrolling on low-end devices.

### 8. Vite chunking (`vite.config.js`)

Split **libphonenumber-js** into its own chunk or dynamic import. Used only in `phone.js` (Profile, PhoneBook). Keeps the utilities chunk smaller for routes that do not need it.

Optional: **exifreader** stays in the vectorize flow; deferring `use_vectorize` until first poster add is a larger refactor.

### 9. `content-visibility` audit

Confirm poster lists and other long lists use `content-visibility: auto` with `contain-intrinsic-size` where appropriate. Poster `as-figure` already does; audit other poster grids.

### 10. Safari and feed (optional; validate in Timeline first)

1. **Thoughts first paint** – If a long task remains after load, consider a smaller first page of days or deferring non-visible poster work. Measure before changing UX.
2. **`figure.poster` CSS** – Reduce `:has()` and grid `transition` cost on hot paths; confirm in Web Inspector (see **CSS: cost inventory** → **High awareness** below).
3. **`as-svg` filters** – Confirm cost of `filter: saturate` / `brightness` on large SVG; gate or simplify on Safari if Timeline shows paint or composite hotspots (see **CSS: cost inventory** → **Medium awareness** below).
4. **`use_feed` template calls** – Only if profiling shows `overlay_for_day` hot; caching per day in the parent is optional.

## CSS: cost inventory

Use the Performance or Timeline panel; validate on Safari when the UI is feed- or poster-heavy.

### High awareness

#### `:has()` on poster figures and layout

**Where:** `projects/web/src/components/posters/as-figure.vue` (including nested and sibling combinations such as `figure.poster:has(svg.landscape):has(+ figure.poster:has(svg.landscape))`). The thought-hint border uses `:has(svg[aria-controls][aria-expanded='false'])`.

**Why it matters:** `:has()` ties the styled element to descendant or sibling state. Chained `:has()` on many figures during scroll or resize can add more style-recalc work than a class on the same element.

**What to watch:** Long tasks when toggling grid-affecting state, resizing, or mass DOM updates in a poster grid.

**Also:** `projects/web/src/views/About.vue` uses `:has(svg.landscape)` for layout (smaller surface than the main feed).

#### `body:has(dialog[open])`

**Where:** `projects/web/src/style/elements/dialog.styl`.

**Why it matters:** The subject is `body`, so changes that affect whether `dialog[open]` matches can participate in invalidation for rules on this selector. Usually fine; note it if global styles feel sticky when dialogs open or close.

#### Attribute substring selectors on inline `style`

**Where:** `projects/web/src/components/posters/as-figure.vue` (`svg[style*='aspect-ratio']`), `projects/web/src/components/posters/as-svg.vue` (`&[style*='aspect-ratio']`).

**Why it matters:** Matching on `style*` ties layout rules to inline style text; any change to that string retriggers matching. Prefer a stable class or `data-*` attribute on the SVG if this shows up in profiling.

### Medium awareness

#### `filter` on large SVGs

**Where:** `projects/web/src/components/posters/as-svg.vue`, `as-animation.vue`, `as-svg-processing.vue` (grayscale, saturate, brightness).

**Why it matters:** Filters can add paint and composite work on large vector layers. Confirm cost on Safari before gating (see planned work item 10.3).

#### `transition: all`

**Where:** `projects/web/src/style/elements/time.styl` (`transition: all 0.24s`).

**Why it matters:** `all` widens which properties participate in transitions versus listing only properties that actually change.

#### `box-shadow` and `standard-shadow` mixin

**Where:** `projects/web/src/style/mixins/standards.styl` (`filter: drop-shadow(...)`), component-level `box-shadow` (for example `as-figure.vue` figcaption aside).

**Why it matters:** Large or stacked shadows increase paint cost. Usually fine for small UI; re-check if applied to large or frequently repainted regions.

### Lower risk and helpful patterns

#### `content-visibility` and containment

**Where:** `projects/web/src/components/posters/as-figure.vue`, `projects/web/src/components/profile/as-figure.vue` (`content-visibility: auto` with intrinsic sizing); `projects/web/src/components/posters/as-svg.vue` (`contain: layout`).

**Why it helps:** Skips some rendering for off-screen subtrees when paired with sensible `contain-intrinsic-size` or min-height.

#### Animations

**Where:** `projects/web/src/style/keyframes.styl`, components that set `animation:` on specific elements.

**Why it matters:** Continuous animations (for example pulse loops) keep compositor or main-thread work alive; prefer `prefers-reduced-motion` where you already branch (for example `as-figure.vue` shortens transitions).

## Gotchas

- **Auth timing:** If the app mounts before auth, sync, router guards, and auth-gated components must handle `undefined` `current_user` gracefully.
- **Navigation / About as default:** First route may be `/about` (non-standalone) or `/` (Navigation). Both should render without auth for first paint.
- **`defineAsyncComponent` + `v-if`:** The async chunk still loads when `v-if` becomes true. For preferences behind `v-if="!posting"`, avoid fetching before the user can open the dialog.
- **Font FOUT:** Fewer preloads can cause a brief flash of unstyled text for Light or Heavy; often acceptable if those weights are rare.
- **`preconnect` vs `prefetch`:** `preconnect` is heavier; use for one primary origin you will hit soon. Do not add for every `dns-prefetch`.

## Recommended implementation order

1. Route-level code splitting – low risk, high impact
2. `preconnect` for Firebase – trivial
3. Font preload scope – trivial
4. Lazy dialogs – low risk
5. Lazy `FpsComponent` – low risk
6. Scope `will-change` – verify animation smoothness
7. Vite chunking for libphonenumber – low risk
8. Defer `init_serverless` – higher risk; test auth flows
9. `content-visibility` audit – verify and extend
10. Safari and feed items (section 10) – only after measuring in Timeline

## Reference: files

- `src/router.js` – dynamic imports for routes
- `index.html` – font preload, `preconnect`
- `src/App.vue` – `defineAsyncComponent` for dialogs and `FpsComponent`; `will-change`
- `src/main.js` – defer `init_serverless`
- `vite.config.js` – `manualChunks` for libphonenumber
- Poster list views – `content-visibility` audit
- `src/components/posters/as-figure.vue`, `src/views/About.vue`, `src/style/elements/dialog.styl`, `src/components/posters/as-svg.vue` – CSS hotspots above

## Changelog

- **2026-04-20:** CSS inventory first pass (`:has`, filters, `will-change`, `content-visibility`, attribute selectors, `transition: all`). Merged `performance-tweaks.md`, `safari-feed-performance.md`, and `docs/css-performance.md` into this file.
