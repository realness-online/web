# Poster Pattern Refactor Plan

## Goal

The pattern markup of our as-svg.vue is stored as a standalone asset, similar to cutouts.

## Architecture Decision

This keeps `as-svg.vue` focused on rendering the poster structure while patterns are managed as separate components

Patterns are item and microdata aware - they use `itemscope`, `itemtype="/patterns"`, and `itemid` attributes (like `itemid="${id}-shadow"`), matching the same pattern used by cutouts and posters for structured data.

**Key Learnings:**

- Separate components for processing vs. saved: `as-pattern-processing.vue` and `as-pattern.vue`
- No injection dependencies
- Use composables to manage pattern state and loading
- `as-pattern-processing.vue` uses hydration (works with vector props during processing)
- `as-pattern.vue` uses composable to load HTML string, renders directly in template (no DOM injection)
- No querySelector guards - assume data exists and handle errors at higher level
- Render pattern element directly in SVG template (not in `<defs>`, not via DOM manipulation)

## Memory Considerations

- **Avoid loading data into memory unnecessarily** - Load HTML string via composable, render with v-html (like `as-symbol`), don't extract paths/elements into JavaScript objects.
- **Pattern HTML contains everything needed** - No need to parse and extract individual path elements when the HTML can be rendered directly.
- **Only use vector props during processing** - When creating new posters, vector paths are needed for reactive updates. When loading saved posters, use composable to load HTML string and render it.

## Tasks

### 1. **audit-current-usage**

- Catalog the props/helpers in `as-svg.vue`, `as-figure.vue`, and `as-svg-processing.vue`.
- Capture how `use/poster.js` prepares poster state.
- Review `use/vectorize.js` saving logic to see what DOM fragments are persisted

### 2. **design-pattern-architecture**

- Use fragment identifiers (globally unique) for gradients/masks references.
- Specify a `Pattern` persistence helper mirroring the existing `Cutout` class.
- Patterns use microdata attributes: `itemscope`, `itemtype="/patterns"`, and `itemid="${id}-shadow"`.
- Remove `<g>` wrapper from `as-path.vue` - paths render directly with visibility styles.

### 3. **refactor-components-to-symbols**

**CRITICAL: SVG Fragment Reference Limitation**

- SVG fragment references (`url(#id)`) only work within the same SVG document.
- Patterns CANNOT be in a separate hidden SVG and referenced from `as-svg.vue`.
- Patterns must be in the same SVG document where they're referenced.
- **Solution**: Patterns are rendered directly in the SVG template (not in `<defs>`), using composables to manage state and loading.

**Component Split:**

- Create `as-pattern-processing.vue` - renders patterns during creation/processing

  - Takes `vector` prop (required) for reactive rendering
  - Takes optional `itemid` prop
  - No injection dependency - explicit props only
  - Uses hydration when needed (for processing vector data)
  - Used during processing phase when vector data is available

- Refactor `as-pattern.vue` - loads saved patterns from storage
  - Takes `itemid` prop (required)
  - Uses composable to load HTML string from storage
  - Renders pattern element directly in template using v-html (no DOM injection)
  - No injection, no hydration, no querySelector, no guards - composable handles loading
  - Used when displaying saved posters

**Implementation:**

- **During processing**: Pattern component renders directly in `as-svg` template (not in `<defs>`)
- **When loading saved**: Pattern component renders directly in `as-svg` template using composable-loaded HTML
- Pattern components render `<pattern>` element directly - no wrappers, no `<defs>`
- Update `as-svg.vue` to render pattern component directly in SVG (same document for fragment references)

### 4. **persist-pattern-storage**

- Introduce a `Pattern` storage class (extending the same mixins as `Cutout`).
- In `use/vectorize.js`, extract the `<pattern>` node from the SVG (not from `<defs>`, not from a separate hidden SVG), save it through the new storage class.
- Pattern elements have `itemscope`, `itemtype="/patterns"`, and `itemid="${id}-shadow"` attributes for microdata.
- **Keep the original pattern ID** (`${as_query_id(id)}-shadow`) - don't change it when saving.
- Paths stay in the pattern - they are NOT extracted to poster HTML (unlike initial approach).
- **Extend pattern composable to handle loading**:
  - Add pattern HTML loading logic to `use/pattern.js` composable
  - Composable provides reactive `pattern_html` ref that loads from storage when `itemid` is provided
  - Composable handles `load(itemid)` then `get(itemid)` internally
- **Pattern component renders via composable**:
  - In `as-pattern.vue`, when `itemid` is provided:
    - Use composable to get `pattern_html` ref
    - Render `<pattern>` element directly in template with `v-html="pattern_html"`
    - **NO DOM manipulation, NO injection** - just render in template
    - Pattern HTML contains everything needed - composable loads it, component renders it
  - In `as-pattern-processing.vue`, when `vector` prop is provided:
    - Uses hydration when processing vector data (similar to how cutouts work during processing)
    - Renders reactively using `as-path` components with vector paths
- This uses Vue's reactive system instead of DOM manipulation - composable manages state, component renders it.

### 5. **handle-timing-and-validation**

- Add `v-if` guards in `as-pattern-processing.vue` for undefined paths (`vector?.background`, `vector?.light`, etc.).
- Add `v-if` guards in `as-svg-processing.vue` for undefined cutouts (`new_vector.cutouts?.sediment`, etc.).
- In `as-pattern.vue`, add `v-if` guard for `pattern_html` to ensure HTML is loaded before rendering.
- In `as-svg.vue`, when setting `sync_poster`:
  - Set `vector.value` first.
  - Use `tick()` (imported as `nextTick as tick` from 'vue') to wait for reactive updates.
  - Validate with `is_vector()` after tick before emitting 'show' and setting `working = false`.
- This ensures vector is fully populated before validation and rendering.

### 6. **extend-pattern-composable**

- **Extend `use/pattern.js` composable to handle loading saved patterns**:
  - Add `pattern_html` ref that loads HTML string from storage
  - When `itemid` is provided (and no `vector`), composable loads pattern HTML using `load(itemid)` then `get(itemid)`
  - Composable handles loading state internally
  - Returns `pattern_html` ref for component to use
- **Update `as-pattern.vue` to use composable**:
  - Use composable's `pattern_html` ref
  - Render `<pattern>` element directly in template with `v-html="pattern_html"`
  - No DOM manipulation, no injection - just reactive rendering
- `as-pattern-processing.vue` handles the processing case separately with vector props and hydration.
- This eliminates the need to extract paths into memory when loading saved posters.

### 7. **regression-checks**

- Run lint/type checks on modified files.
- Manually process an image to ensure:
  - The pattern saves alongside cutouts.
  - Processing posters render using the shared context.
  - Saved posters reload the cached pattern without prop plumbing.
  - Vector validation passes after reactive updates complete.

## Common Pitfalls to Avoid

1. **SVG Fragment References**: Cannot reference patterns across separate SVG elements. Must be in same SVG document.
2. **Component Split**: Don't try to handle both processing and saved cases in one component - split into `as-pattern-processing.vue` and `as-pattern.vue`.
3. **Injection Dependencies**: Don't rely on Vue injection for vector/new_vector - use explicit props. Injection is unstable and makes debugging harder.
4. **Over-Engineering Loading**: Use composable to manage loading - don't use hydration/querySelector/guards in `as-pattern.vue`. Composable handles loading, component just renders. `as-pattern-processing.vue` may use hydration for processing vector data, but `as-pattern.vue` should not.
5. **No DOM Manipulation**: Don't use DOM injection or manipulation - render pattern element directly in template using composable-provided HTML string with v-html.
6. **No `<defs>` Section**: Patterns render directly in SVG template (not in `<defs>`), but still in same SVG document for fragment references to work.
7. **Type Assertions**: Use destructured type assertions to satisfy linter: `const { itemid } = /** @type {{ itemid: Id }} */ (props)`
8. **Timing**: Patterns must exist in DOM before they can be referenced - Vue's reactivity ensures pattern renders when composable loads the HTML.
