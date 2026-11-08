import {
  existsSync as exists_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import { dirname, join, relative } from 'node:path'

/**
 * The plan a scout serves: the nearest `index.md` from its folder up to
 * the plans folder, or null when none is found.
 * @param {string} folder the scout's folder, absolute
 * @param {string} projects the plans folder, absolute
 * @returns {string | null}
 */
export const plan_file = (folder, projects) => {
  for (
    let dir = folder;
    !relative(projects, dir).startsWith('..');
    dir = dirname(dir)
  ) {
    const file = join(dir, 'index.md')
    if (exists_sync(file)) return file
    if (dir === projects) break
  }
  return null
}

/**
 * The open nodes in a plan's `## Nodes` table: rows not struck through,
 * gates left out.
 * @param {string} text the plan markdown
 * @returns {{ id: string, goal: string }[]}
 */
export const open_nodes = text => {
  const gates = new Set([...text.matchAll(/(\w+)\{\{/g)].map(match => match[1]))
  const section = text.split(/^## Nodes\b/m)[1]?.split(/^## /m)[0] ?? ''
  return section
    .split('\n')
    .filter(line => line.startsWith('|') && !/^\|\s*(-|id\b)/.test(line))
    .map(line =>
      line
        .split('|')
        .slice(1, -1)
        .map(cell => cell.trim())
    )
    .filter(([id]) => id && !id.includes('~~') && !gates.has(id))
    .map(([id, goal]) => ({ id, goal }))
}

/**
 * The open nodes of the plan a scout serves.
 * @param {string} folder
 * @param {string} projects
 */
export const scout_nodes = (folder, projects) => {
  const file = plan_file(folder, projects)
  return file ? open_nodes(read_file_sync(file, 'utf8')) : []
}
