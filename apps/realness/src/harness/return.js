/**
 * k3: `realness return`, an actor's one way home. Every own file it changed,
 * added, or deleted since its start copy goes to quarantine, with the version
 * it started from. A change its pass may not make is refused and recorded by
 * the server; the rest still go. The page then moves forward, so a second
 * return is idle.
 */
import { readFile as read_file } from 'node:fs/promises'
import { join } from 'node:path'
import { HTTP } from '#root/lib/http.js'
import {
  own_versions,
  read_start_copy,
  write_start_copy
} from './start-copy.js'

/**
 * @typedef {{ hand_back: (path: string, bytes: Buffer | null, base: string | null) => Promise<void> }} ReturnStore
 */

/**
 * One change, or the refusal the server already recorded for it.
 * @param {ReturnStore} store
 * @param {string} path
 * @param {Buffer | null} bytes
 * @param {string | null} base
 * @returns {Promise<boolean>} whether the server took it
 */
const hand_back = async (store, path, bytes, base) => {
  try {
    await store.hand_back(`can://~/${path}`, bytes, base)
    return true
  } catch (error) {
    if (error.status === HTTP.FORBIDDEN) return false
    throw error
  }
}

/**
 * @param {{ root: string, state: string, store: ReturnStore }} options
 * @returns {Promise<{ written: string[], deleted: string[], refused: string[] }>}
 */
/* eslint-disable no-await-in-loop -- one file at a time */
export const return_files = async ({ root, state, store }) => {
  const started = await read_start_copy(state)
  const now = await own_versions(root)
  /** @type {{ written: string[], deleted: string[], refused: string[] }} */
  const report = { written: [], deleted: [], refused: [] }
  for (const [path, version] of now) {
    if (started.get(path) === version) continue
    const bytes = await read_file(join(root, path))
    const taken = await hand_back(store, path, bytes, started.get(path) ?? null)
    report[taken ? 'written' : 'refused'].push(path)
  }
  for (const [path, version] of started) {
    if (now.has(path)) continue
    const taken = await hand_back(store, path, null, version)
    report[taken ? 'deleted' : 'refused'].push(path)
  }
  await write_start_copy(root, state, now)
  return report
}
