import {
  existsSync as exists_sync,
  readFileSync as read_file_sync,
  renameSync as rename_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { BadRequest } from './errors.js'

/** The page's pane layout is small; anything larger is not a layout. */
export const LAYOUT_BYTES = 16 * 1024
const FILE = 'layout.json'

/**
 * The pane layout the page last saved for an actor, or null.
 * It lives beside actor.json, so it goes when the actor goes.
 * @param {string} dir the actor's directory
 */
export const read_layout = dir => {
  const path = join(dir, FILE)
  if (!exists_sync(path)) return null
  try {
    return JSON.parse(read_file_sync(path, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Keep the page's pane layout. The halo does not read it; it only gives it back.
 * @param {string} dir the actor's directory
 * @param {unknown} layout
 */
export const write_layout = (dir, layout) => {
  if (!layout || typeof layout !== 'object' || Array.isArray(layout))
    throw new BadRequest('layout must be a JSON object')
  const text = JSON.stringify(layout)
  if (Buffer.byteLength(text) > LAYOUT_BYTES)
    throw new BadRequest(`layout is larger than ${LAYOUT_BYTES} bytes`)
  const path = join(dir, FILE)
  write_file_sync(`${path}.part`, text)
  rename_sync(`${path}.part`, path)
  return layout
}
