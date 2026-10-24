/**
 * Personal Context Extension
 *
 * Keeps the `work/` project table in the root `AGENTS.md` in sync with disk.
 * Pi loads that file itself; a missing one starts from `.pi/starter/AGENTS.md`.
 */
/**
 * @typedef {import("@earendil-works/pi-coding-agent").ExtensionAPI} ExtensionAPI
 * @typedef {object} Project
 * @property {string} label
 * @property {string} dir
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
const LOCAL_FILENAME = 'AGENTS.md'
const STARTER_FILENAME = '.pi/starter/AGENTS.md'
const WORK_SECTION = '## work/ (projects)'
const WORK_SYNC_START = '<!-- agents-local:work-sync -->'
const WORK_SYNC_END = '<!-- /agents-local:work-sync -->'
/**
 * @param {string} cwd
 * @returns {string | null}
 */
const findHarnessRoot = (cwd) => {
  const root = resolve('/')
  let currentDir = resolve(cwd)
  while (true) {
    if (existsSync(join(currentDir, '.pi', 'bin')) && existsSync(join(currentDir, 'work'))) {
      return currentDir
    }
    if (currentDir === root) break
    const parent = dirname(currentDir)
    if (parent === currentDir) break
    currentDir = parent
  }
  return null
}
/**
 * The person's AGENTS.md at the harness root, created from the starter if missing.
 * @param {string} cwd
 * @returns {string | null}
 */
const findLocalContextFile = (cwd) => {
  const harness = findHarnessRoot(cwd)
  if (!harness) return null
  const file = join(harness, LOCAL_FILENAME)
  const starter = join(harness, STARTER_FILENAME)
  if (!existsSync(file) && existsSync(starter)) copyFileSync(starter, file)
  return existsSync(file) ? file : null
}
/**
 * @param {string} filePath
 * @returns {string}
 */
const readLocalContext = (filePath) => {
  try {
    return readFileSync(filePath, 'utf-8').trim()
  } catch {
    return ''
  }
}
/**
 * @param {string} content
 * @returns {Map<string, string>}
 */
const parseWorkDescriptions = (content) => {
  /** @type {Map<string, string>} */
  const descriptions = new Map()
  const block =
    content.match(
      new RegExp(
        `${WORK_SYNC_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)${WORK_SYNC_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      ),
    )?.[1] ?? content
  for (const line of block.split('\n')) {
    const match = line.match(/^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|$/)
    if (match) descriptions.set(match[1], match[2])
  }
  return descriptions
}
/**
 * @param {string} projectDir
 * @returns {string}
 */
const projectHint = (projectDir) => {
  const pkgPath = join(projectDir, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = /** @type {{ description?: string; name?: string; }} */ (
        JSON.parse(readFileSync(pkgPath, 'utf-8'))
      )
      if (pkg.description && pkg.description !== pkg.name) return pkg.description
      if (pkg.name) return pkg.name
    } catch {}
  }
  const readmePath = join(projectDir, 'README.md')
  if (existsSync(readmePath)) {
    try {
      for (const line of readFileSync(readmePath, 'utf-8').split('\n')) {
        const text = line.replace(/^#+\s*/, '').trim()
        if (text && !text.startsWith('![')) return text.slice(0, 80)
      }
    } catch {}
  }
  return '(add description)'
}
/** A listed project: its table label and its folder. */
/**
 * @param {Project[]} projects
 * @param {Map<string, string>} descriptions
 * @returns {string}
 */
const buildWorkSyncBlock = (projects, descriptions) => {
  const sorted = [...projects].sort((a, b) => a.label.localeCompare(b.label))
  const rows = sorted.map(({ label, dir }) => {
    const desc = descriptions.get(label) ?? projectHint(dir)
    return `| \`${label}\` | ${desc} |`
  })
  const noGit = sorted.filter(({ dir }) => !existsSync(join(dir, '.git'))).map(({ label }) => label)
  return `${WORK_SYNC_START}
| Project | What it is |
|---------|------------|
${rows.join('\n')}

No git: ${noGit.map((name) => `\`${name}\``).join(', ')}.
${WORK_SYNC_END}`
}
/**
 * @param {string} harnessRoot
 * @param {string} localPath
 * @returns {void}
 */
const syncWorkSection = (harnessRoot, localPath) => {
  const workPath = join(harnessRoot, 'work')
  if (!existsSync(workPath)) return
  /** @type {Project[]} */
  const projects = readdirSync(workPath)
    .filter((name) => !name.startsWith('.') && statSync(join(workPath, name)).isDirectory())
    .map((name) => ({
      label: name,
      dir: join(workPath, name),
    }))
  const appsPath = join(harnessRoot, 'apps')
  if (existsSync(appsPath)) {
    for (const name of readdirSync(appsPath)) {
      const dir = join(appsPath, name)
      if (!name.startsWith('.') && existsSync(join(dir, 'package.json')))
        projects.push({
          label: `apps/${name}`,
          dir,
        })
    }
  }
  let content = readFileSync(localPath, 'utf-8')
  const descriptions = parseWorkDescriptions(content)
  const syncBlock = buildWorkSyncBlock(projects, descriptions)
  if (content.includes(WORK_SYNC_START)) {
    content = content.replace(
      new RegExp(
        `${WORK_SYNC_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${WORK_SYNC_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      ),
      syncBlock,
    )
  } else if (content.includes(WORK_SECTION)) {
    content = content.replace(
      new RegExp(`${WORK_SECTION}[\\s\\S]*?(?=\\n## |$)`),
      `${WORK_SECTION}

Code and client work live in \`work/<project>/\`; shipped code apps in \`apps/<name>/\`. Synced from disk by agents-local each session - edit descriptions in the table; rows add and remove automatically.

${syncBlock}`,
    )
  } else {
    const anchor = content.indexOf('\n## ')
    const insert = `\n\n${WORK_SECTION}

Code and client work live in \`work/<project>/\`; shipped code apps in \`apps/<name>/\`. Synced from disk by agents-local each session - edit descriptions in the table; rows add and remove automatically.

${syncBlock}\n`
    content =
      anchor === -1 ? content + insert : content.slice(0, anchor) + insert + content.slice(anchor)
  }
  writeFileSync(localPath, content, 'utf-8')
}
/** Splice personal context into README immediately before the last fenced block. */
/**
 * @param {string} readme
 * @param {string} insert
 * @returns {string}
 */
const insertBeforeLastCodeBlock = (readme, insert) => {
  const fence = /^```/gm
  let lastStart = -1
  /** @type {RegExpExecArray | null} */
  let match
  while ((match = fence.exec(readme)) !== null) lastStart = match.index
  if (lastStart === -1) return `${readme.trim()}\n\n${insert}\n`
  return `${readme.slice(0, lastStart).trimEnd()}\n\n${insert}\n\n${readme.slice(lastStart)}`
}
/**
 * @param {string} harnessRoot
 * @param {string} localPath
 * @returns {string | null}
 */
const buildReadmeWithLocal = (harnessRoot, localPath) => {
  const readmePath = join(harnessRoot, 'README.md')
  if (!existsSync(readmePath)) return null
  const local = readLocalContext(localPath)
  if (!local) return null
  const readme = readFileSync(readmePath, 'utf-8')
  const personal = [
    '## Personal Context',
    '',
    `From \`${LOCAL_FILENAME}\`:`,
    '',
    local,
  ].join('\n')
  return insertBeforeLastCodeBlock(readme, personal)
}
/** @param {ExtensionAPI} pi */
const agentsLocalExtension = (pi) => {
  /** @type {string | null} */
  let localFile = null
  /** @type {string | null} */
  let pendingInsert = null
  pi.on('resources_discover', async (event) => {
    localFile = findLocalContextFile(event.cwd)
    if (!localFile) return
    const harnessRoot = findHarnessRoot(event.cwd) ?? dirname(localFile)
    syncWorkSection(harnessRoot, localFile)
  })
  pi.registerCommand('insert', {
    description:
      'Splice AGENTS.md into README.md (before the last command block) for the next prompt',
    handler: async (_args, ctx) => {
      const harnessRoot = findHarnessRoot(ctx.cwd)
      if (!harnessRoot) {
        ctx.ui.notify('insert: harness root not found', 'error')
        return
      }
      const localPath =
        localFile ??
        (existsSync(join(harnessRoot, LOCAL_FILENAME)) ? join(harnessRoot, LOCAL_FILENAME) : null)
      if (!localPath) {
        ctx.ui.notify(`insert: no ${LOCAL_FILENAME}`, 'error')
        return
      }
      const combined = buildReadmeWithLocal(harnessRoot, localPath)
      if (!combined) {
        ctx.ui.notify('insert: README.md or personal context missing', 'error')
        return
      }
      pendingInsert = combined
      ctx.ui.notify('insert: README + AGENTS.md queued for next prompt', 'info')
    },
  })
  pi.on('before_agent_start', async (event) => {
    let systemPrompt = event.systemPrompt
    if (pendingInsert) {
      systemPrompt +=
        `\n\n## README + Personal Context\n\n` +
        `Loaded via /insert (AGENTS.md spliced into README before the last command block):\n\n` +
        pendingInsert
      pendingInsert = null
    }
    if (systemPrompt === event.systemPrompt) return
    return {
      systemPrompt,
    }
  })
}
export default agentsLocalExtension
