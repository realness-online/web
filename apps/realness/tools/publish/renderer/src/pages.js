import { render } from '@comark/html'
import { parse } from 'comark'
import { readdir, readFile as read_file, writeFile as write_file, mkdir, stat } from 'node:fs/promises'
import { existsSync as exists_sync } from 'node:fs'
import { join, relative } from 'node:path'
import { highlight, plate, footnote, strip_tags } from './markdown.js'
import { title_case } from './text.js'

/**
 * @param {import('./types.js').Site} site
 * @param {import('./templates.js').Templates} templates
 * @param {import('./images.js').Images} images
 * @param {boolean} [drafts=false]
 */
export const create_pages = (site, templates, images, drafts = false) => {
  const { shell, article_body, index_body, sitemap, related_nav } = templates
  const { raster_og_image } = images
  const plans = site.type === 'plans'
  const articles_directory = 'content/articles'
  const pages_directory = 'pages'
  const output_directory = 'dist'
  const leading_h1 = /^\s*<h1[^>]*>([\s\S]*?)<\/h1>/

  const article_slug = (file) => {
    const parts = relative(articles_directory, file).replace(/\.md$/, '').split('/')
    if (/^\d{4}$/.test(parts[0])) return parts.slice(1).join('/')
    return parts.join('/')
  }

  const path_of = (href) => href.replace(/\/+$/, '') || '/'
  /** @type {Map<string, {title: string, href: string}[]>} page path to its group */
  const groups = new Map()

  return {
    /**
     * Read every plan's front matter `related` before any page renders, so
     * each page in a group knows the group.
     * @param {string[]} files
     */
    async load_groups(files) {
      for (const file of files) {
        const src = await read_file(file, 'utf8')
        const { frontmatter: data } = await parse(src)
        const links = (Array.isArray(data.related) ? data.related : []).filter(l => l?.title && l?.href)
        if (!links.length) continue
        const heading = src.match(/^# (.+)$/m)
        const slug = article_slug(file)
        const owner = { title: data.title || heading?.[1] || title_case(slug.replace(/-/g, ' ')), href: `/blog/${slug}` }
        const group = [owner, ...links]
        for (const { href } of group) if (!groups.has(path_of(href))) groups.set(path_of(href), group)
      }
    },

    /** @param {string} file */
    async build_article(file) {
      const src = await read_file(file, 'utf8')
      const { frontmatter: data } = await parse(src)
      const slug = article_slug(file)
      let body = await render(src)
      const heading = !data.title && body.match(leading_h1)
      if (heading) body = body.replace(leading_h1, '')
      const title = data.title ? title_case(data.title)
        : heading ? strip_tags(heading[1])
        : title_case(slug.split('/').pop().replace(/-/g, ' '))
      const draft = data.draft === true || data.draft === 'true'
      if (draft && !drafts) return { slug, title, date: data.date, draft }
      const { html, notes } = footnote(plate(await highlight(body)))
      const article = article_body(data, title, html, notes, related_nav(groups.get(`/blog/${slug}`), `/blog/${slug}`))
      await mkdir(join(output_directory, 'blog', slug), { recursive: true })
      const description = data.description || strip_tags(html).slice(0, 160).trim()
      const og_image_path = await raster_og_image(data.img)
      const page = shell(title, article, { url: `/blog/${slug}`, og_image_path, description, type: 'article' })
      await write_file(join(output_directory, 'blog', slug, 'index.html'), page)
      if (data.itemid) {
        if (!/^\/\+\d+\/[a-z][a-z-]*\/\d+$/.test(data.itemid)) throw new Error(`unsafe itemid: ${data.itemid}`)
        const item_directory = join(output_directory, data.itemid.slice(1))
        await mkdir(item_directory, { recursive: true })
        await write_file(join(item_directory, 'index.html'), page)
      }
      return { slug, title, itemid: data.itemid, date: data.date, img: data.img, focus: data.focus, draft, html, notes, updated: (await stat(file)).mtimeMs }
    },

    /** @param {import('./types.js').Article[]} articles */
    async build_index(articles) {
      const published = articles
        .filter(a => drafts || !a.draft)
        .sort((a, b) => plans ? b.updated - a.updated : (b.date || '').localeCompare(a.date || ''))
      const latest = published.find(a => a.img)
      const og_image_path = await raster_og_image(latest?.img)
      await write_file(join(output_directory, 'index.html'),
        shell(site.name, index_body(published), { root: true, url: '/', og_image_path }))
    },

    async build_pages() {
      if (!exists_sync(pages_directory)) return []
      const names = (await readdir(pages_directory)).filter(f => f.endsWith('.html')).map(f => f.slice(0, -5))
      const og_image_path = await raster_og_image()
      for (const name of names) {
        const meta = site.pages?.[name] || {}
        const body = related_nav(groups.get(`/${name}`), `/${name}`) + await read_file(join(pages_directory, `${name}.html`), 'utf8')
        await mkdir(join(output_directory, name), { recursive: true })
        await write_file(join(output_directory, name, 'index.html'), shell(meta.title || title_case(name.replace(/-/g, ' ')), body, {
          url: `/${name}`,
          og_image_path,
          description: meta.description,
          type: meta.type
        }))
      }
      return names
    },

    /**
     * @param {import('./types.js').Article[]} articles
     * @param {string[]} pages
     */
    async build_sitemap(articles, pages) {
      const published = articles
        .filter(a => drafts || !a.draft)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      const urls = [
        { loc: '/', lastmod: published[0]?.date },
        ...pages.map(name => ({ loc: `/${name}` })),
        ...(site.selected_pages ?? []).map(loc => ({ loc })),
        ...published.map(a => ({ loc: `/blog/${a.slug}`, lastmod: a.date }))
      ]
      const xml = sitemap(urls)
      await write_file(join(output_directory, 'sitemap.xml'), xml)
      await write_file(join(output_directory, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`)
    },
  }
}
