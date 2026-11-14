/**
 * s1: a note saved on disk reaches an open view. The watcher re-indexes the
 * changed note, then tells every open page which path changed.
 */
import { watch } from 'node:fs'
import { readFile as read_file, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { drop_note, write_note } from './note-index.js'

const NOTE = '.md'
/** How long edits settle before one index write. */
const SETTLE_MS = 300

/**
 * Watch a vault folder. A saved note is indexed within `wait` ms of the edit
 * settling; a deleted note leaves the index. Both send one event.
 * @param {{ dir: string, index: string, owner: string, events: { send: (path: string) => void }, wait?: number, log?: (line: string) => void }} options
 * @returns {{ close: () => void }}
 */
export const watch_vault_disk = ({
  dir,
  index,
  owner,
  events,
  wait = SETTLE_MS,
  log = () => {}
}) => {
  const timers = new Map()
  const settle = async file => {
    const path = relative(dir, join(dir, file)).split(sep).join('/')
    if (!path.endsWith(NOTE)) return
    const full = join(dir, path)
    const info = await stat(full).catch(() => null)
    if (!info) {
      drop_note({ index, path })
      events.send(vault_path(owner, path))
      log(`dropped ${path}`)
      return
    }
    const text = await read_file(full, 'utf8')
    write_note({ index, path, text, mtime_ms: info.mtimeMs })
    events.send(vault_path(owner, path))
    log(`indexed ${path}`)
  }
  const watcher = watch(dir, { recursive: true }, (_, file) => {
    if (!file || !file.endsWith(NOTE) || file.split(sep).includes('Sessions'))
      return
    clearTimeout(timers.get(file))
    timers.set(
      file,
      setTimeout(() => {
        timers.delete(file)
        settle(file).catch(error => log(`index failed: ${error.message}`))
      }, wait)
    )
  })
  return {
    close: () => {
      for (const timer of timers.values()) clearTimeout(timer)
      watcher.close()
    }
  }
}

/**
 * The path sync and the app both name, so an open page can match it against
 * the note it shows.
 * @param {string} owner the vault owner's phone
 * @param {string} path the note's vault-relative path
 * @returns {string}
 */
export const vault_path = (owner, path) => `people/${owner}/vault/${path}`
