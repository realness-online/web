# Memory Cleanup Improvements

## Overview
Fixed high memory usage and potential hangs during poster processing by implementing proper resource cleanup throughout the vectorization pipeline.

## Issues Identified

### 1. Blob URL Leaks in `as-svg-processing.vue`
**Problem:** Component created blob URLs in `mounted()` but never revoked them, causing memory leaks when components unmounted or queue items were removed.

**Solution:** Added `onUnmounted` lifecycle hook to revoke blob URLs when component is destroyed.

### 2. Blob Retention in Queue Items
**Problem:** `resized_blob` objects stored in queue items were never explicitly released after processing completed, keeping large image data in memory.

**Solution:** Created `cleanup_queue_item()` helper function to null out blob references before removing items from queue.

### 3. ImageBitmap Memory Leaks
**Problem:** ImageBitmap objects created during image processing were never explicitly closed, preventing garbage collection.

**Solution:** Added `bitmap.close()` calls after bitmap usage in:
- `resize_to_blob()`
- `vectorize()`
- `rasterize_svg()`

### 4. Worker Event Listener Accumulation
**Problem:** Workers were reused across processing tasks but event listeners weren't removed, causing memory leaks and potential duplicate message handling.

**Solution:** 
- Added `removeEventListener()` calls in `mount_workers()` before terminating old workers
- Added proper cleanup in `dismount()` lifecycle hook
- Removed redundant listener removal from `optimized()` function since workers are reused

### 5. Incomplete Cleanup on Dismount
**Problem:** When the vectorize composable was dismounted, workers were terminated but event listeners weren't removed and queue items weren't cleaned up.

**Solution:** Enhanced `dismount()` to:
- Remove all event listeners before terminating workers
- Clean up all remaining queue items
- Call `reset()` to revoke source image URLs

## Changes Made

### `web/src/components/posters/as-svg-processing.vue`
```javascript
// Added unmounted lifecycle hook
unmounted(() => {
  if (thumbnail_url.value) {
    URL.revokeObjectURL(thumbnail_url.value)
    thumbnail_url.value = ''
  }
})
```

### `web/src/use/vectorize.js`

#### New Helper Function
```javascript
const cleanup_queue_item = item => {
  if (item?.resized_blob) {
    item.resized_blob = null
  }
}
```

#### Enhanced Worker Management
- Added event listener removal in `mount_workers()`
- Added bitmap cleanup with `bitmap.close()` after image processing
- Enhanced `dismount()` with comprehensive cleanup

#### Memory Release Points
1. After creating bitmaps in `resize_to_blob()`
2. After processing images in `vectorize()`
3. After rasterizing SVGs in `rasterize_svg()`
4. When removing completed items from queue in `optimized()`
5. When composable is dismounted

## Benefits

1. **Reduced Memory Footprint:** Blob URLs and ImageBitmaps are now properly released
2. **Prevents Memory Leaks:** Event listeners and references are cleaned up on component unmount
3. **Better Resource Management:** Explicit cleanup of intermediate processing artifacts
4. **Prevents Hangs:** Proper worker cleanup prevents accumulation of stale event handlers

## Testing Recommendations

1. Process multiple images in succession and monitor memory usage
2. Navigate away from poster processing view and verify cleanup
3. Process large batches of images to ensure queue items are properly cleaned
4. Monitor browser DevTools Performance tab for memory patterns
5. Check for dangling blob URLs in `chrome://blob-internals/` (Chromium browsers)

## Future Considerations

- Consider implementing a worker pool with size limits
- Add memory usage monitoring/warnings for large queues
- Consider streaming processing for very large images
- Add progress indicators for memory-intensive operations