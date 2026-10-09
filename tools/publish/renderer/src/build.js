import { readdir, readFile as read_file, writeFile as write_file, mkdir, cp, rm } from 'node:fs/promises'
import { existsSync as exists_sync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { create_images } from './images.js'
import { create_templates } from './templates.js'
import { create_pages } from './pages.js'
import { escape_html } from './text.js'

const markdown_files = async (directory) => {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await markdown_files(path))
    else if (entry.name.endsWith('.md')) files.push(path)
  }
  return files
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
const engine_file = (engine_static, site, watch) => (path) => {
  const file = relative(engine_static, path)
  if (file.startsWith('posters/')) return file === `posters/${site.poster}`
  if (PLANS_ONLY.has(file)) return site.type === 'plans'
  if (file === 'scripts/live-reload.js') return watch
  return true
}

/**
 * One clean snapshot. The site owns settings; the engine owns the renderer.
 * @param {string} engine Renderer directory.
 * @param {{drafts?: boolean, watch?: boolean}} [options]
 */
export const build_site = async (engine, { drafts = false, watch = false } = {}) => {
  const site = JSON.parse(await read_file('site.json', 'utf8'))
  if (site.type && !['blog', 'plans'].includes(site.type)) throw new Error(`unknown site type: ${site.type}`)
  const output = 'dist'
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  for (const root of resolve(engine) === resolve('.') ? ['.'] : [engine, '.']) {
    const static_directory = join(root, 'static')
    const partials = join(root, 'partials')
    const filter = root === '.' ? () => true : engine_file(static_directory, site, watch)
    if (exists_sync(static_directory)) await cp(static_directory, output, { recursive: true, filter })
    if (exists_sync(partials)) await cp(partials, join(output, 'partials'), { recursive: true })
  }
  // The renderer's own header is a placeholder; a site's name and tagline fill it.
  const header = join(output, 'partials/header.fragment')
  if (exists_sync(header)) await write_file(header, (await read_file(header, 'utf8'))
    .replace('>Your Name<', `>${escape_html(site.name ?? '')}<`)
    .replace('>What you do<', `>${escape_html(site.tagline ?? '')}<`))
  await cp(new URL(import.meta.resolve('template-for-polyfill')), join(output, 'scripts/template-for-polyfill.js'))
  const images = create_images(site.poster)
  await images.load_poster_sizes()
  const templates = create_templates(site, images.poster_sizes, watch)
  const pages = create_pages(site, templates, images, drafts)
  const files = await markdown_files('content/articles')
  await pages.load_groups(files)
  const articles = await Promise.all(files.map(pages.build_article))
  const selected_pages = await Promise.all((site.selected_pages ?? []).map(path =>
    read_file(join(output, path.slice(1), path.endsWith('/') ? 'index.html' : ''), 'utf8')))
  if ([...articles.map(article => article.html ?? ''), ...selected_pages].some(html => html.includes('<pre class="mermaid">')))
    await cp(new URL(import.meta.resolve('mermaid/dist/mermaid.min.js')), join(output, 'scripts/mermaid.min.js'))
  await pages.build_index(articles)
  await pages.build_sitemap(articles, await pages.build_pages())
  if (site.pwa && !watch) {
    const { build_pwa } = await import('./pwa.js')
    await build_pwa(site)
  }
  if (watch) await write_file(join(output, 'build-stamp.txt'), String(Date.now()))
  console.log(`built ${articles.length} articles`)
}
