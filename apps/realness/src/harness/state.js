import { existsSync as exists_sync } from 'node:fs'
import { copyFile as copy_file, mkdir, rename } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { state_path } from './settings.js'

/**
 * Move old actor records out of temporary artifacts without overwriting state.
 * @param {string} root
 * @param {object} [options]
 * @param {string} [options.state] an explicit state directory
 */
export const prepare_actor_state = async (
  root,
  { state: state_option } = {}
) => {
  const legacy = join(root, 'artifacts/sync-state')
  let state = state_option ?? join(root, state_path(root))
  if (resolve(state) === resolve(legacy)) state = join(root, state_path(root))
  if (relative(root, state).split(/[\\/]/)[0] === 'artifacts')
    throw new Error('sync state must stay outside artifacts')
  if (exists_sync(legacy)) {
    if (exists_sync(state))
      throw new Error(
        'both legacy and current sync state exist; review migration before syncing'
      )
    await mkdir(dirname(state), { recursive: true })
    await rename(legacy, state)
  }
  const old_url = join(root, 'artifacts/sync-recovery/url')
  const url = join(state, 'recovery/url')
  if (exists_sync(old_url) && !exists_sync(url)) {
    await mkdir(dirname(url), { recursive: true })
    await copy_file(old_url, url)
  }
  return state
}
