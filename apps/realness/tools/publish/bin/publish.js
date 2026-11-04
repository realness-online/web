#!/usr/bin/env node
/**
 * The apps command, from a harness root.
 *
 *   realness-publish items list
 *   realness-publish items mint <vault-file> --type articles|plans|pages|...
 *   realness-publish items settle      give each copied itemid to its copy
 *   realness-publish app add <name> --type blog|plans [--source <id>=<slug>]...
 *   realness-publish app build <name> [--drafts]
 *   realness-publish app list
 *   realness-publish app publish <name> [--url <sync-url>] [--site-url <public-url>]
 *   realness-publish app publish <name> --github <owner/repo> [--branch gh-pages] [--dry-run]
 *   realness-publish app unpublish <name> [--url <sync-url>]
 *
 * Builds stay local. Only app publish activates a public snapshot.
 */
import { existsSync as exists_sync } from 'node:fs'
import {
  readFile as read_file,
  readdir,
  writeFile as write_file
} from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import {
  app_sources,
  mint_item,
  new_app_id,
  read_app,
  scan_vault,
  write_app
} from '#root/src/publish/sources.js'
import { build_app } from '#root/src/publish/view.js'
import { publish_app, unpublish_app } from '#root/src/publish/publish.js'
import { publish_github } from '#root/src/publish/github.js'
import { SYNC_URL } from '#root/src/files/client.js'
import { person } from '#root/src/harness/settings.js'

const [command, ...rest] = process.argv.slice(2)

/** Every `--name value`, and every bare word, in order. */
const options = args => {
  const values = {}
  const words = []
  const many = {}
  for (let at = 0; at < args.length; at++) {
    const arg = args[at]
    if (arg.startsWith('--')) {
      const name = arg.slice(2)
      if (name === 'drafts' || name === 'dry-run') {
        values[name] = true
        continue
      }
      const value = args[at + 1]
      if (!value || value.startsWith('--'))
        throw new Error(`--${name} needs a value`)
      at++
      ;(many[name] ??= []).push(value)
      values[name] = value
    } else words.push(arg)
  }
  return { values, words, many }
}

const root_here = () => {
  for (let dir = resolve('.'); ; dir = resolve(dir, '..')) {
    if (
      exists_sync(join(dir, 'apps')) ||
      exists_sync(join(dir, 'vault')) ||
      exists_sync(join(dir, '.ignore'))
    )
      return dir
    if (dir === resolve(dir, '..'))
      throw new Error('run this from a harness root')
  }
}

const vault_of = root => join(root, 'vault')

/**
 * The vault as app.json names it: relative to the app folder, which is where
 * the record is written and where app_sources resolves it from. A base of
 * `<root>/apps` writes '../vault', which app list then cannot resolve.
 */
const vault_in_app = (directory, vault) => relative(directory, vault)

const write_site_json = async (path, body) => {
  try {
    await read_file(path)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await write_file(path, body)
  }
}

/** `app` actions; each gets the harness root, the words, and the flags. */
const app_actions = {
  add: async ({ root, words, values, many }) => {
    const [name] = words
    if (
      !/^[a-z0-9-]+$/.test(name ?? '') ||
      !['blog', 'plans'].includes(values.type)
    )
      throw new Error('app add <name> --type blog|plans')
    const directory = join(root, 'apps', name)
    if (exists_sync(join(directory, 'app.json')))
      throw new Error(`app already exists: ${name}`)
    const sources = (many.source ?? []).map(pair => {
      const at = pair.lastIndexOf('=')
      if (at < 1) throw new Error(`--source wants <id>=<slug>: ${pair}`)
      return { id: pair.slice(0, at), slug: pair.slice(at + 1) }
    })
    const vault = vault_of(root)
    const { items } = await scan_vault(vault)
    for (const source of sources)
      if (!items.has(source.id)) throw new Error(`unknown item: ${source.id}`)
    await write_app(directory, {
      id: new_app_id(),
      type: values.type,
      vault: values.vault ?? vault_in_app(directory, vault),
      sources,
      assets: []
    })
    await write_site_json(
      join(directory, 'site.json'),
      `${JSON.stringify({ name, tagline: '', url: '', description: '', poster: 'example.svg' }, null, 2)}\n`
    )
    console.info(`${name}: ${join(directory, 'app.json')}`)
  },
  build: async ({ root, words, values, args }) => {
    const [name] = words
    const built = await build_app(root, name, {
      drafts: 'drafts' in values || args.includes('--drafts')
    })
    console.info(`built ${built.type} app ${name}: ${built.dist}`)
    for (const source of built.sources)
      console.info(`  ${source.route}  ${source.id}`)
  },
  publish: given =>
    given.values.github ? publish_github_app(given) : publish_sync_app(given),
  unpublish: async ({ root, words, values }) => {
    if (!/^[a-z0-9-]+$/.test(words[0] ?? ''))
      throw new Error('invalid app name')
    const app = await read_app(join(root, 'apps', words[0]))
    await unpublish_app(app.id, { url: values.url ?? SYNC_URL })
    console.info(`unpublished ${words[0]}`)
  },
  list: async ({ root }) => {
    const apps = join(root, 'apps')
    const names = (exists_sync(apps) ? await readdir(apps) : []).filter(name =>
      exists_sync(join(apps, name, 'app.json'))
    )
    const found = await Promise.all(
      names.map(name => app_sources(join(apps, name)))
    )
    names.forEach((name, index) => {
      const { app, sources } = found[index]
      console.info(
        `${name}  ${app.type}  ${app.id}  ${sources.length} source(s)`
      )
    })
  }
}

const publish_github_app = async ({ root, words, values }) => {
  const [name] = words
  const built = await build_app(root, name)
  const push = !values['dry-run']
  const result = await publish_github({
    dist: built.dist,
    work: join(root, 'artifacts/apps-github', name),
    repository: values.github,
    branch: values.branch,
    message: `Publish ${name} from Realness`,
    push
  })
  console.info(
    `${name} -> ${values.github} ${values.branch ?? 'gh-pages'}: ${result.summary}${result.changed && !push ? ' (dry run, not pushed)' : ''}`
  )
}

const publish_sync_app = async ({ root, words, values }) => {
  if (values.drafts) console.error('drafts included: local preview only')
  const result = await publish_app(root, words[0], {
    url: values.url ?? SYNC_URL,
    site_url: values['site-url'] ?? values.url ?? SYNC_URL,
    drafts: Boolean(values.drafts)
  })
  console.info(result.url)
  for (const source of result.sources) console.info(`  ${source.url}`)
}

const commands = {
  async items() {
    const [action, ...args] = rest
    const root = root_here()
    const vault = vault_of(root)
    const { values, words } = options(args)
    if (action === 'list') {
      const { items, copies } = await scan_vault(vault)
      for (const [id, path] of items) console.info(`${id}  ${path}`)
      for (const copy of copies)
        console.info(`copy of ${copy.id}  ${copy.path}`)
    } else if (action === 'mint')
      console.info(
        await mint_item(vault, words[0], {
          author: person(root),
          type: values.type
        })
      )
    else if (action === 'settle') {
      const scan = await scan_vault(vault)
      for await (const copy of scan.copies)
        console.info(
          `${await mint_item(vault, copy.path, { author: person(root), scan })}  ${copy.path}`
        )
    } else throw new Error('items list|mint|settle')
  },

  app() {
    const [action, ...args] = rest
    const run = Object.hasOwn(app_actions, action) ? app_actions[action] : null
    if (!run) throw new Error('app add|build|list|publish|unpublish')
    return run({ root: root_here(), args, ...options(args) })
  }
}

try {
  if (!commands[command])
    throw new Error('usage: realness-publish items <action> | app <action>')
  await commands[command]()
} catch (error) {
  console.error(`realness-publish: ${error.message}`)
  process.exit(1)
}
