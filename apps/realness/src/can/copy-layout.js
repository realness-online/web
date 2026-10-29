import { placed } from './layout.js'

/* eslint-disable no-await-in-loop -- pool workers each take the next copy */
const CONCURRENCY = 8

/**
 * @param {{ walk_meta: Function, get: Function, put: Function }} storage
 * @param {{ write?: boolean }} [options]
 */
export const copy_layout = async (storage, { write = false } = {}) => {
  const listed = await storage.walk_meta('')
  const sources = Object.entries(listed).filter(
    ([source]) => !source.endsWith('.gz')
  )
  const pending = []
  for (const [source, detail] of sources) {
    const destination = `${placed(source)}.gz`
    const current = listed[destination] ?? null
    if (!current || detail.updated > current.updated)
      pending.push({ source, destination, current })
  }

  const result = {
    files: sources.length,
    pending: pending.length,
    copied: 0,
    skipped: sources.length - pending.length,
    copies: pending.map(({ source, destination }) => ({ source, destination }))
  }
  if (!write) return result

  let next = 0
  const worker = async () => {
    while (next < pending.length) {
      const item = pending[next++]
      const file = await storage.get(item.source)
      if (!file) throw new Error(`${item.source} is gone`)
      await storage.put(item.destination, file.body, {
        meta: file.meta,
        ...(item.current
          ? { if_version: item.current.version }
          : { if_absent: true })
      })
      result.copied++
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return result
}
