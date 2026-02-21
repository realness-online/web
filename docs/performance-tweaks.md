# Performance Tweaks Plan

## Philosophy

Defer work until needed. First paint and interactivity matter; everything else can wait. Ship less JavaScript on the critical path.

## Current State

- Font preloads for Lato (Light, Regular, Heavy) – correct
- DNS prefetch for Firebase, Google – good
- Icon preload removed – was invalid and low value
- manualChunks: vendor (Vue, Firebase), utilities (libphonenumber, exifreader)
- All routes imported statically
- init_serverless blocks app mount
- content-visibility on as-figure; will-change on working states

## Implementation Steps

### 1. Route-level code splitting (router.js)

Lazy load views so each route fetches only its component.

```js
{ path: '/posters', component: () => import('@/views/Posters') }
```

Apply to: Posters, Profile, Events, Thoughts, Relations, PhoneBook, Statements, About, Navigation.

Largest wins: Posters (potrace, as-svg stack), Profile (avatar, download, etc.).

### 2. Defer init_serverless (main.js)

Mount app immediately; run init_serverless in background. First route (About or Navigation) may render before auth. Sync component and views that need auth already handle loading states.

Options:

- Mount with loading shell, resolve serverless, then show content
- Mount immediately, let auth_changed drive UI; sync/router handle unauthenticated

### 3. Font preload scope (index.html)

Preload only Lato-Regular for above-the-fold LCP. Remove Light and Heavy preload. Browsers will fetch those on first use; Regular is the critical one.

### 4. Lazy dialogs (App.vue)

- DialogPreferences, DialogDocumentation: use defineAsyncComponent
- Load only when user triggers (Open Settings, Show Documentation)

### 5. Lazy FpsComponent (App.vue)

Already behind v-if="info". Use defineAsyncComponent so the fps component bundle loads only when info becomes true.

### 6. preconnect for Firebase (index.html)

Add `rel="preconnect"` for `https://firebasestorage.googleapis.com` (primary storage). More than dns-prefetch: DNS + TCP + TLS. Use where we know we'll fetch soon.

### 7. will-change scope (App.vue)

Remove or scope will-change on .working-border and main#realness.working. Only apply during active animation; or rely on transform/opacity without will-change if compositor already handles it. Prevents unnecessary layer promotion when idle.

### 8. Vite chunking (vite.config.js)

Split libphonenumber-js into its own chunk or dynamic import. Used only in phone.js (Profile, PhoneBook). Keeps utilities chunk smaller for routes that don't need it.

Optional: exifreader – stays in vectorize flow; vectorize is used from App. Could defer entire use_vectorize to first poster-add if we restructure, but that's a larger refactor.

### 9. content-visibility audit

Verify Posters list and other long lists use content-visibility: auto with contain-intrinsic-size where appropriate. as-figure already does; check poster grids.

## Gotchas

- **Auth timing**: If we mount before auth, ensure sync, router guards, and any auth-gated components handle undefined current_user gracefully. They likely already do.
- **Navigation/About as default**: First route may be /about (non-standalone) or / (Navigation). Both should work without auth for initial render.
- **defineAsyncComponent + v-if**: Async component still fetches when v-if becomes true. Combined with v-if="!posting" for preferences – ensure we don't fetch before user can open.
- **Font FOUT**: Reducing preloads may cause brief flash of unstyled text for Light/Heavy. Acceptable if those are used sparingly.
- **preconnect vs prefetch**: preconnect is heavier; use for one primary origin we know we'll hit. Don't add for every dns-prefetch.

## Order of Implementation

1. Route-level code splitting – low risk, high impact
2. preconnect for Firebase – trivial
3. Font preload scope – trivial
4. Lazy dialogs – low risk
5. Lazy FpsComponent – low risk
6. will-change scope – verify no regression in animation smoothness
7. Vite chunking for libphonenumber – low risk
8. Defer init_serverless – higher risk, test auth flows
9. content-visibility audit – verify/increment

## Files

- `src/router.js` – dynamic imports for routes
- `index.html` – font preload, preconnect
- `src/App.vue` – defineAsyncComponent for dialogs, FpsComponent; will-change
- `src/main.js` – defer init_serverless
- `vite.config.js` – manualChunks for libphonenumber
- Poster list views – content-visibility audit
