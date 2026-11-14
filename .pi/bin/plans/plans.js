#!/usr/bin/env node
import { execFile as exec_file } from 'node:child_process'
import { existsSync as exists_sync } from 'node:fs'
import { readFile as read_file } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { promisify } from 'node:util'
import { person, plans_ignore, plans_path } from '../lib/harness-settings.js'
import { plan_files } from '../lib/plan-files.js'
import { product_import } from '../lib/product.js'
import { update_commands } from '../harness/commands.js'

const run = promisify(exec_file)
const MAX = 10 * 1024 * 1024
const { mint_item, read_app, scan_vault, write_app } = await product_import('publish/sources')
const { build_app, engine } = await product_import('publish/view')

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
    sources.push({ id, slug: as_slug(slugs.get(id) ?? name), area: area_of(file) })
  }
  await write_app(app_dir, { ...app, sources })
  return sources
}

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

const AREAS = {
  art: 'Art',
  blog: 'Blog',
  music: 'Music',
  planning: 'Planning',
  realness: 'Realness',
  seeq: 'SEEQ',
  scouts: 'Scouts'
}

/**
 * A plan's functional area: its top folder, else the prefix of its filename.
 * @param {string} file plan file relative to the plans folder
 */
export const area_of = file => {
  const key = file.split('/')[0].replace(/\.md$/, '').split('-')[0].toLowerCase()
  return AREAS[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

/** A page address from a note's name: lowercase words joined by dashes. */
export const as_slug = name =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * The vault files an app renders, by page: each source, a folder plan's whole
 * folder, and every note a source links to by a relative `.md` address.
 * @param {string} root Harness root.
 * @param {string} name App name.
 * @returns {Promise<Map<string, { id: string, files: Set<string>, folders: Set<string> }>>} page slug to what it renders
 */
const app_owned = async (root, name) => {
  const app_dir = join(root, 'apps', name)
  const app = await read_app(app_dir)
  const vault = resolve(app_dir, app.vault)
  const scan = await scan_vault(vault)
  const owned = new Map()
  for (const { id, slug } of app.sources) {
    const path = scan.items.get(id)
    if (!path) continue
    const files = new Set([path])
    const folders = new Set()
    if (path.endsWith('/index.md')) folders.add(path.slice(0, -'/index.md'.length))
    if (path.endsWith('.md')) {
      const file = join(vault, path)
      for (const [, href] of (await read_file(file, 'utf8')).matchAll(/\]\(([^"#?:]+\.md)\)/g)) {
        const target = relative(vault, resolve(dirname(file), decodeURIComponent(href)))
        if (!target.startsWith('..')) files.add(target)
      }
    }
    owned.set(slug, { id, files, folders })
  }
  return owned
}

/**
 * The pages a set of changed vault files reaches.
 * @param {Map<string, { id: string, files: Set<string>, folders: Set<string> }>} owned page slug to what it renders
 * @param {string[]} changed vault-relative files
 * @returns {{ slug: string, id: string }[]}
 */
export const changed_pages = (owned, changed) =>
  [...owned]
    .filter(([, page]) =>
      changed.some(file => page.files.has(file) || [...page.folders].some(folder => file.startsWith(`${folder}/`)))
    )
    .map(([slug, page]) => ({ slug, id: page.id }))

const commands_page = root => join(root, 'vault/Areas/Realness/pages/commands.html')

/** Both apps, and the commands page, from scratch. */
const build_all = async root => {
  await update_commands(root, { page: commands_page(root) })
  const sources = await select_plans(root)
  await select_blog(root)
  const { dist } = await build_app(root, 'plans')
  console.log(`${sources.length} plans -> ${relative(root, dist)}`)
  const blog = await build_app(root, 'blog', { drafts: true })
  console.log(`blog with drafts -> ${relative(root, blog.dist)}`)
}

/**
 * Re-render named pages in the plans app's existing build tree, keeping the
 * rest of `dist/` as built.
 * @param {string} root Harness root.
 * @param {string[]} slugs page addresses to render
 */
const rebuild_pages = async (root, slugs) => {
  const renderer = await engine(root)
  await run(process.execPath, [join(renderer, 'build.js'), ...slugs.map(slug => `--only=${slug}`)], {
    cwd: join(root, 'artifacts/apps/plans'),
    timeout: 120_000,
    maxBuffer: MAX
  })
  console.log(`rebuilt ${slugs.join(', ')}`)
}

/**
 * Build what a save reached: those plans re-render in place. A new or dropped
 * plan, or any file the blog renders, rebuilds both apps whole.
 * @param {string} root Harness root.
 * @param {string[]} changed vault-relative files; none means everything
 */
/**
 * What a save needs: everything, those plan pages, or nothing. A blog page
 * rebuilds everything even when no plan changed.
 * @param {{ sources_unchanged: boolean, plan_pages: { id: string }[], blog_pages: unknown[], built: (id: string) => boolean }} state
 * @returns {'all' | 'pages' | 'none'}
 */
export const build_choice = ({ sources_unchanged, plan_pages, blog_pages, built }) => {
  if (!sources_unchanged || blog_pages.length) return 'all'
  if (!plan_pages.length) return 'none'
  return plan_pages.every(({ id }) => built(id)) ? 'pages' : 'all'
}

export const build_vault = async (root, changed = []) => {
  if (!changed.length) return build_all(root)
  const same = (before, after) => before.length === after.length && before.every(({ id }, i) => id === after[i].id)
  const plans_before = (await read_app(join(root, 'apps/plans'))).sources
  const blog_before = (await read_app(join(root, 'apps/blog'))).sources
  const ids = new Set((await select_plans(root)).map(({ id }) => id))
  const blog_after = await select_blog(root)
  const plan_pages = changed_pages(await app_owned(root, 'plans'), changed)
  const dist = join(root, 'artifacts/apps/plans/dist')
  const choice = build_choice({
    sources_unchanged:
      plans_before.length === ids.size && plans_before.every(({ id }) => ids.has(id)) && same(blog_before, blog_after),
    plan_pages,
    blog_pages: changed_pages(await app_owned(root, 'blog'), changed),
    built: id => exists_sync(join(dist, id.slice(1), 'index.html'))
  })
  if (choice === 'all') return build_all(root)
  if (choice === 'none') return
  await rebuild_pages(
    root,
    plan_pages.map(({ slug }) => slug)
  )
}

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const root = resolve(dirname(file_url_to_path(import.meta.url)), '../../..')
  const flag = '--changed='
  const changed = process.argv
    .slice(2)
    .filter(arg => arg.startsWith(flag))
    .map(arg => arg.slice(flag.length))
  await build_vault(root, changed)
}
