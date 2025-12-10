# Video Rendering Performance Optimization Plan

## Current Architecture

**Flow:**

1. Main thread: Prepare all frames sequentially (setCurrentTime → serialize)
2. Workers: Render pre-prepared SVG strings to ImageBitmaps (parallel)
3. Main thread: Feed frames to MediaRecorder sequentially

**Bottlenecks:**

- Frame preparation is sequential and blocking (4128 frames × ~2ms = ~8s)
- Workers wait for all frames before starting
- Encoding is sequential (one frame at a time to MediaRecorder)
- SVG serialization overhead (XMLSerializer on every frame)

## Optimization Strategies

### 1. Pipeline Architecture (High Impact)

**Goal:** Start workers as soon as we have enough frames, don't wait for all

**Approach:**

- Prepare frames in batches (e.g., 100 frames)
- As soon as a batch is ready, send to a worker
- Workers start processing immediately
- Main thread continues preparing next batch

**Benefits:**

- Workers start working ~2-3 minutes earlier (instead of waiting 8+ minutes)
- Better CPU utilization
- Perceived performance improvement

**Implementation:**

```javascript
// Pseudo-code
const batch_size = 100
const worker_queue = []

for (let batch = 0; batch < total_batches; batch++) {
  const batch_frames = await prepare_batch(batch * batch_size, batch_size)
  const worker = get_available_worker()
  worker.postMessage({ frames: batch_frames })
  worker_queue.push(worker)
}
```

**Trade-offs:**

- More complex coordination
- Need worker pool management
- Frame ordering must be maintained

---

### 2. Optimize Frame Preparation (Medium Impact)

**Current:** 2x requestAnimationFrame per frame (~2ms overhead)

**Options:**

**A. Reduce Animation Frame Waits**

- Test if 1x requestAnimationFrame is sufficient
- Or use setTimeout with minimal delay
- Measure actual SVG update time

**B. Batch setCurrentTime Calls**

- Set multiple times, then serialize once
- May not work if SVG needs time to update

**C. Use requestIdleCallback**

- Prepare frames during idle time
- Non-blocking, but slower overall

**D. Cache SVG Structure**

- Parse SVG once, clone DOM nodes
- Modify cloned nodes instead of original
- Faster than full serialization

**Benefits:**

- 30-50% faster preparation
- Less main thread blocking

---

### 3. Worker Rendering Optimizations (Medium Impact)

**Current:** Each worker processes frames sequentially

**Options:**

**A. Parallel Frame Processing in Workers**

- Use Promise.all for multiple frames
- Limited by memory (ImageBitmaps are large)

**B. Optimize ImageBitmap Creation**

- Test if resizeQuality can be lower
- Reuse OffscreenCanvas instances
- Pool ImageBitmaps if possible

**C. Reduce SVG String Size**

- Remove unnecessary attributes before sending
- Compress SVG strings (gzip/deflate)
- Use binary format instead of XML

**D. SharedArrayBuffer for Frame Data**

- Transfer frame data more efficiently
- Requires cross-origin isolation headers
- May not be worth complexity

---

### 4. Encoding Optimizations (Low-Medium Impact)

**Current:** Sequential frame feeding to MediaRecorder

**Options:**

**A. Batch Frame Feeding**

- Feed multiple frames per requestAnimationFrame
- May improve MediaRecorder efficiency

**B. WebCodecs API**

- More control over encoding
- Can encode in parallel
- Better performance, but more complex

**C. Optimize MediaRecorder Settings**

- Test different bitrates
- Try different codecs (h264 if available)
- Adjust frame rate if acceptable

---

### 5. Memory Management (Low Impact, High Stability)

**Current:** All frames in memory during encoding

**Options:**

**A. Stream Frames to MediaRecorder**

- Feed frames as workers complete
- Don't wait for all workers
- Requires frame ordering logic

**B. Release ImageBitmaps Earlier**

- Close ImageBitmaps after MediaRecorder captures
- Reduce peak memory usage

**C. IndexedDB Caching**

- Save frames as they're rendered
- Resume from cache if interrupted
- Useful for very long renders

---

### 6. Algorithmic Optimizations (High Impact, High Complexity)

**A. Skip Redundant Frames**

- If animation repeats, cache one cycle
- Reuse frames for repeated cycles
- Works well for looping animations

**B. Adaptive Frame Rate**

- Reduce FPS for slow-moving parts
- Increase FPS for fast animations
- Requires animation analysis

**C. Keyframe Extraction**

- Only render keyframes, interpolate in encoder
- Significant reduction in frames to render
- Requires encoder support

---

## Recommended Implementation Order

### Phase 1: Quick Wins (1-2 days)

1. **Pipeline Architecture** - Start workers as batches ready
2. **Reduce Animation Frame Waits** - Test 1x instead of 2x
3. **Batch Size Optimization** - Find optimal batch size

### Phase 2: Worker Optimizations (2-3 days)

4. **Optimize ImageBitmap Creation** - Lower quality, reuse canvas
5. **Stream Frames to MediaRecorder** - Don't wait for all workers
6. **Memory Management** - Close ImageBitmaps earlier

### Phase 3: Advanced (1 week+)

7. **WebCodecs API** - If browser support is good
8. **Frame Caching/Reuse** - For looping animations
9. **IndexedDB Progress Saving** - For resumability

---

## Measurement Strategy

**Metrics to Track:**

- Frame preparation time per frame
- Worker rendering time per frame
- Encoding time per frame
- Total memory usage
- Peak memory usage
- CPU utilization across cores

**Benchmarks:**

- Current: ~8s prep + ~X s render + ~Y s encode = Total
- Target: Reduce each phase by 30-50%

---

## Risk Assessment

**Low Risk:**

- Reducing animation frame waits
- Optimizing batch sizes
- Memory management improvements

**Medium Risk:**

- Pipeline architecture (coordination complexity)
- Streaming to MediaRecorder (ordering logic)

**High Risk:**

- WebCodecs API (browser support)
- Frame caching/reuse (animation analysis complexity)

---

## Success Criteria

**Phase 1 Success:**

- Workers start within 30 seconds (instead of 8+ minutes)
- 20-30% overall time reduction

**Phase 2 Success:**

- 40-50% overall time reduction
- Better memory efficiency

**Phase 3 Success:**

- 60%+ overall time reduction
- Resumable renders
- Support for very long videos (10+ minutes)
