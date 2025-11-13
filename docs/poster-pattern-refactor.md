# Poster Pattern Refactor Plan

## Goal
Move all poster pattern concerns into the shared poster composable so every consumer (viewing, processing, and creation flows) reuses the same injected context and the heavy pattern markup is stored as a standalone asset, similar to cutouts.

## Tasks

1. **audit-current-usage**
   - Catalog the props/helpers currently passed to `<as-pattern>` from `as-svg.vue`, `as-figure.vue`, and `as-svg-processing.vue`.
   - Note what `as-pattern.vue` expects today.
   - Capture how `use/poster.js` prepares poster state.
   - Review `use/vectorize.js` saving logic to see what DOM fragments are persisted (poster outer HTML + cutout symbols only).

2. **design-pattern-shape**
   - Define a single object returned by `use/poster.js` containing:
     - `pattern_id`, `pattern_itemid`, `fragment` helper, `focus` callback
     - Visibility flags for background/light/regular/medium/bold
     - Dimensions, aspect ratio, tabindex, vector reference
   - Specify how that object is exposed (computed + `provide`) so components and hidden caches can inject it.
   - Specify a `Pattern` persistence helper mirroring the existing `Cutout` class.

3. **implement-composable**
   - Build the pattern object inside `use/poster.js`, using existing preference state for visibility.
   - Provide the object via Vue injection.
   - Ensure poster hydration (loading from storage) populates the vector fields before the pattern object is consumed.

4. **refactor-components**
   - Update `as-pattern.vue` to rely on the injected pattern definition (with optional override for processing state) instead of individual props.
   - Adjust `as-svg.vue` to simply include `<as-pattern v-if="pattern_definition" />` in its `<defs>` block.
   - Update `as-figure.vue` to add the hidden `<as-pattern>` entry using the shared definition.
   - Update `as-svg-processing.vue` to create a pattern definition for the live `new_vector` and include it in the hidden `<svg>` cache.

5. **persist-pattern-storage**
   - Introduce a `Pattern` storage class (extending the same mixins as `Cutout`).
   - In `use/vectorize.js`, clone the `<pattern>` node from the poster, save it through the new storage class, and remove it from the poster clone before persisting.
   - Confirm that poster loading reattaches the stored pattern via the composable.

6. **regression-checks**
   - Run lint/type checks on modified files.
   - Manually process an image to ensure:
     - The pattern saves alongside cutouts.
     - Processing posters render using the shared context.
     - Saved posters reload the cached pattern without prop plumbing.


