# Development Branch Release Plan

## Overview

The development branch is ready for release after integrating vtracer functionality, which adds high-fidelity vector tracing to posters. However, this integration has significantly increased poster file sizes due to the addition of trace paths

## Current State Analysis

### vtracer Integration Impact

**Size Impact:**

- Original poster structure: ~5 layers (background, light, regular, medium, bold)
- New structure: Original + potentially dozens of trace paths
- Estimated size increase: 300-500% based on trace path complexity

### Current Storage Architecture

**Client Storage:**

- localStorage: Small data (preferences, viewbox coordinates)
- IndexedDB: Large data (posters, statements, events)
- Compression: HTML content compressed before storage

**Server Storage:**

- Firebase Cloud Storage with gzip compression
- Files stored as `.html.gz` format
- Current path: `people/${author_id}/posters/${created_at}.html.gz`

## Critical Issues to Address

### 1. Storage Efficiency

- Large trace paths will significantly impact:
  - Upload/download times
  - Storage costs
  - Memory usage during processing
  - Browser performance

### 2. Backwards Compatibility

- Existing posters without trace data must continue working
- Need graceful handling of mixed poster types

### 3. User Experience

- Loading performance for trace-heavy posters
- Progressive loading vs. complete poster loading

## Proposed Refactoring Plan

### Phase 1: Storage Architecture Refactoring

**1.1 Folder-Based Storage Architecture**

```
Current: /people/${author}/posters/${created_at}.html.gz
Proposed:
  - /people/${author}/posters/${created_at}/index.html.gz (core poster)
  - /people/${author}/posters/${created_at}/50.html.gz (10% of paths)
  - /people/${author}/posters/${created_at}/60.html.gz
  - /people/${author}/posters/${created_at}/70.html.gz
  - /people/${author}/posters/${created_at}/80.html.gz
  - /people/${author}/posters/${created_at}/90.html.gz
  - etc. (segmented by path count ranges)
```

**Key Design Principles:**

- **ItemID Unchanged**: Client continues using `/people/${author}/posters/${created_at}`
- **Server-Side Folders**: Storage implementation uses folder structure transparently
- **Progressive Loading**: Load `index.html` first, then trace segments on-demand
- **Backwards Compatibility**: we will run a migration to convert exiting poster

**1.2 Update Storage Functions**

- Modify `src/utils/itemid.js#as_filename()` to return `${created_at}/index.html.gz` for new posters
- Update `src/utils/itemid.js#load_from_network()` to handle folder-based loading
- Add trace segment loading functions
- Maintain fallback to single-file format for existing posters

**1.3 Trace File Segmentation Strategy**

- **Segment Size**: ~100KB per file (similar to `SIZE.MAX` optimization triggers in existing storage)
- **Naming Convention**: `${segment_range}.html.gz` (50.html = paths 0-49)
- **Content Format**: Each segment contains HTML with trace path elements
- **Compression**: Individual gzip compression per segment file
- **Pattern Match**: Similar to Statement/Event archiving in `src/persistance/Paged.js` but applied to trace data

### Phase 2: Queue-Based vtracer Architecture

**2.1 Current Single-Poster Processing Problem**

- Current: Each poster creates its own tracer worker (`src/use/vectorize.js:149`)
- Limitation: Only one poster can be traced at a time, tied to UI navigation
- User Experience: Cannot process multiple posters, does not take advantage of background process

**2.2 Proposed Queue-Based vtracer System**

- **Decouple from UI**: vtracer runs independently of poster creation UI flow
- **Queue Architecture**: Build on existing mutex system in `src/utils/algorithms.js`
- **Background Processing**: Queue processes posters that need tracing regardless of UI state
- **Multi-Poster Support**: Users can create multiple posters, queue handles tracing order
- **Persistent Queue**: Queue survives page reloads and continues processing

**2.3 Queue System Design**

- **Queue Storage**: Use IndexedDB to persist pending trace jobs
- **Job Structure**: `{itemid, image_data, priority, status, progress}`
- **Queue States**: `pending`, `processing`, `completed`, `failed`
- **Single Worker**: One persistent tracer worker processes queue sequentially
- **Progress Updates**: Queue broadcasts progress updates to UI components that care

**2.4 UI Flow Changes**

- **Immediate Navigation**: Create poster → navigate to editor (no waiting for tracer)
- **Queue Integration**: Add poster to trace queue automatically
- **Progress Display**: Show queue status and individual poster progress in UI
- **Retroactive Enhancement**: Posters get trace data added when queue completes them

**2.3 Progressive Loading Strategy**

- Load core poster first (`index.html` contains base poster without trace data)
- Load trace segments on-demand when user requests high detail or zooms in
- Trace segments load incrementally: `50.html`, `60.html`, `70.html`, etc.
- Merge trace segments into poster object as they load

**2.2 ItemID Compatibility Requirements**

- **Client-side**: Continue using existing itemid format `/people/${author}/posters/${created_at}`
- **No breaking changes**: All existing code using itemids works unchanged
- **Transparent abstraction**: Storage layer handles folder structure internally

**2.3 Storage Layer Updates**

- **`src/persistance/Cloud.js`**: Update upload logic to handle folder structure and multiple file uploads
- **`src/utils/itemid.js#as_filename()`**: Return folder path for new posters with vtracer data
- **`src/utils/itemid.js#load_from_network()`**: Handle loading from folder structure vs single file
- **`src/utils/upload-processor.js`**: Add segmentation logic for trace path processing
- **`src/persistance/Storage.js`**: Update `Poster` class to handle multi-file operations

**2.3 UI Loading States**

- Add loading states for trace data in poster components
- Progressive rendering: show base poster → add trace details
- Quality toggles for trace detail levels

### Phase 3: Optimization & Caching

**3.2 Client-Side Optimizations**

- Implement trace path deduplication
- Add client-side LRU cache for trace data
- Lazy load trace paths only when zoomed in

**3.3 Server-Side Optimizations**

- Implement CDN-friendly caching headers
- Add trace path simplification options
- Size-based trace quality levels

### Phase 4: Migration & Compatibility

**4.1 Backwards Compatibility Strategy**

- Detection logic tries folder structure first, falls back to single-file format
- No breaking changes to existing poster loading
- Dual format support in all loading functions

## Implementation Priority

### High Priority (Pre-Release)

1. **Queue-based vtracer system** - Critical for multi-poster processing and UX
2. **Storage separation implementation** - Required for trace data management
3. **UI flow decoupling** - Essential for immediate poster creation
4. **Backwards compatibility** - Required for existing users

### Medium Priority (Post-Release)

1. **Progressive loading system** - Enhanced UX for trace data
2. **Queue management UI** - User visibility into processing status
3. **Advanced compression improvements** - Size optimization
4. **Queue persistence and recovery** - Reliability improvements

### Low Priority (Future Iterations)

1. **Priority-based queue processing** - Smart ordering of trace jobs
2. **Advanced trace path optimization** - Quality vs performance tuning
3. **Distributed queue processing** - Multiple worker support
4. **Queue analytics and monitoring** - Processing insights

## Risk Assessment

### High Risk

- **Data loss during migration** - Mitigation: Comprehensive backup strategy
- **Performance regression** - Mitigation: Load testing with large trace data
- **Breaking existing posters** - Mitigation: Extensive backwards compatibility testing

### Medium Risk

- **Increased complexity** - Mitigation: Clear documentation and testing
- **Storage cost increases** - Mitigation: Compression and size budgets

## Success Metrics

### Performance Targets

- Poster load time: <2s for core poster, <5s total with trace
- Storage efficiency: <50% size increase vs. current implementation
- Memory usage: <200MB for trace-heavy posters

### Quality Targets

- Zero data loss during migration
- 100% backwards compatibility with existing posters
- Smooth user experience during progressive loading

## Next Steps

1. **Design queue system architecture** - Define job structure, queue management, and worker communication
2. **Prototype queue-based vtracer** - Build proof-of-concept with persistent queue and background processing
3. **Update poster creation flow** - Decouple vtracer from immediate UI navigation
4. **Implement folder-based storage** - Support queue-generated trace data with segmentation
5. **Set up comprehensive testing** - Test queue resilience, multi-poster processing, and storage performance
