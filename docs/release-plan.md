# Release Plan: vtracer Integration

## Problem

vtracer integration increased poster file sizes by 300-500% due to trace paths. Current system blocks UI during tracing and only processes one poster at a time.

## Solution

Decouple poster creation from UI allowing for multi file conversion. We'd like to support converting multiple files at a time. maybe by first converting each uploaded file to the proper dimentions and keeping in indexdb until we can get to them

## Tasks

### 1. Migration Script (Start Here)

- [ ] Create migration script to download all existing posters
- [ ] Convert single-file posters to folder structure (`index.html.gz`)
- [ ] Upload migrated posters with new folder format
- [ ] Verify migration success and data integrity

### 2. Queue-Based vtracer System

- [ ] Create persistent trace queue in IndexedDB
- [ ] Build single background worker for trace processing
- [ ] Decouple poster creation from tracing (immediate UI navigation)
- [ ] Add queue status display in UI

### 3. Segmented Storage Architecture

- [ ] Update `src/utils/itemid.js#as_filename()` for folder structure
- [ ] Update `src/utils/itemid.js#load_from_network()` for folder loading
- [ ] Modify `src/persistance/Cloud.js` for multi-file uploads
- [ ] Add trace segmentation logic (~100KB per file)

### 4. Backwards Compatibility

- [ ] Detect folder vs single-file format on load
- [ ] Maintain fallback to existing poster format
- [ ] Test migration of existing posters

### 5. Progressive Loading

- [ ] Load core poster first (`index.html`)
- [ ] Load trace segments on-demand
- [ ] Add loading states for trace data

## Files to Modify

- `src/utils/itemid.js` - Storage path handling
- `src/persistance/Cloud.js` - Upload/download logic
- `src/use/vectorize.js` - Queue integration
- `src/utils/upload-processor.js` - Segmentation logic
- `src/persistance/Storage.js` - Multi-file operations

## Success Criteria

- Poster load time <2s for core, <5s with trace
- Zero data loss during migration
- 100% backwards compatibility
