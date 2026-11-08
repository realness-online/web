import {
  readdir,
  readFile as read_file,
  writeFile as write_file,
  mkdir,
  cp,
  rm
} from 'node:fs/promises'
import { existsSync as exists_sync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { create_images } from './images.js'
import { create_templates } from './templates.js'
import { create_pages } from './pages.js'
import { escape_html } from './text.js'

const markdown_files = async directory => {
  const entries = await readdir(directory, { withFileTypes: true })
  const found = await Promise.all(
    entries.map(entry => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return markdown_files(path)
      return entry.name.endsWith('.md') ? [path] : []
    })
  )
  return found.flat()
}

/** Renderer files a page links only in plans mode. */
const PLANS_ONLY = new Set(['plans.css', 'scripts/plan-covers.js'])

/**
 * Whether a renderer static file belongs in this snapshot: plans files for
 * plans, live reload while watching, and only the poster the site names.
 * @param {string} engine_static
 * @param {{poster?: string, type?: string}} site
 * @param {boolean} watch
 */
const engine_file = (engine_static, site, watch) => path => {
  const file = relative(engine_static, path)
  if (file.startsWith('posters/')) return file === `posters/${site.poster}`
  if (PLANS_ONLY.has(file)) return site.type === 'plans'
  if (file === 'scripts/live-reload.js') return watch
  return true
}

/**
 * Every plan's rendered body, as the last build wrote it into the index. A
 * plan re-render keeps the rest of the index without rebuilding those pages.
 * @param {string} output Build folder.
 * @returns {Promise<Map<string, string>>}
 */
const previous_bodies = async output => {
  const file = join(output, 'index.html')
  if (!exists_sync(file)) return new Map()
  const text = await read_file(file, 'utf8')
  /** @type {Map<string, string>} */
  const bodies = new Map()
  for (const [, itemid, html] of text.matchAll(
    /<article itemid="([^"]+)"[\s\S]*?<template>([\s\S]*?)<\/template>/g
  ))
    if (html && html !== 'undefined') bodies.set(itemid, html)
  return bodies
}

/**
 * One snapshot. The site owns settings; the engine owns the renderer.
 *
 * `only` names the articles to re-render in place, for a save during a large
 * build: those pages are rewritten, the index and sitemap refreshed, and every
 * other page left as built. Nothing else is cleaned or recopied.
 *
 * @param {string} engine Renderer directory.
 * @param {{drafts?: boolean, watch?: boolean, only?: string[]}} [options]
 */
export const build_site = async (
  engine,
  { drafts = false, watch = false, only = [] } = {}
) => {
  const site = JSON.parse(await read_file('site.json', 'utf8'))
  if (site.type && !['blog', 'plans'].includes(site.type))
    throw new Error(`unknown site type: ${site.type}`)
  const output = 'dist'
  const wanted = new Set(only)
  const incremental = wanted.size > 0 && !watch
  if (!incremental) {
    await rm(output, { recursive: true, force: true })
    await mkdir(output, { recursive: true })
  } else if (!exists_sync(output)) throw new Error('no dist to rebuild into')
  if (!incremental) {
    for await (const root of resolve(engine) === resolve('.')
      ? ['.']
      : [engine, '.']) {
      const static_directory = join(root, 'static')
      const partials = join(root, 'partials')
      const filter =
        root === '.' ? () => true : engine_file(static_directory, site, watch)
      if (exists_sync(static_directory))
        await cp(static_directory, output, { recursive: true, filter })
      if (exists_sync(partials))
        await cp(partials, join(output, 'partials'), { recursive: true })
    }
    const header = join(output, 'partials/header.fragment')
    if (exists_sync(header))
      await write_file(
        header,
        (await read_file(header, 'utf8'))
          .replace('>Your Name<', `>${escape_html(site.name ?? '')}<`)
          .replace('>What you do<', `>${escape_html(site.tagline ?? '')}<`)
      )
    await cp(
      new URL(import.meta.resolve('template-for-polyfill')),
      join(output, 'scripts/template-for-polyfill.js')
    )
    if (site.pwa)
      await Promise.all(
        ['register.js', 'profiles.js', 'watch-for-updates.js'].map(name =>
          cp(
            new URL(`../../../../packages/pwa/src/${name}`, import.meta.url),
            join(output, `scripts/${name}`)
          )
        )
      )
  }
  const images = create_images(site.poster)
  await images.load_poster_sizes()
  const templates = create_templates(site, images.poster_sizes, watch)
  const pages = create_pages(site, templates, images, drafts)
  const files = await markdown_files('content/articles')
  await pages.load_groups(files)
  const targets = new Set(files.filter(file => wanted.has(pages.slug_of(file))))
  const built = await Promise.all(
    files.map(file =>
      !incremental || targets.has(file)
        ? pages.build_article(file)
        : pages.load_article(file)
    )
  )
  const previous = incremental ? await previous_bodies(output) : new Map()
  const articles = built.map(article =>
    article.html === undefined && previous.has(article.itemid)
      ? { ...article, html: previous.get(article.itemid) }
      : article
  )
  if (
    incremental &&
    articles.some(article => article.html === undefined && !article.draft)
  )
    throw new Error('no previous page to keep; run a full build')
  const selected_pages = await Promise.all(
    (site.selected_pages ?? []).map(path =>
      read_file(
        join(output, path.slice(1), path.endsWith('/') ? 'index.html' : ''),
        'utf8'
      )
    )
  )
  if (
    [...articles.map(article => article.html ?? ''), ...selected_pages].some(
      html => html.includes('<pre class="mermaid">')
    )
  )
    await cp(
      new URL(import.meta.resolve('pele/global')),
      join(output, 'scripts/pele.global.js')
    )
  await pages.build_index(articles)
  await pages.build_sitemap(articles, await pages.build_pages())
  if (site.pwa && !watch && !incremental) {
    const { build_pwa } = await import('./pwa.js')
    await build_pwa(site)
  }
  if (watch)
    await write_file(join(output, 'build-stamp.txt'), String(Date.now()))
  console.info(
    incremental
      ? `rebuilt ${targets.size} of ${articles.length} articles`
      : `built ${articles.length} articles`
  )
}
