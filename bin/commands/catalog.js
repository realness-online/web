import { readdir, readFile as read_file, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { cli_families } from './cli.js'
import { reviewed } from './review.js'

const excluded = new Set(['node_modules', '.git', 'dist', 'target', 'vendor', '.vite-hooks', 'coverage', '.output', '.cache', 'fixtures', 'capture', 'test', 'tests', 'references'])
const group_for = name => {
  if (/^(deploy|release|ship|.*version|verify)/.test(name)) return 'Deploy and release'
  if (/^test/.test(name)) return 'Test'
  if (/^(check|type|pre-commit|fallow|plan-shape)/.test(name)) return 'Check'
  if (/^build/.test(name)) return 'Build'
  if (/^(local|dev|serve|start|realness|realness)/.test(name)) return 'Run locally'
  return 'Tools'
}

const walk = async (root, directory, skip = excluded) => {
  const files = []
  let entries
  try {
    entries = await readdir(join(root, directory), { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return files
    throw error
  }
  for (const entry of entries) {
    if (skip.has(entry.name) || entry.name.startsWith('.DS_Store')) continue
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) files.push(...await walk(root, path, skip))
    else if (entry.isFile()) files.push(path)
  }
  return files.sort()
}

/** Inventory source entry points without running services, helpers, or remote commands. */
export const collect_commands = async root => {
  const files = ['package.json', ...await walk(root, 'apps'), ...await walk(root, 'bin'), ...await walk(root, '.pi/skills'), ...await walk(root, '.pi/examples'), ...await walk(root, 'skills')]
  const texts = new Map()
  const text_of = async path => {
    if (!texts.has(path)) texts.set(path, await read_file(join(root, path), 'utf8'))
    return texts.get(path)
  }
  const entries = []
  const missing_targets = []
  const packages = []
  const bins = []
  for (const source of files.filter(path => basename(path) === 'package.json')) {
    const manifest = JSON.parse(await text_of(source))
    const folder = dirname(source)
    const prefix = folder === '.' ? 'npm run' : `npm --prefix ${folder} run`
    packages.push(source)
    for (const [name, script] of Object.entries(manifest.scripts ?? {})) {
      const command = folder === '.' && name === 'start' ? 'npm start' : `${prefix} ${name}`
      let cwd = join(root, folder)
      for (const segment of script.split('&&')) {
        const command_text = segment.trim()
        const cd = command_text.match(/^cd ([\w./-]+)$/)
        if (cd) cwd = resolve(cwd, cd[1])
        const target = command_text.match(/^(?:node|bash) ([\w./-]+\.(?:js|sh))\b/)?.[1] ?? command_text.match(/^(\.\/[\w./-]+\.sh)\b/)?.[1]
        if (!target) continue
        const file = resolve(cwd, target)
        const exists = await stat(file).then(() => true, error => {
          if (error.code === 'ENOENT') return false
          throw error
        })
        if (!exists && !folder.startsWith('.pi/examples')) missing_targets.push({ source: `${source}#scripts.${name}`, message: `Missing script target: ${relative(root, file)}. Defined script needs repair or generated template files.` })
      }
      entries.push({
        id: `${source}#scripts.${name}`,
        kind: 'npm script',
        title: name,
        display: name === 'start' && folder === '.' ? 'npm start' : `npm run ${name}`,
        command,
        source,
        group: group_for(name),
        package: folder === '.' ? 'Harness' : folder.replace('apps/realness/', ''),
        definition: script,
        options: 'Append -- before script arguments.',
        context: 'Defined in package.json; execution not verified by this inventory.',
      })
    }
    for (const [name, entry] of Object.entries(typeof manifest.bin === 'string' ? { [manifest.name]: manifest.bin } : manifest.bin ?? {})) {
      bins.push({ name, source, entry: relative(root, join(root, folder, entry)) })
    }
  }
  for (const family of cli_families) {
    await text_of(family.source)
    await text_of(family.entry)
    for (const [route, group, description, options, context] of family.routes) {
      entries.push({
        id: `${family.entry}#${route}`,
        kind: 'CLI command',
        title: `${family.name} ${route}`,
        display: `${family.launcher ?? family.name.toLowerCase()} ${route}`,
        command: `${family.launcher ?? `node ${family.entry}`} ${route}`,
        source: family.source,
        group,
        package: family.name,
        definition: description,
        options,
        context: `${context}${family.name === 'Webspace' ? ' Environments: local or development; --json available. Old dev/prod names are rejected.' : ''}`,
      })
    }
  }
  const covered = new Set(cli_families.map(family => family.entry))
  const candidates = []
  const shell_libraries = []
  for (const source of files) {
    if (covered.has(source) || /\.(test|spec)\./.test(source)) continue
    if (source.includes('/renderer/static/') || source === 'bin/commands/catalog.js') continue
    const extension = extname(source)
    if (!['', '.js', '.ts', '.sh', '.py'].includes(extension)) continue
    if ((await stat(join(root, source))).size > 500_000) continue
    const text = await text_of(source)
    if (extension === '.sh' && (source.includes('/lib/') || source.endsWith('/lib.sh') || source.endsWith('/service-env.sh'))) {
      shell_libraries.push(source)
      continue
    }
    const detected = extension === '.sh' || text.startsWith('#!') || (extension === '.js' && (/process\.argv/.test(text) || source.includes('/scripts/') && !/(?:^|\n)export\s/.test(text)))
    if (!detected) continue
    candidates.push(source)
    let launcher = ''
    if (extension === '.js' || extension === '.ts' || /^#!.*\bnode\b/.test(text)) launcher = 'node '
    else if (extension === '.sh' || /^#!.*\bbash\b/.test(text)) launcher = 'bash '
    let platform = ''
    if (source.includes('/guest/')) platform = 'Actor VM only. '
    else if (source.includes('/server/host/scripts/')) platform = 'Linux host VM; elevated permissions may be required. '
    entries.push({
      id: source,
      kind: 'Entry file',
      title: basename(source),
      display: `${launcher}${source}`,
      command: `${launcher}${source}`,
      source,
      group: 'Internal helpers',
      package: dirname(source),
      definition: 'Detected by shebang, process.argv or a script-directory entry. This is a source candidate, not a verified desktop command.',
      options: 'Read the source for required arguments.',
      context: `${platform}Working directory, arguments and side effects need review before running.`,
    })
  }
  const references = []
  const reference_files = [...new Set([
    ...files,
    'README.md',
    'AGENTS.md',
    ...await walk(root, '.pi/prompts'),
    ...await walk(root, '.pi/extensions'),
    ...await walk(root, '.pi/skills', new Set()),
  ])]
  for (const source of reference_files) {
    if (source.startsWith('bin/commands') || /\.(test|spec)\./.test(source)) continue
    if (!['.js', '.ts', '.sh', '.py', '.json', '.md', '.html', ''].includes(extname(source))) continue
    if ((await stat(join(root, source))).size > 500_000) continue
    references.push({ source, text: await text_of(source) })
  }
  /** Instruction files a maintainer keeps current; changelogs and plans are history. */
  const is_curated_doc = path => extname(path) === '.md' && (/(^|\/)(README|FORK|documentation|SECURITY|SIGNING|SOURCES)\.md$/.test(path) || path.endsWith('.tooling.md') || path.endsWith('SKILL.md') || /(^|\/)(docs|references)\/|\.auto\//.test(path))
  const mentions = (text, needle) => {
    if (!needle) return false
    let position = text.indexOf(needle)
    while (position !== -1) {
      const after = text[position + needle.length]
      if (!after || /[\s'"`;)\]]/.test(after)) return true
      position = text.indexOf(needle, position + 1)
    }
    return false
  }
  for (const entry of entries) {
    const script_name = entry.id.split('#scripts.')[1]
    const route = entry.kind === 'CLI command' ? entry.display.split(' <')[0].split(' --')[0] : null
    const needles = entry.kind === 'Entry file'
      ? [entry.source, basename(entry.source)]
      : script_name ? [`npm run ${script_name}`, `npm --prefix ${dirname(entry.source)} run ${script_name}`, `run ${script_name}`, `'${script_name}'`, `"${script_name}"`] : [route]
    const callers = references.filter(reference => {
      if (reference.source === entry.source && entry.kind !== 'npm script') return
      let text = reference.text
      if (entry.definition) text = text.replace(entry.definition, '')
      return needles.some(needle => mentions(text, needle))
    })
    const runtime = callers.filter(reference => !['.md', '.html'].includes(extname(reference.source)))
    const documented = callers.filter(reference => is_curated_doc(reference.source))
    entry.review = runtime.length || documented.length ? 'Keep' : 'Unknown'
    entry.review_reason = runtime.length
      ? `Called by ${runtime.slice(0, 3).map(reference => reference.source).join(', ')}.${runtime.length > 3 ? ` ${runtime.length} callers total.` : ''}`
      : documented.length ? `Documented in ${documented.slice(0, 3).map(reference => reference.source).join(', ')}.`
      : 'No caller or maintained note found; decide by hand.'
    if (entry.id.startsWith('bin/session-format.js#')) {
      entry.review_reason = 'Migration ran, but four JSONL files and two recovery backups remain.'
      if (entry.id.endsWith('#rollback <manifest>')) entry.review = 'Keep'
    } else if (/^realness (turn-start|turn-end|fetch|git-credential)( |$)/.test(entry.display)) {
      entry.review = 'Keep'
      entry.review_reason = 'Used by the edit-log extension or actor runtime.'
    } else if (['preversion', 'version', 'postversion'].includes(script_name)) {
      entry.review = 'Keep'
      entry.review_reason = 'npm lifecycle hook; npm runs it around a version bump.'
    }
    const broken = missing_targets.find(target => target.source === entry.id)
    if (broken) {
      entry.review = 'Remove'
      entry.review_reason = broken.message
    } else {
      const decision = reviewed[entry.id]
      if (decision) [entry.review, entry.review_reason] = decision
    }
  }
  const warnings = [
    ...missing_targets,
    { source: 'package.json#scripts.start', message: 'npm start and npm run realness start Pi; npm run realness remains an alias. The app package has a separate operator command.' },
    ...(JSON.parse(await text_of('package.json')).scripts.local ? [] : [{ source: 'npm run local', message: 'Planned only. No local launcher script exists yet.' }]),
  ]
  return { scope: 'Harness root bin/, apps/, .pi/skills/ and skills/. Work projects, dependencies, builds, fixtures and individual tests are excluded. External tool subcommands are delegated to their own help.', packages, bins, candidates, shell_libraries, warnings, entries }
}
