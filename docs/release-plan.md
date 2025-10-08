# Release Plan: vtracer Integration

## The Problem

vtracer allowed us to create a cutouts feature which improves the fidelity and animation potential of of our Posters But file size has increase by 300-500% due to the number of cutouts. We need a to store cutouts outside our poster and load them apropriatly.

since we are local first we should change the way they are stored inside indexdb. right now the cutouts are stored as part of the poster.

how are statements saved. We'd like to base our implementation on paged data

we'd also like to improve the user experience for poster creation by creating directly in the [posters]('/posters') list.

Decouple poster creation from the UI to allow for multi-file selection and selecting and converting whole folders of images.

## Tasks

### Migration Script (Start Here)

- [ ] We want the filesystem approach to mirror on the client
- [ ] Create migration script to download all existing posters
- [ ] Convert single-file posters to folder structure (`index.html.gz`)
- [ ] Upload migrated posters with new folder format
- [ ] Verify migration success and data integrity

---

### Cutouts Storage Architecture

We want to store poster from `/users/{phone}/posters/{created_at}.html` to `/users/{phone}/posters/{created_at}/index.html` thereby creating a folder in which we can store the cutouts and on the client the image itself.

and really need to think about how to do that with our current indexdb and persistance implementation.

### Progressive Loading

We'll load the core poster first (`index.html`) and then load trace segments on-demand.

### Quality control

Do a round of work on tests, linting and type checking.

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
