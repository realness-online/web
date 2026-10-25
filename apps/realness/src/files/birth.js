/**
 * A file's creation time: read where the filesystem keeps one, set on a Mac.
 *
 * Node cannot set a birth time. APFS moves it back whenever the modified time
 * is set earlier than it, so `set_born` sets the modified time to the date,
 * then puts the real one back. Elsewhere it does nothing; the date stays in
 * the file's meta.
 */
import { stat, utimes } from 'node:fs/promises'
import { MS_PER_SECOND } from '#root/lib/units.js'

const NS_PER_S = 1e9

/** The birth time as ISO, or null where the filesystem keeps none. */
export const born = async path => {
  const info = await stat(path).catch(() => null)
  if (!info || !(info.birthtimeMs > 0)) return null
  return info.birthtime.toISOString()
}

/**
 * Move a file's birth time back to `iso` when that is earlier. Returns true
 * when it moved.
 * @param {string} path
 * @param {string} iso
 * @param {string} [platform]
 */
export const set_born = async (path, iso, platform = process.platform) => {
  if (platform !== 'darwin') return false
  const when = Date.parse(iso)
  if (Number.isNaN(when)) return false
  const info = await stat(path, { bigint: true }).catch(() => null)
  if (!info || Number(info.birthtimeMs) <= when) return false
  const atime = Number(info.atimeNs) / NS_PER_S
  await utimes(path, atime, when / MS_PER_SECOND)
  await utimes(path, atime, Number(info.mtimeNs) / NS_PER_S)
  return true
}
