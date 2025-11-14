# Poster Pattern Refactor Plan

## Goal

The pattern markup of our as-svg.vue is stored as a standalone asset, similar to cutouts.

## Architecture Decision

Patterns are rendered in hidden SVG containers within parent components (`as-figure.vue` and `as-svg-processing.vue`), not inside `as-svg.vue`. This mirrors how cutout symbols are handled - they're defined once in hidden SVG and referenced via fragment identifiers. This keeps `as-svg.vue` focused on rendering the poster structure while patterns are managed at the figure level.

## Phase 1: In-Place Refactor (Components & Composables)

Extract pattern logic into composable and component while keeping pattern rendered inside `as-svg.vue`. This validates the extraction before moving to symbol-based architecture.

### 1.1 **implement-pattern-composable**

- Create `src/use/pattern.js` composable.
- Return individual computed values directly (not a bundled object):
  - `query`, `fragment` helper functions (reuse from `use/poster.js` or make common)
  - `width`, `height`, `viewbox`, `aspect_ratio`, `tabindex`
  - `vector` reference
  - Visibility flags: `background_visible`, `light_visible`, `regular_visible`, `medium_visible`, `bold_visible`
- Support vector/itemid from props, injection, or options override.
- Handle optional vector/itemid override (for processing context).
- No intermediate object - composable returns values that components use directly.

### 1.2 **implement-pattern-component**

- Create `src/components/posters/as-pattern.vue` component.
- Component accepts optional `vector` prop (override for processing).
- Component accepts optional `itemid` prop (for ID generation).
- Renders `<pattern>` element with children: `<as-background>` and 4 `<as-path>` elements.
- Uses pattern composable directly - no prop/injected/composable fallback logic.
- Composable handles vector/itemid resolution from props, injection, or options.

### 1.3 **refactor-as-svg-in-place**

- Replace inline pattern markup in `as-svg.vue` with `<as-pattern>` component.
- Pattern remains inside `as-svg.vue` `<defs>` (no symbol extraction yet).
- Verify pattern renders correctly with composable/component extraction.

### 1.4 **regression-checks-phase-1**

- Run lint/type checks on modified files.
- Verify pattern renders correctly in both `as-svg.vue` and `as-svg-processing.vue`.
- Confirm visibility toggles work.
- Ensure fragment identifiers resolve correctly.

## Phase 2: Move to Symbol Architecture

### 2.1 **audit-current-usage**

- Catalog the props/helpers in `as-svg.vue`, `as-figure.vue`, and `as-svg-processing.vue`.
- Capture how `use/poster.js` prepares poster state.
- Review `use/vectorize.js` saving logic to see what DOM fragments are persisted

### 2.2 **design-pattern-architecture**

- Use fragment identifiers (globally unique) for gradients/masks references.
- Specify a `Pattern` persistence helper mirroring the existing `Cutout` class.
- Remove `<g>` wrapper from `as-path.vue` - paths render directly with visibility styles.

### 2.3 **refactor-components-to-symbols**

- **Patterns are NOT rendered inside `as-svg.vue`** - they are only rendered in hidden SVG containers in parent components.
- Update `as-figure.vue` to add hidden `<as-pattern>` in the hidden SVG cache (alongside symbols).
- Update `as-svg-processing.vue` to use `<as-pattern>` with `new_vector` and `itemid` props in hidden SVG.
- Components render `<as-pattern>` in hidden SVG containers - composable handles all logic internally.
- Pattern references are resolved via fragment identifiers from the hidden SVG containers.
- Update `as-svg.vue` to reference pattern via fragment identifier instead of rendering it.

### 2.4 **persist-pattern-storage**

- Introduce a `Pattern` storage class (extending the same mixins as `Cutout`).
- In `use/vectorize.js`, clone the `<pattern>` node from the poster (with paths inside), save it through the new storage class, and remove it from the poster clone before persisting.
- Paths stay in the pattern - they are NOT extracted to poster HTML (unlike initial approach).
- In `use/poster.js`, when loading a poster, also load the pattern from storage and extract paths using `get_itemprops` to populate the vector object.
- Pattern component renders from vector paths - no need to load pattern HTML into DOM.

### 2.5 **regression-checks-phase-2**

- Run lint/type checks on modified files.
- Manually process an image to ensure:
  - The pattern saves alongside cutouts.
  - Processing posters render using the shared context.
  - Saved posters reload the cached pattern without prop plumbing.
