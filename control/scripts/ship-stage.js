#!/usr/bin/env node
// One source tree for the hosted image and the handed-out binary (k0).
// What ships is policy, so it lives here as data the tests read.
//
//   node control/scripts/ship-stage.js        writes dist/ship/
//   BRAYNESS_PROXY_URL=...                    the proxy the ship tree names
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const ROOT = join(project, '..', '..')
export const STAGE = join(project, 'dist', 'ship')
const DEFAULT_PROXY = 'https://brayness-proxy-yelzvhhngq-uc.a.run.app'

// The harness is an allowlist. Personal config, actors, and work/ never ship.
export const INCLUDE = ['AGENTS.md', 'README.md', 'LICENSE', 'package.json', 'bin', 'skills', 'prompts', 'extensions', 'themes',
  '.pi/agent/settings.json', '.pi/agent/models.json', '.pi/agent/npm/package.json']

// Skills that stay home, and why.
export const HOME_ONLY = {
  'brayness-sync': 'publishes the god harness and holds its .git mirror',
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

/** Whether a path, relative to the harness root, goes into the ship tree. */
export const ships = path => {
  const parts = path.split(sep)
  const name = parts.at(-1)
  if (name === '.DS_Store' || name.startsWith('._') || parts.includes('node_modules')) return false
  if (parts[0] === 'skills' && Object.hasOwn(HOME_ONLY, parts[1])) return false
  return true
}

// Files by their bytes: no Mac metadata, symlinks kept as links.
const copy = (from, to, root) => {
  const info = lstatSync(from)
  if (!ships(relative(root, from))) return
  if (info.isSymbolicLink()) return symlinkSync(readlinkSync(from), to)
  if (info.isDirectory()) {
    mkdirSync(to, { recursive: true })
    for (const name of readdirSync(from)) copy(join(from, name), join(to, name), root)
    return
  }
  mkdirSync(dirname(to), { recursive: true })
  writeFileSync(to, readFileSync(from))
  chmodSync(to, info.mode & 0o777)
}

const edit_json = (path, change) => {
  const value = JSON.parse(readFileSync(path, 'utf8'))
  change(value)
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
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
    pi_version = execFileSync('pi', ['--version'], { encoding: 'utf8' }).trim()
  } catch {
    throw new Error('pi is not installed on PATH')
  }
  if (!PI_VERSION.test(pi_version)) throw new Error(`invalid local pi version: ${pi_version}`)
  if (!PROXY_URL.test(proxy_url)) throw new Error('BRAYNESS_PROXY_URL must be an http(s) endpoint')

  rmSync(stage, { recursive: true, force: true })
  mkdirSync(stage, { recursive: true })
  writeFileSync(join(stage, '.pi-version'), `${pi_version}\n`)
  for (const path of INCLUDE) if (existsSync(join(root, path))) copy(join(root, path), join(stage, path), root)

  // Pi finds extensions and prompt templates (/site, /app) in its agent folder.
  symlinkSync('../../extensions', join(stage, '.pi/agent/extensions'))
  symlinkSync('../../prompts', join(stage, '.pi/agent/prompts'))
  // Sync the editable site and its stable ID at every Pi turn end.
  mkdirSync(join(stage, 'plans'), { recursive: true })
  writeFileSync(join(stage, 'plans/site.md'), '# Published site\n\n## Syncs\n\n- work/site\n')

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
  // Examples are not shipped: actors download them from brayness-examples with
  // giget when a prompt asks, and install @realness.online packages from npm.
  return stage
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(`ship tree: ${ship_stage()}`)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
