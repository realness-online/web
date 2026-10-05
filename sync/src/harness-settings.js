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
