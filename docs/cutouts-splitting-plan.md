# Cutouts Splitting Plan

## The Problem

Cutouts improve poster fidelity and animation potential but increase file size by 300-500%. We need to split cutouts into separate files for progressive loading, especially for low-bandwidth environments.

## The Solution

Split cutouts into 6 files based on their `data-progress` value (0-100%), which tracks when each cutout was created during the tracing process.

## File Structure

```
people/+phone/posters/{created_at}/
  ├── index.html.gz      # Base poster + cutouts 0-49%
  ├── 50.html           # Cutouts 50-59%
  ├── 60.html           # Cutouts 60-69%
  ├── 70.html           # Cutouts 70-79%
  ├── 80.html           # Cutouts 80-89%
  └── 90.html           # Cutouts 90-100%
```

### Why This Split?

- **index.html.gz contains 0-49%**: First half of cutouts loads immediately with poster
- **Separate decade files**: Remaining 50% split across 5 files for granular progressive loading
- **Natural ordering**: Cutouts are created sequentially during tracing, `data-progress` reflects creation order
- **Animation potential**: Progress values enable time-based, staggered reveal animations

## Current Implementation Status

### ✅ Completed

1. **Folder-based storage**: Posters already use `{created_at}/index.html.gz` structure
2. **Progress tracking**: `src/use/vectorize.js` lines 244-248 assign progress to each cutout
3. **Cutouts utilities**: `src/utils/cutouts.js` has helper functions for paths and counts
4. **Preference system**: Cutout display preference exists in `src/utils/preference.js`

### 🔧 Needs Implementation

1. **Fix `make_cutout_path` in `src/use/vectorize.js`**

   - Add: `path.dataset.progress = path_data.progress` (currently missing)
   - This ensures progress value is preserved in DOM

2. **Cutout splitting utility in `src/utils/cutouts.js`**

   ```javascript
   export const split_cutouts_by_progress = cutouts => {
     const buckets = { base: [], 50: [], 60: [], 70: [], 80: [], 90: [] }
     // Sort cutouts into buckets based on data-progress attribute
     return buckets
   }

   export const get_cutout_filename = progress_bucket => {
     if (progress_bucket === 'base') return 'index.html.gz'
     return `${progress_bucket}.html`
   }
   ```

3. **Update `src/persistance/Cloud.js` save logic**

   - Extract cutouts from poster before saving
   - Split cutouts using `split_cutouts_by_progress()`
   - Save base poster with 0-49% cutouts to `index.html.gz`
   - Save remaining buckets to separate files

4. **Update poster loading in `src/use/poster.js`**

   - Load `index.html.gz` first (instant display with base cutouts)
   - Progressive loading strategies:
     - On click/interaction
     - Based on cutout preference
     - Based on network conditions
     - Automatic background loading

5. **Migration script**
   - Download existing posters
   - Extract and split cutouts
   - Re-upload with new structure
   - Verify integrity

## Loading Strategies

### Immediate Load (Always)

- `index.html.gz`: Base poster + 0-49% cutouts

### Progressive Load (Conditional)

- **If cutout preference disabled**: Don't load additional files
- **If cutout preference enabled**:
  - Load on poster click/interaction
  - Or background load when idle
- **Network-aware**: Defer loading on slow connections

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
// 50.html cutouts animate together, then 60.html, etc.
```

### Progressive Enhancement

- Initial render: 0-49% cutouts (instant)
- User clicks: 50-69% fade in
- Idle/background: 70-100% load silently

### Progress Bar Integration

- Visual progress indicator as cutout files load
- "Building up" effect where poster gets more detailed over time

## Benefits

1. **Bandwidth-friendly**: Users on slow connections get usable poster immediately
2. **User control**: Cutout preference determines if extra files load
3. **Progressive enhancement**: Basic poster → detailed poster as files arrive
4. **Animation potential**: Progress metadata enables creative reveal animations
5. **Local-first compatible**: IndexedDB can cache files independently
6. **Click-to-reveal**: New posters could require click to load full detail (nice UX for discovering new content)

## Implementation Priority

1. Fix `make_cutout_path` to preserve progress data
2. Create splitting utility functions
3. Update save logic to split and save cutouts separately
4. Update load logic for progressive loading
5. Create migration script for existing posters
6. Add animation features (optional enhancement)

## Notes

- Cutouts use `itemprop="cutout"` for DOM queries
- Progress is 0-100 integer from tracer worker
- Files compressed with gzip except separate cutout files (TBD if they need compression)
- Consider: Should `50.html`, `60.html`, etc. also be gzipped?
