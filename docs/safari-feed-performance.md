# Safari feed performance (Thoughts, Profile, `as-days`)

Goals: less main-thread work on Safari without new abstractions or heavy binding. Work items are ordered by impact vs risk.

## Done

- **`as-days.vue` pagination sentinel** - Replaced `onUpdated` + `document.querySelector` with a ref on the last `article.day` and a watcher that calls `observe` only when the sentinel element or pagination mode warrants it. Avoids observer churn on unrelated updates.
- **`as-days.vue` feed watch** - Replaced `deep: true` on `{ statements, posters, events }` with a single computed signature (`length` + ordered `id` list per array). Refill runs when membership or order changes; avoids deep reactive traversal. In-place `posters` pushes/sorts still invalidate via id-string change.

## Todo (optional, validate in Timeline first)

1. **Thoughts first paint** - If one long task remains after load, consider smaller first page of days or deferring non-visible poster work (measure before changing UX).
2. **`figure.poster` CSS** - Reduce `:has` / grid transition cost on hot paths; test with rules toggled in Web Inspector.
3. **`as-svg` filters** - Confirm cost of `filter: saturate/brightness` on large SVG; gate or simplify on Safari if Timeline shows paint/composite hotspots.
4. **`use_feed` template calls** - Only if profiling shows `overlay_for_day` hot; cache per-day in parent is optional.

## Verification

- Safari Web Inspector: Timeline while loading Thoughts and scrolling Profile feed.
- Compare long tasks before/after changes; CPU throttle 4x to exaggerate.
