#!/usr/bin/env node
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { person, plans_ignore, plans_path } from '../lib/harness-settings.js'
import { plan_files } from '../lib/plan-files.js'
import { product_import } from '../lib/product.js'
import { update_commands } from '../harness/commands.js'

const { mint_item, read_app, scan_vault, write_app } = await product_import('publish/sources')
const { build_app } = await product_import('publish/view')

/**
 * The plans app's selection, refreshed from the plans folder.
 * @param {string} root Harness root.
 */
export const select_plans = async root => {
  const app_dir = join(root, 'apps/plans')
  const app = await read_app(app_dir)
  const vault = resolve(app_dir, app.vault)
  const folder = join(root, plans_path(root))
  const inside = relative(vault, folder)
  if (inside.startsWith('..')) throw new Error(`plans folder is outside the vault: ${folder}`)
  const slugs = new Map(app.sources.map(({ id, slug }) => [id, slug]))
  const sources = []
  const scan = await scan_vault(vault)
  for (const { file, name } of plan_files(folder, plans_ignore(root))) {
    const path = inside ? `${inside}/${file}` : file
    const id = await mint_item(vault, path, { author: person(root), type: 'plans', scan })
    sources.push({ id, slug: as_slug(slugs.get(id) ?? name) })
  }
  await write_app(app_dir, { ...app, sources })
  return sources
}

/** A page address from a note's name: lowercase words joined by dashes. */
export const as_slug = name =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const root = resolve(dirname(file_url_to_path(import.meta.url)), '../../..')
  await update_commands(root, { page: join(root, 'vault/Areas/Realness/pages/commands.html') })
  const sources = await select_plans(root)
  const { dist } = await build_app(root, 'plans')
  console.log(`${sources.length} plans -> ${relative(root, dist)}`)
  const blog = await build_app(root, 'blog', { drafts: true })
  console.log(`blog with drafts -> ${relative(root, blog.dist)}`)
}
