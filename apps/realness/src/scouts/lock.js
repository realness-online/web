import { createHash as create_hash } from 'node:crypto'
import { open, stat, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as wait } from 'node:timers/promises'

/** A lock older than this is a run that died holding it. */
const STALE_MS = 60_000
const POLL_MS = 15
const HASH_CHARS = 12

/** One lock per pages folder, kept outside the vault. */
const path_of = key =>
  join(
    tmpdir(),
    `realness-scout-${create_hash('sha1').update(key).digest('hex').slice(0, HASH_CHARS)}.lock`
  )

/**
 * Run one change to a scout's pages alone. Two runs that finish at the same
 * time each merge into the page they read last, so one never overwrites the
 * other's finds.
 * @template T
 * @param {string} key the folder whose pages are changing
 * @param {() => Promise<T>} change
 * @returns {Promise<T>}
 */
export const with_lock = async (key, change) => {
  const file = path_of(key)
  for (;;)
    try {
      const handle = await open(file, 'wx')
      await handle.close()
      break
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const age = await stat(file).then(
        held => Date.now() - held.mtimeMs,
        () => 0
      )
      if (age > STALE_MS) await unlink(file).catch(() => {})
      else await wait(POLL_MS)
    }

  try {
    return await change()
  } finally {
    await unlink(file).catch(() => {})
  }
}
