import { placed } from './layout.js'

/* eslint-disable no-await-in-loop -- pool workers each take the next delete */
const CONCURRENCY = 8

/**
 * Drop the plain originals a `.gz` twin now carries. A twin at the
 * placed destination makes the delete safe; bucket versioning keeps the
 * deleted object 30 days.
 * @param {{ walk_meta: Function, delete: Function }} storage
 * @param {{ write?: boolean }} [options]
 */
export const remove_plain = async (storage, { write = false } = {}) => {
  const listed = await storage.walk_meta('')
  const names = Object.keys(listed)
  const gz = new Set(names.filter(name => name.endsWith('.gz')))
  const deletes = names
    .filter(name => !name.endsWith('.gz') && gz.has(`${placed(name)}.gz`))
    .map(name => ({ source: name, destination: `${placed(name)}.gz` }))

  const result = {
    files: names.length,
    pending: deletes.length,
    deleted: 0,
    skipped: names.length - deletes.length,
    deletes
  }
  if (!write) return result

  let next = 0
  const worker = async () => {
    while (next < deletes.length) {
      const item = deletes[next++]
      await storage.delete(item.source)
      result.deleted++
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return result
}
