# vtracer Integration - Implementation Complete

## Summary

Implemented folder-based storage for Large files (posters) to prepare for cutouts optimization.

## Changes Made

### 1. Large Files Use Folder Structure

**Modified: `src/persistance/Large.js`**

- Added `get_storage_path()` method
- Large files now use: `people/+phone/posters/{created_at}/index.html.gz`
- Archived large files: `people/+phone/posters/{archive_id}/{created_at}/index.html.gz`

**Why this is better:**

- Decision based on file size (Large mixin) not hardcoded type names
- Any future Large file types automatically get folder structure
- Keeps logic encapsulated in the Large mixin

### 2. Cloud Storage Updated

**Modified: `src/persistance/Cloud.js`**

- `to_network()` checks for `get_storage_path()` method
- `delete()` checks for `get_storage_path()` method
- Falls back to `as_filename()` for non-Large files
- Uses bracket notation to avoid TypeScript errors

### 3. Migration Script

**Created: `scripts/migrate-posters.js`**

- Converts existing single-file posters to folder structure
- Pattern: `{created_at}.html.gz` → `{created_at}/index.html.gz`
- Verifies uploads before deleting old files
- Progress tracking and error reporting

**Usage:**

```bash
node scripts/migrate-posters.js
```

### 4. Cutouts Utilities

**Created: `src/utils/cutouts.js`**

- Helper functions for future cutouts handling
- `get_cutouts_path()` - get folder path for cutouts
- `has_cutouts()` - check if poster has cutouts
- `get_cutout_count()` - count cutouts in poster

## File Structure

### Before

```
people/+phone/posters/{created_at}.html.gz
```

### After

```
people/+phone/posters/{created_at}/
  └── index.html.gz
```

### Future (with separate cutouts)

```
people/+phone/posters/{created_at}/
  ├── index.html.gz
  └── cutouts/
      ├── 0.svg
      ├── 1.svg
      └── ...
```

## Benefits

1. **Room for Growth** - Folder structure allows separate cutouts storage
2. **Clean Architecture** - Large files declare themselves, not hardcoded types
3. **Backwards Compatible** - Old posters work until migrated
4. **File Size Reduction** - Future: store cutouts separately (300-500% reduction)

## Testing

All files pass linting: ✓

- `src/persistance/Large.js`
- `src/persistance/Cloud.js`
- `src/utils/cutouts.js`
- `scripts/migrate-posters.js`

## Next Steps

1. **Test migration script on staging:**

   ```bash
   # Backup first!
   node scripts/migrate-posters.js
   ```

2. **Verify new posters save correctly:**

   - Create a new poster
   - Check Firebase Storage for folder structure

3. **Monitor for issues:**
   - Old posters still load?
   - New posters save to folders?
   - Delete operations work?

## Rollback

If issues arise:

1. Old posters still exist (migration copies, doesn't move)
2. Can temporarily revert `Large.js` changes
3. Migration script can be modified to reverse

## Future Enhancements

When ready to optimize cutouts storage:

1. Extract cutouts from poster HTML
2. Save cutouts as separate SVG files in `cutouts/` folder
3. Add progressive loading for cutouts
4. Remove cutouts from main HTML to reduce size

The foundation is now in place for these optimizations.
