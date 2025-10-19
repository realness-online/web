#!/usr/bin/env node

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  download_from_firebase,
  upload_to_firebase
} from './firebase-service.js'
import { location, load_html, upload, directory } from '../src/utils/host.js'
import { as_path_parts, as_type } from '../src/utils/itemid.js'

const SYNC_STATE_PATH = './storage/.sync-state.json'

const load_sync_state = async () => {
  try {
    const data = await readFile(SYNC_STATE_PATH, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    if (error.code === 'ENOENT')
      return { last_sync: null, local_changes: [], remote_changes: [] }

    throw error
  }
}

const save_sync_state = async state => {
  await mkdir('./storage', { recursive: true })
  await writeFile(SYNC_STATE_PATH, JSON.stringify(state, null, 2))
}

const sync_from_firebase = async () => {
  console.log('Downloading from Firebase...')
  const result = await download_from_firebase()
  console.log(`Downloaded ${result.successful} files, ${result.failed} failed`)
  return result
}

const sync_to_firebase = async () => {
  console.log('Uploading local changes to Firebase...')

  // This would need to be implemented to track local changes
  // For now, we'll do a full upload of all local files
  const files = []

  // Get all local files and prepare for upload
  // This is a simplified version - in practice you'd want to track changes
  const people_dir = './storage/people'
  try {
    const { readdir, stat } = await import('node:fs/promises')
    const { join } = await import('node:path')

    const process_directory = async (dir_path, prefix = '') => {
      const entries = await readdir(dir_path, { withFileTypes: true })

      for (const entry of entries) {
        const full_path = join(dir_path, entry.name)

        if (entry.isDirectory())
          await process_directory(full_path, `${prefix}${entry.name}/`)
        else if (entry.name.endsWith('.html.gz')) {
          const firebase_path = `people/${prefix}${entry.name}`
          files.push({
            compressed_path: full_path,
            metadata_path: full_path.replace('.html.gz', '.meta.json'),
            upload_path: firebase_path
          })
        }
      }
    }

    await process_directory(people_dir)

    if (files.length > 0) {
      const result = await upload_to_firebase(files)
      console.log(
        `Uploaded ${result.successful} files, ${result.failed} failed`
      )
      return result
    }
    console.log('No files to upload')
    return { successful: 0, failed: 0 }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No local files to upload')
      return { successful: 0, failed: 0 }
    }
    throw error
  }
}

const main = async () => {
  console.log('Starting Firebase sync...')

  const sync_state = await load_sync_state()
  const now = new Date().toISOString()

  try {
    // Sync from Firebase to local
    const download_result = await sync_from_firebase()

    // Sync from local to Firebase
    const upload_result = await sync_to_firebase()

    // Update sync state
    sync_state.last_sync = now
    sync_state.last_download = {
      successful: download_result.successful,
      failed: download_result.failed
    }
    sync_state.last_upload = {
      successful: upload_result.successful,
      failed: upload_result.failed
    }

    await save_sync_state(sync_state)

    console.log('Sync completed successfully')
    console.log(`Downloaded: ${download_result.successful} files`)
    console.log(`Uploaded: ${upload_result.successful} files`)
  } catch (error) {
    console.error('Sync failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) main()
