/**
 * Project Tooling Extension
 *
 * Gives the agent on-demand awareness of each `work/` or `apps/` project's scripts,
 * ops helpers, and curated tooling notes. Reads live from `package.json`,
 * `scripts/`, and `tools/` when invoked - no startup context bloat, always
 * current.
 *
 * Why: pi loads skills and `AGENTS*.md` into context at startup, but nothing
 * points the agent at a project's `package.json` scripts, `scripts/`, or
 * `tools/` helpers. Realness and seeq-app carry a lot of diagnostic and ops
 * tooling that is easy to miss (logs, emulators, coverage/risk, deploy
 * verify, admin scripts). The agent needs to *consider* tooling when working
 * in a project, without carrying every project's full script list in the
 * system prompt.
 *
 * Design: a `project_tooling` tool (visible to the model via promptSnippet +
 * a guideline) that returns the requested project's scripts grouped by
 * purpose. A curated `<project>/.tooling.md`, when present, is included
 * as the headline notes. Content is assembled on each call, so scripts that
 * change are picked up immediately.
 */
/** @typedef {import("@earendil-works/pi-coding-agent").ExtensionAPI} ExtensionAPI */
import { existsSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Type } from 'typebox'
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../../..')
const PROJECT_DIRS = [join(root, 'work'), join(root, 'apps')]

/** The folder holding a project, or undefined. */
/**
 * @param {string} name
 * @returns {string | undefined}
 */
const projectDir = name => {
  return PROJECT_DIRS.map(dir => join(dir, name)).find(dir => existsSync(join(dir, 'package.json')))
}
const TOOLING_FILE = '.tooling.md'

/**
 * Group script names by intent so the output reads as a menu, not a flat
 * dump. High-value diagnostic buckets first.
 */
const GROUP_ORDER = ['test', 'lint', 'type', 'build', 'deploy', 'logs', 'dev', 'other']
/**
 * @param {string} name
 * @returns {string}
 */
const classifyScript = name => {
  const n = name.toLowerCase()
  if (/(^|:)test|cover(coverage)?|fallow|risk/.test(n)) return 'test'
  if (/(^|:)lint/.test(n)) return 'lint'
  if (/(^|:)type|check/.test(n)) return 'type'
  if (/(^|:)build|wasm|worker|icons|toc|prerender|manifest/.test(n)) return 'build'
  if (/(^|:)deploy|ship|release|verify|publish/.test(n)) return 'deploy'
  if (/(^|:)log/.test(n)) return 'logs'
  if (/(^|:)dev|serve|watch|emu/.test(n)) return 'dev'
  return 'other'
}
/** @returns {string[]} */
const listProjects = () => {
  const names = PROJECT_DIRS.filter(dir => existsSync(dir)).flatMap(dir =>
    readdirSync(dir).filter(name => existsSync(join(dir, name, 'package.json')))
  )
  return [...new Set(names)].sort()
}
/**
 * @param {string} dir
 * @returns {string[]}
 */
const listDirNames = dir => {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(name => !name.startsWith('.'))
    .sort()
}
/**
 * @param {string} projectDir
 * @returns {Promise<Array<{ label: string; scripts: string[]; }>>}
 */
const readProjectScripts = async projectDir => {
  const pkgFile = join(projectDir, 'package.json')
  if (!existsSync(pkgFile)) return []
  /** @type {Record<string, string>} */
  let scripts
  try {
    const pkg = /** @type {{ scripts?: Record<string, string>; }} */ (JSON.parse(await readFile(pkgFile, 'utf-8')))
    if (!pkg.scripts) return []
    scripts = pkg.scripts
  } catch {
    return []
  }
  /** @type {Map<string, string[]>} */
  const buckets = new Map()
  for (const name of Object.keys(scripts)) {
    const group = classifyScript(name)
    if (!buckets.has(group)) buckets.set(group, [])
    ;/** @type {NonNullable<ReturnType<typeof buckets.get>>} */
    (buckets.get(group)).push(name)
  }
  /** @type {Array<{ label: string; scripts: string[]; }>} */
  const groups = []
  for (const label of GROUP_ORDER) {
    const names = buckets.get(label)
    if (!names || names.length === 0) continue
    names.sort()
    groups.push({
      label,
      scripts: names
    })
  }
  return groups
}
/**
 * @param {string} projectDir
 * @returns {Promise<string | null>}
 */
const readCuratedNotes = async projectDir => {
  const file = join(projectDir, TOOLING_FILE)
  if (!existsSync(file)) return null
  try {
    return (await readFile(file, 'utf-8')).trim() || null
  } catch {
    return null
  }
}
/**
 * @param {string} name
 * @returns {Promise<string>}
 */
const describeProject = async name => {
  const dir = projectDir(name)
  if (!dir) return `### ${name}\nNot found under work/ or apps/.`
  /** @type {string[]} */
  const lines = [`### ${name} (${relative(root, dir)})`]
  const curated = await readCuratedNotes(dir)
  if (curated) {
    lines.push('Curated notes (`.tooling.md`):')
    lines.push(curated)
  }
  const groups = await readProjectScripts(dir)
  if (groups.length > 0) {
    const total = groups.reduce((acc, g) => acc + g.scripts.length, 0)
    lines.push(`\`package.json\` scripts by purpose (${total} total):`)
    for (const group of groups) {
      lines.push(`- ${group.label}: \`${group.scripts.join('`, `')}\``)
    }
  }
  const scriptsDir = listDirNames(join(dir, 'scripts'))
  if (scriptsDir.length > 0) {
    lines.push(`scripts/ dir: ${scriptsDir.join(', ')}`)
  }
  const toolsDir = listDirNames(join(dir, 'tools'))
  if (toolsDir.length > 0) {
    lines.push(`tools/ dir (admin/ops helpers): ${toolsDir.join(', ')}`)
  }
  return lines.join('\n')
}
/** @param {ExtensionAPI} pi */
const projectToolingExtension = pi => {
  pi.registerCommand('ptooling', {
    description:
      'Show tooling for a work/ or apps/ project (scripts, scripts/, tools/, .tooling.md). Usage: /ptooling [project|all]. With no argument, clears.',
    handler: async (args, ctx) => {
      const want = (args || '').trim()
      if (!want) {
        ctx.ui.setWidget('ptooling', undefined)
        ctx.ui.notify('project-tooling: results cleared', 'info')
        return
      }
      const projects = want === 'all' ? listProjects() : [want]
      const missing = projects.filter(p => !projectDir(p))
      /** @type {string[]} */
      const blocks = []
      for (const project of projects) {
        if (!projectDir(project)) continue
        blocks.push(await describeProject(project))
      }
      let text = blocks.join('\n\n---\n\n')
      if (missing.length) {
        text +=
          `\n\nNot found under work/ or apps/: ${missing.join(', ')}. ` + `Available: ${listProjects().join(', ')}`
      }
      const lines = text.split('\n')
      ctx.ui.notify(`project-tooling: ${want}`, 'info')
      ctx.ui.setWidget('ptooling', lines)
    }
  })
  pi.registerTool({
    name: 'project_tooling',
    label: 'Project Tooling',
    description:
      'List the scripts, ops helpers, and curated tooling notes for a work/ or apps/ project ' +
      '(package.json scripts grouped by purpose, scripts/ and tools/ dirs, and any ' +
      '.tooling.md). Use before working in, diagnosing, deploying, or running tests for ' +
      'a project so you use its existing tooling instead of guessing.',
    promptSnippet: 'List project scripts and tooling for a work/ or apps/ project',
    promptGuidelines: [
      'Before editing, diagnosing, testing, building, or deploying a project in work/ or apps/, ' +
        'call project_tooling to see its existing scripts and helpers. Mention the ' +
        'relevant npm run command you intend to use.'
    ],
    parameters: Type.Object({
      project: Type.Optional(
        Type.String({
          description:
            'Project directory name under work/ or apps/ (e.g. realness, seeq-app). ' +
            'Omit or pass "all" to list every project.'
        })
      )
    }),
    /** @param {{ project?: string; }} params */ async execute(_toolCallId, params, _signal, onUpdate, _ctx) {
      const want = params.project?.trim()
      const projects = want && want !== 'all' ? [want] : listProjects()
      if (!projects.length) {
        return {
          content: [
            {
              type: 'text',
              text: 'No work/ or apps/ projects found.'
            }
          ],
          details: {}
        }
      }
      onUpdate?.({
        content: [
          {
            type: 'text',
            text: `Reading tooling for ${projects.join(', ')}...`
          }
        ],
        details: {}
      })
      const missing = want && want !== 'all' ? projects.filter(p => !projectDir(p)) : []
      /** @type {string[]} */
      const blocks = []
      for (const project of projects) {
        if (missing.includes(project)) continue
        blocks.push(await describeProject(project))
      }
      let text = blocks.join('\n\n---\n\n')
      if (missing.length) {
        text +=
          `\n\nNot found under work/ or apps/: ${missing.join(', ')}. ` + `Available: ${listProjects().join(', ')}`
      }
      return {
        content: [
          {
            type: 'text',
            text
          }
        ],
        details: {
          projects: blocks.length
        }
      }
    }
  })
}
export default projectToolingExtension
