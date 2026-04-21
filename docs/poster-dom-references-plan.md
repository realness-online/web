# Poster DOM References Plan

A plan to show the same poster in many places (feed, profile hero, etc.) without mounting multiple full poster SVGs, while keeping **HTML as the source of truth** and avoiding a parallel copy of poster markup in JavaScript.

## Context

- Today, each `poster-as-figure` mounts a full `as-svg` tree. The same `itemid` can appear many times; duplicate **ids** (`as_query_id`, gradient defs, `getElementById` lookups) conflict and work is duplicated.
- Goal: **one definition per poster id in the document**, many **references** elsewhere; **no** serializing poster DOM into JS caches as the primary model.
- SVG-native way to reference: **`<use href="#fragment">`** against a **`<symbol>`** or other stable element with a document-unique id.

---

## 1. Target architecture

### Canonical definition

- For each poster id that must be reusable, the document holds **exactly one** subtree that defines the artwork (e.g. `<symbol id="…">` in a defs or sprite region, or one agreed root node id).
- Id scheme should stay aligned with existing helpers (`as_query_id` / `itemid`) so `querySelector('[itemid="…"]')` and fragment ids stay consistent with the rest of the app.

### Duplicate slots

- Feed rows (or thumbnails) render **only** a lightweight wrapper plus **`<use href="#canonical-id">`** (and layout, a11y wrapper, click targets as needed).
- No second copy of gradients, masks, or full poster markup in those rows.

### Where the definition lives

- If the canonical node lives **only** inside a **virtualized** or conditional row, removing the row removes the id and **breaks** all `<use>` targets that pointed at it.
- Long-term, either:
  - **Hoist** definitions to a stable region (e.g. hidden defs/sprite attached to the app shell or layout), or
  - Accept that **definition lifetime** equals **row lifetime** and recover when the row is gone (see Section 3).

---

## 2. MutationObserver: detect when a reference target is gone

Browsers do not fire a dedicated event when an `<use>` target disappears. **MutationObserver** is the DOM-native way to notice when the tree changes.

### What to observe

- Prefer a **narrow root**: the feed container, the profile main column, or `#app` ... not necessarily `document.body`, to limit noise.
- Options: `childList: true`, `subtree: true` (needed if the canonical can be nested deep).

### What to detect

- On **`removedNodes`**, walk each removed node (and optionally its subtree if you only get the root):
  - If the removed node **has** the tracked id, or **contains** the element with `id === canonicalId`, the definition for that poster id is gone.
- Optionally maintain a **Set** of watched ids (poster fragment ids) and only run heavier checks when a removed subtree might have contained one of them.

### Debouncing

- Many list updates can fire rapid mutations; **debounce** or **queueMicrotask** a single reconciliation pass per frame so duplicate rows do not all scan the tree at once.

### Pair with a truth check

- After observer fires (or on duplicate mount), **`document.getElementById(canonicalId)`** (or scoped `querySelector` if ids are scoped to a container). If **null**, the reference is broken; trigger recovery (Section 4).

---

## 3. Ordering: duplicate before canonical

- On mount, a duplicate row may **run before** the canonical exists.
- Flow:
  1. Try **`getElementById` / fragment resolve** for the canonical id.
  2. If missing, either **render full poster once** in this slot (and become canonical), or **wait** (short `requestAnimationFrame` / `MutationObserver` until the id appears), depending on product rules.
  3. Avoid infinite wait: cap retries or fall back to full render.

---

## 4. Recovery when the reference is lost

When the observer (or `getElementById`) says the canonical id is missing:

1. **Promote** this duplicate to a full `as-svg` / `as-figure` render (it becomes the new canonical), or
2. **Find** another node with the same `itemid` in the tree and re-point (only if ids are unique and that node is a full definition), or
3. **Reload** from existing persistence paths (`load`, IndexedDB) as today, then render once.

Exact policy is product-specific; the plan is to centralize **“reference invalid → reconcile”** in one place (composable or small module) used by duplicate rows.

---

## 5. Optional: CustomEvents (explicit signals)

- **MutationObserver** catches removals that bypass Vue (e.g. third-party DOM, manual edits). **Vue** can still emit a **CustomEvent** on `document` or a feed root in **`onBeforeUnmount`** when the component that owns the canonical id is torn down: `detail: { id, itemid }`.
- Duplicates **`addEventListener`** the same target and react quickly; **still** verify with **`getElementById`** so events are hints, not the only truth.
- Use this if you want fewer observer callbacks and explicit control paths; keep a **safety net** observer or polling for gaps.

---

## 6. Relationship to existing code

- **`as-svg.vue`**: root `:id="query()"`, defs, `itemid` attribute; `sync_poster` avoids duplicate **load** but not duplicate **ids** if two full SVGs mount.
- **`vectorize.js` / `download-vector.vue` / others**: `document.querySelector(\`[itemid="${id}"]\`)`and`getElementById(as_query_id(...))` assume **one** match; duplicates must not create ambiguous globals, or call sites must scope to a **known element** (ref) later.
- **Tests**: add cases for “two slots, one canonical,” “canonical removed, duplicate promotes,” and observer cleanup on unmount.

---

## 7. Implementation phases (suggested)

1. **Spike**: one static `<symbol>` + two `<use>` nodes in a dev page; confirm ids and `url(#…)` resolution with a single defs block.
2. **Hoist or define canonical lifecycle**: decide where the single definition lives (sprite vs first row).
3. **Duplicate row component**: renders `<use>` + observer subscription + `getElementById` reconcile.
4. **Wire feed**: replace or branch `poster-as-figure` where duplicates are allowed.
5. **Harden**: observer disconnect on unmount, debounce, memory leak checks.
6. **Adjust download/export paths** if they still assume a single global match.

---

## 8. Open questions

- Should **interaction** (keyboard, menu, meet/slice) live only on the canonical poster, or should every `<use>` wrapper forward focus to a single primary instance?
- Should **hero + feed** dedupe at the **data** layer (do not emit duplicate poster entries) in addition to DOM references?
- **External SVG** `href` (file + fragment) for even stricter isolation: worth it for CORS and caching, or stay same-document only?

---

## References (in repo)

- `src/components/posters/as-svg.vue` ... root id and defs
- `src/use/poster.js` ... `query()` / fragment ids
- `src/utils/itemid.js` ... `as_query_id`, `as_fragment_id`, `as_layer_id`
- `src/use/vectorize.js` ... `save_poster` DOM lookup by `itemid`
