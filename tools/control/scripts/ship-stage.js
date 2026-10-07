#!/usr/bin/env node
// One source tree for the hosted image and the handed-out binary (k0).
// What ships is policy, so it lives here as data the tests read.
//
//   node tools/control/scripts/ship-stage.js        writes <out>/ship/ (lib/output.js)
//   BRAYNESS_PROXY_URL=...                    the proxy the ship tree names
import { execFileSync as exec_file_sync } from 'node:child_process'
import { createHash as create_hash } from 'node:crypto'
import { chmodSync as chmod_sync, existsSync as exists_sync, lstatSync as lstat_sync, mkdirSync as mkdir_sync, readdirSync as readdir_sync, readFileSync as read_file_sync, readlinkSync as readlink_sync, rmSync as rm_sync, symlinkSync as symlink_sync, writeFileSync as write_file_sync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { out_path } from '#root/lib/output.js'
import { cpSync as cp_sync } from 'node:fs'


const project = join(dirname(file_url_to_path(import.meta.url)), '..', '..', '..')
const STATIC_RENDERER = join(project, 'tools/publish/renderer')
export const ROOT = join(project, '..', '..')
export const STAGE = out_path('ship')
const DEFAULT_PROXY = 'https://brayness-proxy-yelzvhhngq-uc.a.run.app'

// The harness is an allowlist. Personal config, actors, and work/ never ship.
export const INCLUDE = ['AGENTS.md', 'README.md', 'LICENSE', 'package.json', 'bin', 'skills', 'prompts', 'extensions', 'themes',
  '.pi/agent/settings.json', '.pi/agent/models.json', '.pi/agent/npm/package.json']

/** Shipped at the tree root, kept in .pi/ at home. */
export const HOME_IN_PI = ['skills', 'prompts', 'extensions']

// Skills that stay home, and why.
export const HOME_ONLY = {
  'nvim-buffers': "reads Scott's Neovim",
  'zoom-to-ableton': "carries Scott's effect rack",
  'vuetify-to-semantic': "carries a client's codebase (seeq-app)",
  // Chrome takes ~45 s to start in 483 MB; web-md reads by fetch or Firecrawl.
  'agent-browser': 'actors have no browser until c3',
  'vue-inspect': 'drives agent-browser'
}

// Packages a shipped harness cannot use cost startup seconds on two vCPUs: no
// MCP servers ship, long work runs as autoresearch loops, never subagents, and
// usage reports proxy calls. The Claude OAuth adapter ships: a person may sign
// in with a subscription instead of the proxy.
export const UNSHIPPED_PACKAGES = ['pi-mcp-adapter', 'pi-subagents-j0k3r', 'pi-mono-usage']

const PI_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/
const PROXY_URL = /^https?:\/\/[^/\s]+(\/\S*)?$/
/** Examples a workspace starts apps from; chat and terminal build into images. */
export const SHIPPED_EXAMPLES = ['static', 'app']

/** The starter's identity, written last so it never hashes itself. */
export const STARTER = 'starter.json'

/** Whether a path, relative to the harness root, goes into the ship tree. */
export const ships = path => {
  const parts = path.split(sep)
  const name = parts.at(-1)
  if (name === '.DS_Store' || name.startsWith('._') || parts.includes('node_modules')) return false
  if (parts[0] === 'skills' && Object.hasOwn(HOME_ONLY, parts[1])) return false
  if (parts[0] === 'examples' && (name === 'dist' || name === '.cache')) return false
  return true
}

// Files by their bytes: no Mac metadata, symlinks kept as links.
const copy = (from, to, root) => {
  const info = lstat_sync(from)
  if (!ships(relative(root, from))) return
  if (info.isSymbolicLink()) return symlink_sync(readlink_sync(from), to)
  if (info.isDirectory()) {
    mkdir_sync(to, { recursive: true })
    for (const name of readdir_sync(from)) copy(join(from, name), join(to, name), root)
    return
  }
  mkdir_sync(dirname(to), { recursive: true })
  write_file_sync(to, read_file_sync(from))
  chmod_sync(to, info.mode & 0o777)
}

const edit_json = (path, change) => {
  const value = JSON.parse(read_file_sync(path, 'utf8'))
  change(value)
  write_file_sync(path, `${JSON.stringify(value, null, 2)}\n`)
}

/**
 * A starter's identity: a content hash over every shipped path, plus each
 * path's hash or link target. Identical trees give one version; any change
 * gives another. A person reads the list to see exactly what ships.
 */
export const starter_manifest = stage => {
  const files = {}
  const walk = (dir, base) => {
    for (const name of readdir_sync(dir).sort()) {
      const from = join(dir, name)
      const path = base ? `${base}/${name}` : name
      const info = lstat_sync(from)
      if (info.isDirectory()) walk(from, path)
      else if (info.isSymbolicLink()) files[path] = `link:${readlink_sync(from)}`
      else files[path] = create_hash('sha256').update(read_file_sync(from)).digest('hex')
    }
  }
  walk(stage, '')
  const version = create_hash('sha256')
    .update(Object.keys(files).map(path => `${path}:${files[path]}`).join('\n'))
    .digest('hex')
  return { version, files }
}

// The ship tree names its own one provider; the Mac's model list stays local.
// Shipped Pi asks its host door for a person-bound pass on each proxy call.
const brayness_provider = proxy_url => ({
  baseUrl: proxy_url,
  apiKey: '!brayness-model-pass',
  api: 'openai-completions',
  compat: { supportsDeveloperRole: false, supportsReasoningEffort: false },
  models: [
    { id: 'inkling', name: 'Inkling (brayness proxy)', input: ['text'], contextWindow: 1048576, maxTokens: 32768,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } },
    // Paid plans only; the proxy refuses it without one. Cost per 1M tokens.
    { id: 'house', name: 'DeepSeek (house model, paid plan)', input: ['text'], contextWindow: 1048576, maxTokens: 32768,
      cost: { input: 0.042, output: 0.084, cacheRead: 0.0084, cacheWrite: 0 } }
  ]
})

/** Build the ship tree. Checks run first, so a bad input keeps the last tree. */
export const ship_stage = ({ root = ROOT, stage = STAGE, proxy_url = process.env.BRAYNESS_PROXY_URL || DEFAULT_PROXY } = {}) => {
  let pi_version
  try {
    pi_version = exec_file_sync('pi', ['--version'], { encoding: 'utf8' }).trim()
  } catch {
    throw new Error('pi is not installed on PATH')
  }
  if (!PI_VERSION.test(pi_version)) throw new Error(`invalid local pi version: ${pi_version}`)
  if (!PROXY_URL.test(proxy_url)) throw new Error('BRAYNESS_PROXY_URL must be an http(s) endpoint')

  const previous = exists_sync(join(stage, STARTER)) ? JSON.parse(read_file_sync(join(stage, STARTER), 'utf8')) : null
  rm_sync(stage, { recursive: true, force: true })
  mkdir_sync(stage, { recursive: true })
  write_file_sync(join(stage, '.pi-version'), `${pi_version}\n`)
  // Home keeps skills, prompts, and extensions in .pi/; the ship tree keeps them at its root.
  for (const path of INCLUDE) {
    const base = HOME_IN_PI.includes(path) ? join(root, '.pi') : root
    if (exists_sync(join(base, path))) copy(join(base, path), join(stage, path), base)
  }

  // Every new workspace has private apps carried by normal harness sync.
  mkdir_sync(join(stage, 'apps'), { recursive: true })
  write_file_sync(join(stage, '.ignore'), '')
  // The site and app examples that /site, /app, and the apps renderer copy.
  for (const name of SHIPPED_EXAMPLES) {
    const destination = join(stage, 'examples', name)
    if (name === 'static') {
      const excluded = new Set(['node_modules', 'dist', '.cache', '.DS_Store'])
      cp_sync(STATIC_RENDERER, destination, { recursive: true, filter: path => !excluded.has(path.split(sep).at(-1)) })
      copy(join(project, 'tools/examples/static/package.json'), join(destination, 'package.json'), project)
      copy(join(project, 'tools/examples/static/package-lock.json'), join(destination, 'package-lock.json'), project)
    } else copy(join(project, 'tools', 'examples', name), destination, join(project, 'tools'))
  }
  edit_json(join(stage, 'package.json'), pkg => {
    if (pkg.brayness) delete pkg.brayness.examples
    for (const asset of ['skills', 'prompts', 'extensions']) {
      if (pkg.pi?.[asset]) pkg.pi[asset] = [`./${asset}`]
    }
  })

  // Pi finds extensions and prompt templates (/site, /app) in its agent folder.
  symlink_sync('../../extensions', join(stage, '.pi/agent/extensions'))
  symlink_sync('../../prompts', join(stage, '.pi/agent/prompts'))
  // Sync the editable site and its stable ID at every Pi turn end.
  mkdir_sync(join(stage, 'plans'), { recursive: true })
  write_file_sync(join(stage, 'plans/site.md'), '# Published site\n\n## Syncs\n\n- work/site\n')

  edit_json(join(stage, '.pi/agent/settings.json'), settings => {
    settings.defaultProvider = 'brayness'
    settings.defaultModel = 'inkling'
    // No enabledModels: the Mac list must not ship, and Pi cycles every
    // authenticated model when the pattern list is absent.
    delete settings.enabledModels
    settings.packages = settings.packages.filter(p => !UNSHIPPED_PACKAGES.includes(p.replace(/^npm:/, '')))
  })
  edit_json(join(stage, '.pi/agent/npm/package.json'), npm => {
    for (const name of UNSHIPPED_PACKAGES) delete npm.dependencies[name]
  })
  edit_json(join(stage, '.pi/agent/models.json'), models => {
    models.providers = { brayness: brayness_provider(proxy_url) }
  })
  // k2: the tree names its own version and every file in it. Written last, so
  // the manifest covers everything above and never hashes itself.
  const manifest = starter_manifest(stage)
  const built_at = previous?.version === manifest.version && previous.built_at ? previous.built_at : new Date().toISOString()
  write_file_sync(join(stage, STARTER), `${JSON.stringify({ version: manifest.version, pi: pi_version, built_at, files: manifest.files }, null, 2)}\n`)
  return stage
}

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  try {
    const stage = ship_stage()
    const starter = JSON.parse(read_file_sync(join(stage, STARTER), 'utf8'))
    const paths = Object.keys(starter.files)
    console.log(`ship tree: ${stage}`)
    console.log(`starter: ${starter.version} (pi ${starter.pi}, ${paths.length} files)`)
    if (process.argv.includes('--list')) for (const path of paths) console.log(`  ${path}`)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
