import { existsSync as exists_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { local_settings } from './environments.js'
import { project_root } from './layout.js'

export const out_root = ({ root = project_root } = {}) => {
  const artifacts = join(root, '..', '..', 'artifacts')
  return exists_sync(artifacts)
    ? join(artifacts, 'realness')
    : join(root, 'dist')
}

export const out_path = (...parts) => join(out_root(), ...parts)

export const frontend_out = (...parts) =>
  join(
    process.env.DIST_DIR
      ? resolve(process.env.DIST_DIR)
      : out_path('frontend', 'dist'),
    ...parts
  )

/** iCloud Drive's folder for the local stack's stored files. */
export const icloud_sync = (home = process.env.HOME ?? '') =>
  join(
    home,
    'Library/Mobile Documents/com~apple~CloudDocs',
    local_settings.sync_store
  )

/**
 * Where local sync keeps its files: `SYNC_DIR`, else the configured iCloud
 * store when it exists, else `<out>/sync-data`.
 */
export const sync_dir = (env = process.env) => {
  if (env.SYNC_DIR) return resolve(env.SYNC_DIR)
  const icloud = icloud_sync(env.HOME)
  return env.HOME && exists_sync(icloud) ? icloud : out_path('sync-data')
}
