/**
 * gz2b: a Pi session `x.html.gz` is chained gzip members, one per append.
 * Sync carries it as `x.html`, its plain HTML, so the store packs it as one
 * piece and a browser can read it. On disk it stays `x.html.gz`: reads
 * unzip it, writes zip it again. A plain `x.html` beside it keeps both
 * names as they are.
 */
import { readFile as read_file } from 'node:fs/promises'
import { unzip, zip } from './zip.js'

const PACKED = /\.html\.gz$/
const GZ = '.gz'

/** A session whose last member is still being written. */
export class OpenSession extends Error {}

/**
 * Sync names for walked local names: `x.html.gz` becomes `x.html` unless a
 * plain `x.html` is there too.
 * @param {string[]} names
 * @returns {Map<string, string>} sync name to local name
 */
export const sync_names = names => {
  const present = new Set(names)
  return new Map(
    names.map(name => {
      const plain = name.slice(0, -GZ.length)
      return PACKED.test(name) && !present.has(plain)
        ? [plain, name]
        : [name, name]
    })
  )
}

/** Whether a sync name is held on disk packed, at `path`. */
export const packed_on_disk = (name, path) =>
  PACKED.test(path) && !name.endsWith(GZ)

/** A local file's sync bytes: a packed session reads as its plain HTML. */
export const read_local = async (name, path) => {
  const bytes = await read_file(path)
  if (!packed_on_disk(name, path)) return bytes
  try {
    return unzip(bytes)
  } catch {
    throw new OpenSession(`${name} is mid-write`)
  }
}

/** The bytes to put on disk at `path` for a sync name. */
export const disk_bytes = (name, path, bytes) =>
  packed_on_disk(name, path) ? zip(bytes) : bytes
