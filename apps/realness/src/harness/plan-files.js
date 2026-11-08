import { existsSync as exists_sync, readdirSync as readdir_sync } from 'node:fs'
import { join } from 'node:path'

/** `.md` on a plan's name is three characters. */
const SUFFIX = 3

/**
 * One plan: its `index.md` or its own file, and the name a person calls it.
 * @typedef {object} PlanFile
 * @property {string} file the path below the plans folder
 * @property {string} name `Scouts`, `Scouts/Bedroom`, or `realness`
 */

/**
 * Plans inside a plan folder, at any depth: each `<Folder>/index.md` below it.
 * @param {string} folder
 * @param {string} base path of `folder` relative to the plans folder
 * @returns {PlanFile[]}
 */
const inner_plans = (folder, base) =>
  readdir_sync(folder, { withFileTypes: true })
    .filter(
      entry =>
        entry.isDirectory() && exists_sync(join(folder, entry.name, 'index.md'))
    )
    .flatMap(entry => {
      const path = `${base}/${entry.name}`
      return [
        { file: `${path}/index.md`, name: path },
        ...inner_plans(join(folder, entry.name), path)
      ]
    })

/**
 * Plans in a plans folder: each top-level `<name>.md`, each `<Folder>/index.md`,
 * and each plan inside a plan folder, `<Folder>/<Inner>/index.md`.
 * @param {string} folder
 * @param {Iterable<string>} [ignored] top-level names to skip
 * @returns {PlanFile[]}
 */
export const plan_files = (folder, ignored = []) => {
  const skip = new Set(ignored)
  return readdir_sync(folder, { withFileTypes: true })
    .filter(entry => !skip.has(entry.name) && !entry.name.startsWith('.'))
    .flatMap(entry => {
      if (entry.isFile() && entry.name.endsWith('.md'))
        return [{ file: entry.name, name: entry.name.slice(0, -SUFFIX) }]
      if (
        entry.isDirectory() &&
        exists_sync(join(folder, entry.name, 'index.md'))
      )
        return [
          { file: `${entry.name}/index.md`, name: entry.name },
          ...inner_plans(join(folder, entry.name), entry.name)
        ]
      return []
    })
    .sort((a, b) => (a.file < b.file ? -1 : 1))
}
