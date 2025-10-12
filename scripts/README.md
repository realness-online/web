# Migration Scripts

Scripts for managing poster data migration and Firebase operations.

## Setup

### 1. Service Account Credentials

Create `service-account.json` in this directory with your Firebase Admin SDK credentials.

**Get credentials:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Save the file as `scripts/service-account.json`

**Example structure:**
See `service-account.example.json` for the format (don't use the example values!)

### 2. Environment Variables

Create `.env` in the project root with:

```env
VITE_STORAGE_BUCKET=your-project.appspot.com
VITE_API_KEY=your-api-key
VITE_APP_ID=your-app-id
VITE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_PROJECT_ID=your-project-id
VITE_MESSAGING_SENDER_ID=your-sender-id
```

## Migration Workflow

Complete sequence for migrating posters to folder structure. See `docs/migration-steps.md` for detailed instructions.

### Quick Reference

```bash
# 1. Download all posters from Firebase
node scripts/download-files.js

# 2. Reorganize to folder structure locally
node scripts/reorganize-posters.js

# 3. Compress for upload
node scripts/compress-files.js

# 4. Upload back to Firebase
node scripts/upload-compressed.js
```

## Scripts

### Data Migration

- **`download-files.js`** - Download all files from Firebase Storage
- **`reorganize-posters.js`** - Convert single-file to folder structure locally
- **`compress-files.js`** - Compress HTML files with metadata
- **`upload-compressed.js`** - Upload compressed files to Firebase
- **`migrate-posters.js`** - All-in-one migration (no local files, use with caution)

### Utilities

- **`firebase-service.js`** - Shared Firebase operations
- **`firebase-uploader.js`** - Firebase upload utilities
- **`node-upload-processor.js`** - HTML compression and hashing
- **`decompress-files.js`** - Decompress local files

## Security

⚠️ **Never commit `service-account.json`** - It's already in `.gitignore`

The service account file contains sensitive credentials with full access to your Firebase project.

## Troubleshooting

**"Cannot find service-account.json"**

- Make sure file is in `scripts/` directory
- Check filename is exactly `service-account.json`

**"Permission denied"**

- Service account needs Storage Admin role
- Check Firebase IAM permissions

**"Storage bucket not found"**

- Verify `VITE_STORAGE_BUCKET` in `.env`
- Make sure Storage is enabled in Firebase Console
