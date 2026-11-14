/**
 * v5: the owner browses scratch files from the app. Reads only, inside the
 * given folder, and never above it.
 */
import {
  readdir as read_dir,
  readFile as read_file,
  stat
} from 'node:fs/promises'
import { resolve, sep } from 'node:path'

/** Extensions the app shows as text. Anything else is listed by size only. */
const TEXT = new Set([
  'css',
  'diff',
  'html',
  'js',
  'json',
  'jsx',
  'log',
  'md',
  'mjs',
  'sh',
  'svg',
  'txt',
  'ts',
  'tsv',
  'vue',
  'yaml',
  'yml'
])

const KILOBYTE = 1024
const TEXT_MAX_KB = 512
const TEXT_MAX = TEXT_MAX_KB * KILOBYTE

/**
 * A path inside the folder, or null when it would reach outside it.
 * @param {string} base the artifacts folder
 * @param {string} wanted a path relative to it
 * @returns {string | null}
 */
export const inside = (base, wanted) => {
  if (!base) return null
  const root = resolve(base)
  const full = resolve(root, wanted ?? '')
  if (full !== root && !full.startsWith(root + sep)) return null
  return full
}

/**
 * Every entry in one folder: folders first, then files, each by name.
 * @param {string} base
 * @param {string} [wanted]
 * @returns {Promise<{ path: string, name: string, kind: 'folder' | 'file', size: number, mtime_ms: number }[]>}
 */
export const artifact_list = async (base, wanted = '') => {
  const folder = inside(base, wanted)
  if (!folder) return []
  /** @type {import('node:fs').Dirent[]} */
  const entries = await read_dir(folder, { withFileTypes: true }).catch(
    () => []
  )
  const listed = await Promise.all(
    entries
      .filter(entry => !entry.name.startsWith('.'))
      .map(async entry => {
        const child = wanted ? `${wanted}/${entry.name}` : entry.name
        const full = inside(base, child) ?? folder
        const size = await stat(full)
          .then(info => info.size)
          .catch(() => 0)
        const mtime_ms = await stat(full)
          .then(info => info.mtimeMs)
          .catch(() => 0)
        return {
          path: child,
          name: entry.name,
          kind: /** @type {'folder' | 'file'} */ (
            entry.isDirectory() ? 'folder' : 'file'
          ),
          size,
          mtime_ms
        }
      })
  )
  return listed.sort(
    (a, b) =>
      Number(b.kind === 'folder') - Number(a.kind === 'folder') ||
      a.name.localeCompare(b.name)
  )
}

/**
 * One file's text, or null when it is binary, too large, or outside the folder.
 * @param {string} base
 * @param {string} wanted
 * @returns {Promise<{ path: string, text: string } | null>}
 */
export const artifact_file = async (base, wanted) => {
  const full = inside(base, wanted)
  if (!full || !wanted) return null
  const info = await stat(full).catch(() => null)
  if (!info?.isFile()) return null
  const extension = wanted.split('.').pop()?.toLowerCase() ?? ''
  if (!TEXT.has(extension) || info.size > TEXT_MAX) return null
  const text = await read_file(full, 'utf8').catch(() => null)
  return text === null ? null : { path: wanted, text }
}
