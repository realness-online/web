import { readFileSync as read_file_sync } from 'node:fs'
import { join } from 'node:path'

/** The harness-relative plans folder, from package.json's brayness.plans. */
export const plans_path = (root) => {
  let settings
  try {
    settings = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return 'vault/plans'
    throw error
  }
  const path = settings.brayness?.plans ?? 'vault/plans'
  if (typeof path !== 'string' || !path || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('brayness.plans must be a relative folder inside the harness')
  }
  return path
}

/**
 * The harness-relative folder for local sync state (edit log, turns, records,
 * sync.log), from package.json's brayness.state. It never syncs.
 */
export const state_path = (root) => {
  let settings
  try {
    settings = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return '.pi/agent/state'
    throw error
  }
  const path = settings.brayness?.state ?? '.pi/agent/state'
  if (typeof path !== 'string' || !path || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('brayness.state must be a relative folder inside the harness')
  }
  return path
}

/** File names in the plans folder that are not plans, from brayness.plansIgnore. */
export const plans_ignore = (root) => {
  let settings
  try {
    settings = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const names = settings.brayness?.plansIgnore ?? []
  if (!Array.isArray(names) || names.some(name => typeof name !== 'string' || !name || name.includes('/') || name.includes('\\'))) {
    throw new Error('brayness.plansIgnore must be a list of file names')
  }
  return names
}
