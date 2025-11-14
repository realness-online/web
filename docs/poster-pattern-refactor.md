# Poster Pattern Refactor Plan

## Goal

The pattern markup of our as-svg.vue is stored as a standalone asset, similar to cutouts.

## Architecture Decision

Patterns are rendered in hidden SVG containers within parent components (`as-figure.vue` and `as-svg-processing.vue`), not inside `as-svg.vue`. This mirrors how cutout symbols are handled - they're defined once in hidden SVG and referenced via fragment identifiers. This keeps `as-svg.vue` focused on rendering the poster structure while patterns are managed at the figure level.

## Memory Considerations

- **Avoid loading data into memory unnecessarily** - Load HTML directly and inject it (like `as-symbol`), don't extract paths/elements into JavaScript objects.
- **Pattern HTML contains everything needed** - No need to parse and extract individual path elements when the HTML can be injected directly.
- **Only use vector props during processing** - When creating new posters, vector paths are needed for reactive updates. When loading saved posters, use HTML injection instead.

## Tasks

### 1. **audit-current-usage**

- Catalog the props/helpers in `as-svg.vue`, `as-figure.vue`, and `as-svg-processing.vue`.
- Capture how `use/poster.js` prepares poster state.
- Review `use/vectorize.js` saving logic to see what DOM fragments are persisted

### 2. **design-pattern-architecture**

- Use fragment identifiers (globally unique) for gradients/masks references.
- Specify a `Pattern` persistence helper mirroring the existing `Cutout` class.
- Remove `<g>` wrapper from `as-path.vue` - paths render directly with visibility styles.

### 3. **refactor-components-to-symbols**

- **Patterns are NOT rendered inside `as-svg.vue`** - they are only rendered in hidden SVG containers in parent components.
- Update `as-figure.vue` to add hidden `<as-pattern>` in the hidden SVG cache (alongside symbols).
- Update `as-svg-processing.vue` to use `<as-pattern>` with `new_vector` and `itemid` props in hidden SVG.
- Components render `<as-pattern>` in hidden SVG containers - composable handles all logic internally.
- Pattern references are resolved via fragment identifiers from the hidden SVG containers.
- Update `as-svg.vue` to reference pattern via fragment identifier instead of rendering it.

### 4. **persist-pattern-storage**

- Introduce a `Pattern` storage class (extending the same mixins as `Cutout`).
- In `use/vectorize.js`, clone the `<pattern>` node from the poster (with paths inside), save it through the new storage class, and remove it from the poster clone before persisting.
- **Keep the original pattern ID** (`${as_query_id(id)}-shadow`) - don't change it when saving.
- Paths stay in the pattern - they are NOT extracted to poster HTML (unlike initial approach).
- **Pattern component should work like `as-symbol`** - load HTML directly and inject with `v-html`, NOT extract paths into memory.
- In `as-pattern.vue`, when `itemid` is provided (and no `vector` prop):
  - Load pattern HTML from IndexedDB using `get(itemid)` (pattern uses same itemid as poster).
  - Use `hydrate()` to convert HTML string to DocumentFragment.
  - Extract pattern element's innerHTML and inject directly into `<pattern>` element using `v-html`.
  - No need to extract paths into vector object - pattern HTML contains everything needed.
- This mirrors how cutouts work - they load HTML and inject it, not extract data into memory.

### 5. **handle-timing-and-validation**

- Add `v-if` guards in `as-pattern.vue` for undefined paths (`vector?.background`, `vector?.light`, etc.).
- Add `v-if` guards in `as-svg-processing.vue` for undefined cutouts (`new_vector.cutouts?.sediment`, etc.).
- In `as-svg.vue`, when setting `sync_poster`:
  - Set `vector.value` first.
  - Use `tick()` to wait for reactive updates.
  - Validate with `is_vector()` after tick before emitting 'show' and setting `working = false`.
- This ensures vector is fully populated before validation and rendering.

### 6. **refactor-as-pattern-to-load-html**

- **Change `as-pattern` to work like `as-symbol`** - load HTML directly instead of requiring vector paths.
- When `itemid` prop is provided (and no `vector` prop):
  - Load pattern HTML from storage using `get(itemid)`.
  - Use `hydrate()` to convert to DocumentFragment.
  - Extract pattern element's innerHTML.
  - Inject directly into `<pattern>` element using `v-html`.
- When `vector` prop is provided (processing context):
  - Continue using `as-path` components with vector paths (for new posters being processed).
- This eliminates the need to extract paths into memory when loading saved posters.

### 7. **regression-checks**

- Run lint/type checks on modified files.
- Manually process an image to ensure:
  - The pattern saves alongside cutouts.
  - Processing posters render using the shared context.
  - Saved posters reload the cached pattern without prop plumbing.
  - Vector validation passes after reactive updates complete.
