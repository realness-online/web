# Poster Migration - Local Testing Steps

Complete sequence for testing the migration locally before deploying.

## Prerequisites

1. Backup your Firebase Storage (recommended)
2. Make sure you have `storage/service-account.json`
3. Environment variables set in `.env`

## Step-by-Step Process

### Step 1: Download All Posters

```bash
node scripts/download-files.js
```

**What it does:**

- Downloads all files from `people/` in Firebase
- Auto-decompresses `.gz` files
- Saves to `storage/people/+phone/posters/{created_at}.html`
- Saves metadata alongside as `.metadata.json`

**Check it worked:**

```bash
ls storage/people/
```

---

### Step 2: Reorganize to Folder Structure

```bash
node scripts/reorganize-posters.js
```

**What it does:**

- Finds all poster files: `{created_at}.html`
- Creates folder: `{created_at}/`
- Moves file to: `{created_at}/index.html`
- Copies metadata too
- Deletes old single files

**Before:**

```
storage/people/+1234567890/posters/
  ├── 1234567890.html
  └── 1234567891.html
```

**After:**

```
storage/people/+1234567890/posters/
  ├── 1234567890/
  │   ├── index.html
  │   └── index.html.metadata.json
  └── 1234567891/
      ├── index.html
      └── index.html.metadata.json
```

**Check it worked:**

```bash
# Should see folders now
ls storage/people/+*/posters/
```

---

### Step 3: Compress for Upload

```bash
node scripts/compress-files.js
```

**What it does:**

- Reads from `storage/people/`
- Compresses using deflate
- Saves to `storage/compressed/` with same structure
- Creates `.metadata.json` files

**Check it worked:**

```bash
# Should see compressed files
ls storage/compressed/+*/posters/*/
```

---

### Step 4: Upload to Firebase

```bash
node scripts/upload-compressed.js
```

**What it does:**

- Reads from `storage/compressed/`
- Uploads to Firebase Storage
- Preserves folder structure
- Uses metadata from `.metadata.json` files

**Result in Firebase:**

```
people/+1234567890/posters/
  ├── 1234567890/
  │   └── index.html.gz
  └── 1234567891/
      └── index.html.gz
```

---

## Verify Migration

1. **Check Firebase Storage Console:**

   - See folders instead of single files?
   - Can you download and view a poster?

2. **Test in App:**

   - Old posters still load? (if you kept them)
   - New posters save to folders?

3. **Check File Sizes:**
   - Folder-based posters should be same size for now
   - Cutouts still embedded in HTML

---

## Rollback

If something goes wrong:

1. **Old files still in Firebase** (Step 4 uploads, doesn't delete)
2. **Can restore from backup**
3. **Local files in `storage/people/` untouched**

---

## Cleanup After Success

1. Delete old single-file posters from Firebase manually
2. Clear local `storage/` directory
3. Keep migration scripts for future reference

---

## Troubleshooting

**"No poster files found"** after Step 2:

- Check Step 1 completed successfully
- Look in `storage/people/+*/posters/` for `.html` files

**Upload fails:**

- Check service account permissions
- Verify `.env` variables
- Check Firebase Storage Rules

**Posters won't load in app:**

- Clear IndexedDB cache
- Check browser console for errors
- Verify file paths in Firebase Storage
