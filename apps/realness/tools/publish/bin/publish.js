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

const commands = {
  async items() {
    const [action, ...args] = rest
    const root = root_here()
    const vault = vault_of(root)
    const { values, words } = options(args)
    if (action === 'list') {
      const { items, copies } = await scan_vault(vault)
      for (const [id, path] of items) console.log(`${id}  ${path}`)
      for (const copy of copies) console.log(`copy of ${copy.id}  ${copy.path}`)
    } else if (action === 'mint')
      console.log(
        await mint_item(vault, words[0], {
          author: person(root),
          type: values.type
        })
      )
    else if (action === 'settle') {
      const scan = await scan_vault(vault)
      for (const copy of scan.copies)
        console.log(
          `${await mint_item(vault, copy.path, { author: person(root), scan })}  ${copy.path}`
        )
    } else throw new Error('items list|mint|settle')
  },

  async app() {
    const [action, ...args] = rest
    const root = root_here()
    const { values, words, many } = options(args)
    if (action === 'add') {
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
      console.log(`${name}: ${join(directory, 'app.json')}`)
    } else if (action === 'build') {
      const [name] = words
      const built = await build_app(root, name, {
        drafts: 'drafts' in values || args.includes('--drafts')
      })
      console.log(`built ${built.type} app ${name}: ${built.dist}`)
      for (const source of built.sources)
        console.log(`  ${source.route}  ${source.id}`)
    } else if (action === 'publish' && values.github) {
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
      console.log(
        `${name} -> ${values.github} ${values.branch ?? 'gh-pages'}: ${result.summary}${result.changed && !push ? ' (dry run, not pushed)' : ''}`
      )
    } else if (action === 'publish') {
      const result = await publish_app(root, words[0], {
        url: values.url ?? SYNC_URL,
        site_url: values['site-url'] ?? values.url ?? SYNC_URL
      })
      console.log(result.url)
      for (const source of result.sources) console.log(`  ${source.url}`)
    } else if (action === 'unpublish') {
      if (!/^[a-z0-9-]+$/.test(words[0] ?? ''))
        throw new Error('invalid app name')
      const app = await read_app(join(root, 'apps', words[0]))
      await unpublish_app(app.id, { url: values.url ?? SYNC_URL })
      console.log(`unpublished ${words[0]}`)
    } else if (action === 'list') {
      const apps = join(root, 'apps')
      for (const name of exists_sync(apps) ? await readdir(apps) : []) {
        if (!exists_sync(join(apps, name, 'app.json'))) continue
        const { app, sources } = await app_sources(join(apps, name))
        console.log(
          `${name}  ${app.type}  ${app.id}  ${sources.length} source(s)`
        )
      }
    } else throw new Error('app add|build|list|publish|unpublish')
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
