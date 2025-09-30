# Release Plan: vtracer Integration

Before working on these features, do a run through on tests, linting and type checking.

## The Problem

vtracer allowed us to create a cutouts feature which improves the fidelity and animation potential of of our Posters But file size has increase by 300-500% due to the number of cutouts. We need a to store cutouts outside our poster and load them apropriatly.

we'd also like to improve the user experience for poster creation by creating directly in the [posters]('/posters') list.

Decouple poster creation from the UI to allow for multi-file selection and selecting and converting whole folders of images.

## Tasks

### Migration Script (Start Here)

- [ ] Create migration script to download all existing posters
- [ ] Convert single-file posters to folder structure (`index.html.gz`)
- [ ] Upload migrated posters with new folder format
- [ ] Verify migration success and data integrity

### User Experience Improvement

We want to change the user experience around creating posters. Instead of going to an edit screen where we approve each poster, they should be rendered into the posters view with their menus showing up ready to be deleted (but it's assumed they're being kept).

This approach lets us handle multiple files and queues up vtracer conversion, which is much more expensive.

We need to temporarily store the image we're creating and should consider uploading it to the directory to be mixed into the poster.

we then need a way to monitor posters that have vtracer work remaining.

**Key Learning**: The `Large` class expects to find a DOM element with the `itemid` attribute when saving. The `as-gradients` component shows that gradients are data objects (not DOM elements) that get converted to SVG gradient elements during rendering. The proper approach is to let the existing rendering system handle the DOM creation, then save from there.

### Cutouts Storage Architecture

We want to store poster from `/users/{phone}/posters/{created_at}.html` to `/users/{phone}/posters/{created_at}/index.html` thereby creating a folder in which we can store the cutouts and on the client the image itself.

We want the filesystem approach to mirror on the client and really need to think about how to do that with our current indexdb and persistance implementation.

### Progressive Loading

We'll load the core poster first (`index.html`) and then load trace segments on-demand. we can be aware of our network latency and toggle between auto loading traces and waiting for the user to click on them. maybe we wait and make people click so that their is this event calendar vibe to viewing posters.

### Sync Issues Analysis

We have an issue with statements not being available on devices where they are created - we need to explore how statement syncing works

**Critical Sync Issues Identified:**

1. **Hash Comparison Logic Flaw**: The sync mechanism compares server metadata hash with local DOM hash. If server file is missing/corrupted, `index_hash` becomes `undefined`, causing silent sync failures.

2. **Server File Check Failure**: When `metadata(path)` throws `storage/object-not-found`, the sync index gets `DOES_NOT_EXIST` but hash comparison doesn't handle this properly.

3. **8-Hour Sync Throttle**: `i_am_fresh()` prevents sync if less than 8 hours since last sync, potentially causing long delays.

4. **Visibility State Requirement**: Sync only runs when `document.visibilityState === 'visible'`, failing for background devices.

**Most Likely Cause of 9-Month Gap:**
- Device A uploads statements successfully
- Device B tries to sync but server file is missing/corrupted
- `metadata()` call fails with `storage/object-not-found`
- Hash comparison `undefined !== hash` triggers sync
- `load_from_network()` returns `null` (no server file)
- Sync appears successful but gets no new data
- Device B never receives statements

**Debugging Steps:**
- Check `localStorage.sync_time` and `sync:index`
- Verify server file existence with `get_metadata(path)`
- Test hash comparison logic manually
- Force re-sync by clearing sync index and throttle
