import { existsSync as exists_sync, readdirSync as readdir_sync } from 'node:fs'
import { join } from 'node:path'

/**
 * Plans in a plans folder: each top-level `<name>.md`, and each `<Folder>/index.md`.
 * @param {string} folder
 * @param {Iterable<string>} [ignored] top-level names to skip
 * @returns {{ file: string; name: string; }[]} `file` is relative to the folder; `name` gives the slug
 */
export const plan_files = (folder, ignored = []) => {
  const skip = new Set(ignored)
  return readdir_sync(folder, { withFileTypes: true })
    .filter(entry => !skip.has(entry.name))
    .flatMap(entry => {
      if (entry.isFile() && entry.name.endsWith('.md')) return [{ file: entry.name, name: entry.name.slice(0, -3) }]
      if (entry.isDirectory() && exists_sync(join(folder, entry.name, 'index.md')))
        return [{ file: `${entry.name}/index.md`, name: entry.name }]
      return []
    })
    .sort((a, b) => (a.file < b.file ? -1 : 1))
}
