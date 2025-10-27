# Cutouts Splitting Plan

## The Problem

Cutouts improve poster fidelity and animation potential but increase file size by 300-500%. We need to split cutouts into separate files for progressive loading, especially for low-bandwidth environments.

## The Solution

Split cutouts into 6 files based on their `data-progress` value (0-100%), which tracks when each cutout was created during the tracing process.

## File Structure

**Flat file structure (no folders):**

```
people/+phone/posters/1737178477999.html.gz       # Base poster + 0-49% cutouts
people/+phone/posters/1737178477999-50.html.gz    # 50-59% cutouts
people/+phone/posters/1737178477999-60.html.gz    # 60-69% cutouts
people/+phone/posters/1737178477999-70.html.gz    # 70-79% cutouts
people/+phone/posters/1737178477999-80.html.gz    # 80-89% cutouts
people/+phone/posters/1737178477999-90.html.gz    # 90-100% cutouts
```

### Why This Split?

- **Base file contains 0-49%**: First half of cutouts loads immediately with poster
- **Separate decade files**: Remaining 50% split across 5 files for granular progressive loading
- **Natural ordering**: Cutouts are created sequentially during tracing, `data-progress` reflects creation order
- **Animation potential**: Progress values enable time-based, staggered reveal animations
- **Flat structure**: Keeps existing storage architecture, just adds suffix files
- **All compressed**: Every file is gzipped for consistent bandwidth savings

## Current Implementation Status

### ✅ Completed

1. **Flat file storage**: Posters use `people/+phone/posters/{created_at}.html.gz` structure
2. **Progress tracking**: `src/use/vectorize.js:132` already sets `data-progress` attribute
3. **Cutouts utilities**: `src/utils/cutouts.js` has helper functions for paths and counts
4. **Preference system**: Cutout display preference exists in `src/utils/preference.js`
5. **Poster class**: `src/persistance/Storage.js:44` has dedicated `Poster` class using `Large(Cloud(Storage))` mixins

### 🔧 Needs Implementation

1. **Cutout splitting utilities in `src/utils/cutouts.js`**

   ```javascript
   /**
    * Split cutouts into progress buckets
    * @param {Element[]} cutout_elements - Array of cutout path elements
    * @returns {Object} Buckets: { base: [], 50: [], 60: [], 70: [], 80: [], 90: [] }
    */
   export const split_cutouts_by_progress = cutout_elements => {
     const buckets = { base: [], 50: [], 60: [], 70: [], 80: [], 90: [] }
     
     cutout_elements.forEach(cutout => {
       const progress = parseInt(cutout.dataset.progress || 0)
       if (progress < 50) buckets.base.push(cutout)
       else if (progress < 60) buckets[50].push(cutout)
       else if (progress < 70) buckets[60].push(cutout)
       else if (progress < 80) buckets[70].push(cutout)
       else if (progress < 90) buckets[80].push(cutout)
       else buckets[90].push(cutout)
     })
     
     return buckets
   }

   /**
    * Get cutout file path for a progress bucket
    * @param {string} base_path - Base poster path
    * @param {number} progress_bucket - Progress bucket (50, 60, 70, 80, or 90)
    * @returns {string}
    */
   export const get_cutout_file_path = (base_path, progress_bucket) => {
     return base_path.replace('.html.gz', `-${progress_bucket}.html.gz`)
   }
   ```

2. **Extend `Poster` class in `src/persistance/Storage.js`**

   - Override `save()` method to split cutouts before saving
   - Extract cutouts from poster DOM
   - Split using `split_cutouts_by_progress()`
   - **LOCAL FIRST**: Save base poster with 0-49% cutouts to IndexedDB
   - Save 5 additional cutout files (50, 60, 70, 80, 90) to IndexedDB with keys like `${id}:cutout:${bucket}`
   - **THEN** upload to network if online
   - Skip empty buckets (don't create files)
   - Add `load_cutouts()` method for progressive loading (IndexedDB first, then network)

3. **Update poster loading in `src/use/poster.js`**

   - Load base poster (existing behavior)
   - Add function to load additional cutout files on-demand
   - Parse and insert cutouts into existing SVG DOM
   - **Loading trigger (MVP)**: Click on poster to load remaining cutouts

## Loading Strategies

### Immediate Load (Always)

- Base file: `{created_at}.html.gz` contains poster + 0-49% cutouts

### Progressive Load (Conditional)

**MVP Approach: Click-to-load**
- User clicks poster → load all remaining cutout files (50-90)
- Respects bandwidth (no auto-loading)
- Clear user intent
- Simple to implement

**Future Enhancements:**
- Network-aware loading (defer on slow connections)
- Preference-based auto-loading
- Viewport-based lazy loading
- Progress indicator while loading

## Animation Opportunities

The `data-progress` attribute enables time-based animations:

### Ordered Reveal

```javascript
// Cutouts appear in creation order
path[itemprop='cutout'] {
  animation-delay: calc(var(--progress) * 0.01s);
}
```

### Staggered by File

```javascript
// Each file loads with its own animation timing
// 50.html.gz cutouts animate together, then 60.html.gz, etc.
```

### Progressive Enhancement

- Initial render: 0-49% cutouts (instant)
- User clicks: 50-69% fade in
- Continue: 70-100% load with staggered reveals

## Benefits

1. **Bandwidth-friendly**: Users on slow connections get usable poster immediately
2. **User control**: Click to load full detail respects user intent
3. **Progressive enhancement**: Basic poster → detailed poster on demand
4. **Animation potential**: Progress metadata enables creative reveal animations
5. **Local-first compatible**: IndexedDB can cache files independently
6. **Simple architecture**: Flat file structure, no folder management
7. **Consistent compression**: All files gzipped for bandwidth savings

## Implementation Priority

1. ✅ Verify progress tracking (already working in `vectorize.js:132`)
2. Create splitting utility functions in `src/utils/cutouts.js`
3. Extend `Poster` class in `src/persistance/Storage.js` with:
   - Override `save()` to split and upload cutouts
   - Add `load_cutouts()` for progressive loading
4. Update load logic in `src/use/poster.js` (click-to-load)
5. Add animation features (optional enhancement)

## Notes

- Cutouts use `itemprop="cutout"` for DOM queries
- Progress is 0-100 integer from tracer worker
- All files compressed with gzip (`.html.gz`)
- Empty buckets don't create files (saves storage)
- No migration needed - all new posters use 6-file structure
- Poster-specific logic isolated in `Poster` class, doesn't affect other types
