# Poster Animation Override System

## Problem

When saving a poster, we save all path data which can be quite large (50-200KB). When modifying style properties (stroke, width, color), we're writing 99% unchanged data. This creates inefficiency:

- Large files saved frequently for small changes
- Duplication of path data across saves
- Difficult to add audio/animation timing to poster sequences

## Solution: Animation File as Override Instructions

Use `as-animation.vue` as the small, frequently-changing override file. It contains:

- Style overrides (stroke, fill, width, opacity)
- Animation timing
- Audio synchronization
- All instructions for modifying the base poster

Base posters remain immutable; animation/override file is applied at render time.

## Architecture

### File Structure

- **Base Poster:** `{author}/posters/{created_at}` - Large immutable SVG with all path data (saved once)
- **Animation/Override:** `{author}/posters/{created_at}-animation` - Small HTML from `as-animation.vue` (saved frequently)

### Storage Class

Create `Animation` class in `src/persistance/Storage.js`:

- Extends `Large(Cloud(Local(Storage)))`
- Uses `text/html` content type

### Animation Itemid Pattern

- Animation itemid: `{itemid}-animation`
- Example: `/+1234/posters/1000-animation`
- References the poster itemid it overrides

## HTML/Microdata Structure

The `as-animation.vue` component renders as HTML with microdata:

- `itemscope`, `itemtype="/animations"`, `itemid="{itemid}-animation"`
- Style overrides in `itemprop="overrides"` with nested `itemprop` for each path/cutout
- Animation elements (existing SVG animate elements)
- Audio reference in `itemprop="audio"`
- Sync points in `itemprop="sync-points"` list

## Implementation Plan

### 1. Save Animation File Separately

Similar to how cutouts are saved, extract and save the `as-animation` component element separately:

- In `save_poster_and_symbols()` function, also save animation: `await new Animation(\`${id}-animation\`).save(animation_element)`
- Animation element is extracted from the poster SVG before saving

### 2. Load Animation in `as-figure.vue`

Load animation file and inject animate elements directly:

- Add component that loads animation file (similar to `as-symbol` for cutouts)
- Extract animate elements from loaded animation file
- Inject animate elements directly into SVG (no `<g>` wrapper needed)
- Animate elements can be placed anywhere in SVG tree - they reference targets via `href`

### 3. Inject Animation Elements in `as-svg.vue`

Instead of using `<use>` reference:

- Loaded animate elements are injected directly into the SVG
- Can be placed in `<defs>` or directly in the main content
- No wrapper `<g>` needed - animate elements work independently
- Each animate element references its target via `href` attribute

### 4. Apply Overrides in `as-path.vue`

- Inject animation overrides via Vue `inject()`
- Merge override values with base props
- Use computed properties for effective values

### 5. Use Override Values in Animation Component

- Inject animation data and overrides
- Use override values or fallback to defaults
- Apply in template for animation attributes

## Data Flow

1. **Poster Created** → Large immutable SVG saved (`{itemid}`)
2. **Style/Animation Changes** → Small animation file saved (`{itemid}-animation`)
3. **Rendering** → `as-figure.vue` loads animation file, provides to children
4. **Override Application** → Components merge animation overrides with base props
5. **Animation** → `as-animation.vue` uses override values or defaults

## File Size Comparison

**Before (full poster save):**

- ~50-200KB with all path data
- Saved every style change

**After (animation override):**

- Base poster: ~50-200KB (saved once, immutable)
- Animation: ~1-5KB HTML (saved frequently)

**Savings:** ~95% reduction in frequently-saved data

## Benefits

- **Efficiency:** Small files for frequent changes
- **Immutability:** Base posters never change (caching/CDN friendly)
- **Simplicity:** Uses existing `as-animation.vue` component
- **Self-contained:** Animation file contains all override instructions
- **Microdata:** Follows existing HTML/microdata pattern
- **Backwards compatible:** Poster works without animation file

## Key Insight

The `as-animation.vue` component is already the "script" - it contains all the instructions for how to modify the base poster. By saving it separately (similar to how cutouts are saved), we get:

- Small, frequently-changing file (just instructions)
- Large, immutable file (path data)
- Clean separation of concerns
- Consistent pattern with cutout storage

## Pattern Consistency

This follows the same pattern as cutouts:

- Cutouts: `{itemid}-boulder`, `{itemid}-rock`, etc. → loaded with `as-symbol` → referenced with `<use>`
- Animation: `{itemid}-animation` → loaded with animation component → referenced with `<use>`
- Both use `Large(Cloud(Local(Storage)))` storage pattern
- Both are extracted from poster before saving base poster
- Both are loaded into hidden SVG in `as-figure.vue`
- Both are referenced via `<use>` elements in `as-svg.vue`
