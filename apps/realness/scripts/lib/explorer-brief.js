/**
 * p1: `virtual:explorer-brief` holds the harness files app chat starts with,
 * read from the harness at build time. Only their text reaches the app; the
 * dev server never opens the harness folder to the network.
 */
import { readFileSync as read_file_sync } from 'node:fs'
import { join } from 'node:path'

const ID = 'virtual:explorer-brief'
const RESOLVED = `\0${ID}`
const HARNESS = new URL('../../../../', import.meta.url).pathname

/** Each file chat starts with: its heading and its place in the harness. */
const BRIEF_FILES = [
  ['Harness rules', '.pi/agent/APPEND_SYSTEM.md'],
  ['Skill: planning', '.pi/skills/planning/SKILL.md'],
  ['Skill: vault', '.pi/skills/vault/SKILL.md']
]

export const explorer_brief = () => ({
  name: 'explorer-brief',
  resolveId: source => (source === ID ? RESOLVED : null),
  load(id) {
    if (id !== RESOLVED) return null
    const files = BRIEF_FILES.map(([heading, path]) => {
      const file = join(HARNESS, path)
      this.addWatchFile(file)
      return [heading, path, read_file_sync(file, 'utf8')]
    })
    return `export default ${JSON.stringify(files)}`
  }
})
