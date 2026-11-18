#!/usr/bin/env node
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { product_import } from '../lib/product.js'
import { update_commands } from '../harness/commands.js'

const { read_app, scan_vault, write_app } = await product_import('publish/sources')
const { build_app } = await product_import('publish/view')

/** A page address from a note's name: lowercase words joined by dashes. */
const as_slug = name =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * The blog app's selection: every article note under `Areas/Blog/`, by itemid.
 * Known articles keep their slug and order; new ones take their filename.
 * @param {string} root Harness root.
 */
export const select_blog = async root => {
  const app_dir = join(root, 'apps/blog')
  const app = await read_app(app_dir)
  const { items } = await scan_vault(resolve(app_dir, app.vault))
  const articles = [...items].filter(
    ([id, path]) => id.includes('/articles/') && path.startsWith('Areas/Blog/') && path.endsWith('.md')
  )
  const found = new Map(articles)
  const kept = app.sources.filter(({ id }) => found.has(id))
  const known = new Set(kept.map(({ id }) => id))
  const added = articles
    .filter(([id]) => !known.has(id))
    .map(([id, path]) => ({ id, slug: as_slug(path.split('/').pop().replace(/\.md$/, '')) }))
  const sources = [...kept, ...added]
  await write_app(app_dir, { ...app, sources })
  return sources
}

/**
 * The commands page and the blog, from scratch.
 * @param {string} root Harness root.
 */
export const build_vault = async root => {
  await update_commands(root, { page: join(root, 'vault/Areas/Realness/pages/commands.html') })
  await select_blog(root)
  const blog = await build_app(root, 'blog', { drafts: true })
  console.log(`blog with drafts -> ${relative(root, blog.dist)}`)
}

if (process.argv[1] === file_url_to_path(import.meta.url))
  await build_vault(resolve(dirname(file_url_to_path(import.meta.url)), '../../..'))
