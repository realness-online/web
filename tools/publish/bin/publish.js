#!/usr/bin/env node
/**
 * The apps command, from a harness root.
 *
 *   brayness-publish catalog add <vault-file> [--kind k] [--tag t]...
 *   brayness-publish catalog classify <id> [--kind k] [--tag t]...
 *   brayness-publish catalog move <id> <vault-file>
 *   brayness-publish catalog remove <id>
 *   brayness-publish catalog list
 *   brayness-publish app add <name> --type blog|plans [--source <id>=<slug>]...
 *   brayness-publish app build <name> [--drafts]
 *   brayness-publish app list
 *   brayness-publish app publish <name> [--url <sync-url>] [--site-url <public-url>]
 *   brayness-publish app publish <name> --github <owner/repo> [--branch gh-pages] [--dry-run]
 *   brayness-publish app unpublish <name> [--url <sync-url>]
 *
 * Builds stay local. Only app publish activates a public snapshot.
 */
import { existsSync as exists_sync } from 'node:fs'
import { readFile as read_file, readdir, writeFile as write_file } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { add_source, app_sources, classify_source, move_source, new_app_id, read_app, read_catalog, remove_source, write_app } from '../src/sources.js'
import { build_app } from '../src/view.js'
import { publish_app, unpublish_app } from '../src/publish.js'
import { publish_github } from '../src/github.js'
import { SYNC_URL } from '#root/lib/files/src/client.js'

const [command, ...rest] = process.argv.slice(2)

/** Every `--name value`, and every bare word, in order. */
const options = (args) => {
  const values = {}
  const words = []
  const many = {}
  for (let at = 0; at < args.length; at++) {
    const arg = args[at]
    if (arg.startsWith('--')) {
      const name = arg.slice(2)
      if (name === 'drafts' || name === 'dry-run') { values[name] = true; continue }
      const value = args[at + 1]
      if (!value || value.startsWith('--')) throw new Error(`--${name} needs a value`)
      at++
      ;(many[name] ??= []).push(value)
      values[name] = value
    } else words.push(arg)
  }
  return { values, words, many }
}

const root_here = () => {
  if (process.env.BRAYNESS_ROOT) return resolve(process.env.BRAYNESS_ROOT)
  for (let dir = resolve('.'); ; dir = resolve(dir, '..')) {
    if (exists_sync(join(dir, 'apps')) || exists_sync(join(dir, 'vault')) || exists_sync(join(dir, '.ignore'))) return dir
    if (dir === resolve(dir, '..')) throw new Error('run this from a harness root, or set BRAYNESS_ROOT')
  }
}

const vault_of = (root) => process.env.BRAYNESS_VAULT ? resolve(process.env.BRAYNESS_VAULT) : join(root, 'vault')

/** The vault as app.json names it: relative to the app folder. */
const vault_in_app = (root, vault) => relative(join(root, 'apps'), vault)

const write_site_json = async (path, body) => {
  try { await read_file(path) } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await write_file(path, body)
  }
}

const commands = {
  async catalog() {
    const [action, ...args] = rest
    const root = root_here()
    const vault = vault_of(root)
    const { values, words, many } = options(args)
    if (action === 'add') {
      const [path] = words
      const saved = await add_source(vault, path, { kind: values.kind ?? 'article', tags: many.tag ?? [] })
      console.log(`${saved.id}  ${saved.path}`)
    } else if (action === 'classify') {
      const [id] = words
      const saved = await classify_source(vault, id, { ...(values.kind && { kind: values.kind }), tags: many.tag ?? [] })
      console.log(`${id}  ${saved.kind}  ${saved.tags.join(', ') || '(no tags)'}`)
    } else if (action === 'move') {
      const [id, path] = words
      await move_source(vault, id, path)
      console.log(`${id}  ${path}`)
    } else if (action === 'remove') {
      await remove_source(vault, words[0])
      console.log(`removed ${words[0]}`)
    } else if (action === 'list') {
      const catalog = await read_catalog(vault)
      const entries = Object.entries(catalog.sources)
      if (!entries.length) return console.log('the catalog is empty')
      for (const [id, source] of entries) console.log(`${id}  ${source.path}  ${source.kind}  ${source.tags.join(', ')}`)
    } else throw new Error('catalog add|classify|move|remove|list')
  },

  async app() {
    const [action, ...args] = rest
    const root = root_here()
    const { values, words, many } = options(args)
    if (action === 'add') {
      const [name] = words
      if (!/^[a-z0-9-]+$/.test(name ?? '') || !['blog', 'plans'].includes(values.type)) throw new Error('app add <name> --type blog|plans')
      const directory = join(root, 'apps', name)
      if (exists_sync(join(directory, 'app.json'))) throw new Error(`app already exists: ${name}`)
      const sources = (many.source ?? []).map((pair) => {
        const at = pair.lastIndexOf('=')
        if (at < 1) throw new Error(`--source wants <id>=<slug>: ${pair}`)
        return { id: pair.slice(0, at), slug: pair.slice(at + 1) }
      })
      const vault = vault_of(root)
      const catalog = await read_catalog(vault)
      for (const source of sources) if (!catalog.sources[source.id]) throw new Error(`unknown source: ${source.id}`)
      await write_app(directory, { id: new_app_id(), type: values.type, vault: values.vault ?? vault_in_app(root, vault), sources, assets: [] })
      await write_site_json(join(directory, 'site.json'), `${JSON.stringify({ name, tagline: '', url: '', description: '', poster: 'example.svg' }, null, 2)}\n`)
      console.log(`${name}: ${join(directory, 'app.json')}`)
    } else if (action === 'build') {
      const [name] = words
      const built = await build_app(root, name, { drafts: 'drafts' in values || args.includes('--drafts') })
      console.log(`built ${built.type} app ${name}: ${built.dist}`)
      for (const source of built.sources) console.log(`  ${source.route}  ${source.id}`)
    } else if (action === 'publish' && values.github) {
      const [name] = words
      const built = await build_app(root, name)
      const push = !values['dry-run']
      const result = await publish_github({ dist: built.dist, work: join(root, 'artifacts/apps-github', name), repository: values.github, branch: values.branch, message: `Publish ${name} from Brayness`, push })
      console.log(`${name} -> ${values.github} ${values.branch ?? 'gh-pages'}: ${result.summary}${result.changed && !push ? ' (dry run, not pushed)' : ''}`)
    } else if (action === 'publish') {
      const result = await publish_app(root, words[0], { url: values.url ?? SYNC_URL, site_url: values['site-url'] ?? process.env.SYNC_SITE_PUBLIC_URL ?? values.url ?? SYNC_URL })
      console.log(result.url)
      for (const source of result.sources) console.log(`  ${source.url}`)
    } else if (action === 'unpublish') {
      if (!/^[a-z0-9-]+$/.test(words[0] ?? '')) throw new Error('invalid app name')
      const app = await read_app(join(root, 'apps', words[0]))
      await unpublish_app(app.id, { url: values.url ?? SYNC_URL })
      console.log(`unpublished ${words[0]}`)
    } else if (action === 'list') {
      const apps = join(root, 'apps')
      for (const name of exists_sync(apps) ? await readdir(apps) : []) {
        if (!exists_sync(join(apps, name, 'app.json'))) continue
        const { app, sources } = await app_sources(join(apps, name))
        console.log(`${name}  ${app.type}  ${app.id}  ${sources.length} source(s)`)
      }
    } else throw new Error('app add|build|list|publish|unpublish')
  },
}

try {
  if (!commands[command]) throw new Error('usage: brayness-publish catalog <action> | app <action>')
  await commands[command]()
} catch (error) {
  console.error(`brayness-publish: ${error.message}`)
  process.exit(1)
}
