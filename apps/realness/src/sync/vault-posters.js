/**
 * One blog poster from the vault's `Areas/Blog/posters`, read by name. Only an
 * SVG whose name stays in that folder is read.
 */
import { readFile as read_file } from 'node:fs/promises'
import { join } from 'node:path'

const POSTERS = 'Areas/Blog/posters'
const NAME = /^[^/\\]+\.svg$/i

/**
 * @param {string} dir vault folder
 * @param {unknown} name
 * @returns {Promise<string | null>}
 */
export const poster_svg = (dir, name) => {
  if (typeof name !== 'string' || !NAME.test(name)) return Promise.resolve(null)
  return read_file(join(dir, POSTERS, name), 'utf8').catch(() => null)
}
