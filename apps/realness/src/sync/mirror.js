import { existsSync as exists_sync } from 'node:fs'
import { readFile as read_file } from 'node:fs/promises'
import { read_item } from '#root/lib/items.js'

/* eslint-disable no-await-in-loop -- pool workers each take the next change */
const CONCURRENCY = 8
/** Finder writes these into any folder it shows; they are not files we hold. */
const FINDER = '.DS_Store'

/**
 * m1: whether the switches page turns the production copy on.
 * @param {string | null} html the switches page, or null when there is none
 */
export const copy_on = html =>
  read_item(html ?? '', 'switches')?.production_copy === 'on'

/**
 * m1: make `to` hold exactly what `from` holds, one way. Both are raw
 * adapters, so stored keys copy as they are. A file whose version already
 * matches is left alone; a file only `to` holds is removed.
 * @param {{ walk: Function, get: Function }} from
 * @param {{ walk: Function, put: Function, delete: Function }} to
 * @param {{ write?: boolean }} [options]
 */
export const mirror = async (from, to, { write = false } = {}) => {
  const [theirs, ours] = await Promise.all([from.walk(''), to.walk('')])
  const copies = Object.keys(theirs)
    .filter(key => ours[key] !== theirs[key])
    .sort()
  const removes = Object.keys(ours)
    .filter(key => !(key in theirs) && !key.endsWith(FINDER))
    .sort()
  const result = {
    files: Object.keys(theirs).length,
    copies,
    removes,
    copied: 0,
    removed: 0
  }
  if (!write) return result

  const jobs = [
    ...copies.map(key => async () => {
      const file = await from.get(key)
      if (!file) return
      await to.put(key, file.body, { meta: file.meta })
      result.copied++
    }),
    ...removes.map(key => async () => {
      await to.delete(key)
      result.removed++
    })
  ]
  let next = 0
  const worker = async () => {
    while (next < jobs.length) await jobs[next++]()
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return result
}

/**
 * m1: when the switches page says on, copy production into `to`. Off reads
 * nothing from Google and returns null.
 * @param {{ page: string, to: { walk: Function, put: Function, delete: Function }, from: () => { walk: Function, get: Function }, write?: boolean }} options
 */
export const production_copy = async ({ page, to, from, write = false }) => {
  const html = exists_sync(page) ? await read_file(page, 'utf8') : null
  if (!copy_on(html)) return null
  return mirror(from(), to, { write })
}
