# Video Rendering Progress Saving Plan

## Overview

Save rendering progress to IndexedDB so renders can be resumed if interrupted (page refresh, crash, etc.)

## Storage Structure

### Job Metadata

```javascript
{
  job_id: string,           // Unique ID: `${itemid}-${fps}-${duration}-${width}x${height}`
  itemid: string,           // Poster itemid
  total_frames: number,
  canvas_width: number,
  canvas_height: number,
  fps: number,
  duration: number,
  animation_speed: string,
  started_at: timestamp,
  completed_frames: number[],  // Array of frame indices that are done
  last_updated: timestamp
}
```

### Frame Data

- Key: `video:frame:${job_id}:${frame_index}`
- Value: `ImageData` or `Blob` (PNG/JPEG encoded frame)

## Implementation

### 1. Create Job ID Function

```javascript
const get_job_id = (itemid, fps, duration, width, height) => {
  return `${itemid}-${fps}-${duration}-${width}x${height}`
}
```

### 2. Check for Existing Progress

```javascript
const check_existing_progress = async job_id => {
  const metadata = await get(`video:job:${job_id}`)
  if (!metadata) return null

  // Check which frames are saved
  const saved_frames = []
  for (let i = 0; i < metadata.total_frames; i++) {
    const frame_data = await get(`video:frame:${job_id}:${i}`)
    if (frame_data) saved_frames.push(i)
  }

  return {
    metadata,
    saved_frames,
    resume_from: saved_frames.length
  }
}
```

### 3. Save Frame as It's Rendered

```javascript
// After rendering frame to canvas
const image_data = ctx.getImageData(0, 0, canvas_width, canvas_height)
await set(`video:frame:${job_id}:${current_frame}`, image_data)

// Update metadata
metadata.completed_frames.push(current_frame)
metadata.last_updated = Date.now()
await set(`video:job:${job_id}`, metadata)
```

### 4. Resume from Saved Frames

```javascript
// On start
const existing = await check_existing_progress(job_id)
if (existing && existing.saved_frames.length > 0) {
  console.log(
    `[Video] Resuming: ${existing.saved_frames.length}/${total_frames} frames already rendered`
  )

  // Load saved frames
  for (const frame_index of existing.saved_frames) {
    const image_data = await get(`video:frame:${job_id}:${frame_index}`)
    ctx.putImageData(image_data, 0, 0)
    // Feed to MediaRecorder...
  }

  // Continue from where we left off
  current_frame = existing.resume_from
}
```

### 5. Cleanup After Completion

```javascript
// After video is complete
for (let i = 0; i < total_frames; i++) {
  await del(`video:frame:${job_id}:${i}`)
}
await del(`video:job:${job_id}`)
```

## Storage Considerations

**ImageData Size:**

- 623x512 pixels × 4 bytes = ~1.3MB per frame
- 4128 frames × 1.3MB = ~5.4GB total

**Options:**

1. **Save as PNG/JPEG Blobs** - Compress frames (smaller, but slower)
2. **Save every N frames** - Only save keyframes, re-render in between
3. **Save to disk** - Use File System Access API if available
4. **Limit storage** - Only save last N frames, or oldest incomplete job

## UI Considerations

- Show "Resuming..." state if progress found
- Show "X/Y frames saved" indicator
- Option to "Clear saved progress" to start fresh
- Show when frames are being loaded from cache vs rendered new

## Benefits

- Survive page refresh/crash
- Resume long renders (4128 frames = ~3-4 hours)
- Reuse frames if parameters match
- Clear indication of what's cached vs new

## Trade-offs

- IndexedDB size limits (browsers typically allow 50% of disk)
- Memory usage (loading saved frames)
- Cleanup needed for old/incomplete jobs
- Versioning if render params change
