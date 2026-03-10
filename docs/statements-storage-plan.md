# Statements / Thoughts Storage – Plan

## Current State (flawed)

Statements (thoughts) are stored as a **single blob** under `localStorage.me/thoughts` (e.g. `/+/thoughts`). Each save overwrites the entire blob with the container section's `outerHTML`.

### How it works now

1. `Thought` storage class uses id = `${localStorage.me}/thoughts` (the container key)
2. `save()` finds `[itemid="${localStorage.me}/thoughts"]` in the DOM, grabs `outerHTML`, writes to localStorage
3. `list()` loads that blob, parses it, extracts thoughts via `type_as_list`
4. Add/update a thought → rewrite the entire blob

### Problems

- **Posters can be saved with thoughts** – The Thoughts view's as-days displayed both posters and thoughts with `itemid="get_my_itemid('thoughts')"`. querySelector could find that mixed section and save poster HTML into the thoughts store. Fix: removed itemid from Thoughts view, scope save to `[data-sync]`.

- **Fragile DOM dependency** – Save relies on finding the right element. If the component structure changes or the element isn't mounted, save fails silently (passes null, Local.save no-ops).

- **Bulk rewrite on every change** – One thought added = rewrite everything. Not scalable. Failure corrupts the whole store.

- **Blob doesn't match itemid pattern** – Rest of the app uses itemid-on-DOM: each entity has its own itemid, save finds that element. Thoughts break this by using a container that holds many items.

## Old System (target)

The app previously had a **per-statement** approach with an **index**:

- Save one statement at a time
- Maintain an index to know what exists
- Reference: git tag `v1.8.8` (exact implementation not yet recovered)

## What we understand

- **Poster model** (still in codebase) – Per-item storage: each poster at its own key, directory at `/+/posters/` with `{ items: [created_at, ...] }`, save updates directory. This may be the pattern statements should follow.

- **Itemid-on-DOM contract** – Components render elements with `itemid`; save finds element by itemid, persists its HTML. The element with itemid _is_ the entity.

- **Uncertainty** – The exact old statement architecture (storage keys, index structure, sync flow) wasn't verified from v1.8.8. May differ from the poster model.

## Goal

Restore the old per-statement + index system. Each statement saved individually; index tracks what exists; no blob; no accidental poster inclusion; consistent with itemid pattern.

## Next steps

1. Inspect v1.8.8 (or nearby commits) to recover the original design
2. Document the exact storage format, index structure, and save/load flow
3. Plan migration from current blob to per-statement
4. Implement, ensuring statements follow the same patterns as posters where appropriate
