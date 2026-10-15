#!/usr/bin/env node
import { readdir } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { person, plans_ignore, plans_path } from './lib/harness-settings.js'
import { product_import } from './lib/product.js'
import { update_commands } from './commands.js'

const { mint_item, read_app, scan_vault, write_app } = await product_import('publish/sources')
const { build_app } = await product_import('publish/view')

/**
 * The plans app's selection, refreshed from the plans folder.
 * @param {string} root Harness root.
 */
export const select_plans = async (root) => {
  const app_dir = join(root, 'apps/plans')
  const app = await read_app(app_dir)
  const vault = resolve(app_dir, app.vault)
  const folder = join(root, plans_path(root))
  const inside = relative(vault, folder)
  if (inside.startsWith('..')) throw new Error(`plans folder is outside the vault: ${folder}`)
  const ignored = new Set(plans_ignore(root))
  const slugs = new Map(app.sources.map(({ id, slug }) => [id, slug]))
  const sources = []
  const scan = await scan_vault(vault)
  for (const file of (await readdir(folder)).filter(name => name.endsWith('.md') && !ignored.has(name)).sort()) {
    const path = inside ? `${inside}/${file}` : file
    const id = await mint_item(vault, path, { author: person(root), type: 'plans', scan })
    sources.push({ id, slug: slugs.get(id) ?? basename(file, '.md') })
  }
  await write_app(app_dir, { ...app, sources })
  return sources
}

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const root = resolve(dirname(file_url_to_path(import.meta.url)), '..')
  await update_commands(root, { page: join(root, 'vault/Areas/Realness/pages/commands.html') })
  const sources = await select_plans(root)
  const { dist } = await build_app(root, 'plans')
  console.log(`${sources.length} plans -> ${relative(root, dist)}`)
}
