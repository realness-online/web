# Sync Folder – Full Output Export

Export all poster outputs to a user-selected folder. Sync keeps the folder up to date without redoing expensive work.

## Overview

User picks a root folder. We export the full output for each poster:

- **PSD** – layered Photoshop file
- **Movie** – video export (.mov)
- **SVG** – vector source
- **PNG** – flattened raster
- **Layered PNG** – one PNG per layer (shadows, sediment, sand, gravel, rocks, boulders)

## Requirements

### Browser Support

File System Access API only. Check before offering:

```js
'showDirectoryPicker' in window && 'FileSystemFileHandle' in window
```

Supported: Chrome, Edge, Opera. Not supported: Firefox, Safari.

Hide or disable the sync option when unsupported. Optional message: "Folder sync requires Chrome or Edge."

### Flow

1. User picks root folder via `showDirectoryPicker` with `mode: 'readwrite'`
2. For each poster, export all 5 output types to that folder
3. Use existing filename format: `Creator_Monday_February_16_2_30 PM_1739742645123.{ext}`

### Avoiding Redundant Work

Export is expensive. Skip when output already exists and is current.

**Manifest + content hash:**

1. Manifest file in sync folder: `realness-sync-manifest.json`
2. Structure: `poster_id → output_type → { hash, written_at }`
3. Before each write: compute hash of poster content for that output
4. If file exists and manifest hash matches current hash → skip
5. If file missing, hash differs, or no manifest entry → write and update manifest

**Hash scope:** SVG string for SVG; same canonical representation for PNG/PSD/video (or hash of SVG + export settings).

**Simpler fallback:** Skip if file exists. Won't update edited posters unless user deletes or forces overwrite.

## Stretch Goal: Directory as Primary Storage

Once sync folder exists, use it as the app's primary storage instead of IndexedDB.

1. Persist `FileSystemDirectoryHandle` (API supports storing handles in IndexedDB)
2. On load: if handle exists, use directory as source of truth
3. Read poster SVGs from folder; write new/edited posters there
4. Poster list derived from directory contents instead of IndexedDB directory index

**Considerations:**

- Call `handle.requestPermission()` on load (permissions can be revoked)
- Fallback to IndexedDB when handle missing or permission denied
- Define stable directory layout for listing and loading

## Implementation Order

1. **Sync feature** (in progress): export all outputs to chosen folder
   - [x] Preference UI in as-dialog-preferences.vue (visible when supported)
   - [x] use/sync-folder.js composable
   - [x] Export loop: for each poster, mount as-figure, wait for SVG, export SVG to folder
   - [ ] PNG, PSD, movie, layered PNG (SVG done first)
   - [x] Write to folder via File System Access API
2. **Manifest + hash**: skip unchanged work
3. **Stretch**: use directory as primary storage when available
