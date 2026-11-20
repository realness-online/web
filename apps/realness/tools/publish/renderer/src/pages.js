import { render } from '@comark/html'
import { parse } from 'comark'
import {
  readdir,
  readFile as read_file,
  realpath,
  writeFile as write_file,
  mkdir,
  stat
} from 'node:fs/promises'
import { existsSync as exists_sync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { highlight, plate, footnote, strip_tags } from './markdown.js'
import { title_case } from './text.js'
import { LEADING_H1, render_article, title_of } from './render.js'

/** Search results show about this many characters of a description. */
const DESCRIPTION_CHARS = 160

/** Notes a plan links by a relative `.md` address inside its own folder. */
const linked_notes = async (file, html) => {
  const folder = dirname(await realpath(file))
  const raws = new Set(
    [...html.matchAll(/href="([^":?#]+\.md)"/g)].map(([, raw]) => raw)
  )
  return [...raws]
    .map(raw => ({ raw, href: decodeURIComponent(raw) }))
    .filter(
      ({ href }) => !href.startsWith('/') && !href.split('/').includes('..')
    )
    .map(({ raw, href }) => ({ raw, href, note: join(folder, href) }))
    .filter(({ note }) => exists_sync(note))
}

/** The page address of a plan's note: under the plan's itemid, without `.md`. */
const note_url = (itemid, href) =>
  `${itemid}/${href.replace(/\.md$/, '').split('/').map(encodeURIComponent).join('/')}`

/** A plan's note links pointed at their rendered pages. */
const link_notes = (html, itemid, notes) =>
  notes.reduce(
    (linked, { raw, href }) =>
      linked.replaceAll(`href="${raw}"`, `href="${note_url(itemid, href)}"`),
    html
  )

/**
 * A plan's links to its own notes, `Leads/2026-11-05.md`: each renders as a
 * page under the plan's itemid, at the address the link already names.
 * @param {{ notes: { raw: string, href: string, note: string }[], itemid: string }} plan
 * @param {{ shell: Function, article_body: Function, write_route: (route: string, page: string) => Promise<void> }} tools
 */
const build_linked = async (
  { notes, itemid },
  { shell, article_body, write_route }
) => {
  await Promise.all(
    notes.map(async ({ href, note }) => {
      const body = await render(await read_file(note, 'utf8'))
      const heading = body.match(LEADING_H1)
      const title = heading
        ? strip_tags(heading[1])
        : title_case((href.split('/').pop() ?? href).replace(/\.md$/, ''))
      const page = footnote(
        plate(await highlight(heading ? body.replace(LEADING_H1, '') : body))
      )
      const url = note_url(itemid, href)
      await write_route(
        url,
        shell(title, article_body({}, title, page.html, page.notes), {
          url,
          description: strip_tags(page.html).slice(0, DESCRIPTION_CHARS).trim(),
          type: 'article'
        })
      )
    })
  )
}

/** A page's draft flag, from front matter written either way. */
const is_draft = data => data.draft === true || data.draft === 'true'

/** The slug a file's page is built at, without a leading year folder. */
const article_slug = (file, directory) => {
  const parts = relative(directory, file).replace(/\.md$/, '').split('/')
  if (/^\d{4}$/.test(parts[0])) return parts.slice(1).join('/')
  return parts.join('/')
}

const path_of = href => href.replace(/\/+$/, '') || '/'

/** @param {import('./types.js').Article} article */
const created_at = article => new Date(article.created ?? 0).getTime() || 0

/** The pages a build writes, newest first: plans by creation, articles by date. */
const published_articles = (articles, drafts, plans) =>
  articles
    .filter(article => drafts || !article.draft)
    .sort((a, b) =>
      plans
        ? created_at(b) - created_at(a)
        : (b.date || '').localeCompare(a.date || '')
    )

/**
 * Write a route as `<route>.html`: hosts serve `/blog/x` from it with no
 * redirect, so the canonical URL is the URL served.
 * @param {string} output_directory
 * @param {string} route like `/blog/x`
 * @param {string} page
 */
const write_route = async (output_directory, route, page) => {
  const file = join(output_directory, `${route.slice(1)}.html`)
  await mkdir(dirname(file), { recursive: true })
  await write_file(file, page)
}

/**
 * @param {import('./types.js').Site} site
 * @param {import('./templates.js').Templates} templates
 * @param {import('./images.js').Images} images
 * @param {boolean} drafts
 */
const pages_context = (site, templates, images, drafts) => ({
  site,
  templates,
  images,
  drafts,
  plans: site.type === 'plans',
  groups: new Map(),
  articles_directory: 'content/articles',
  pages_directory: 'pages',
  output_directory: 'dist'
})

/**
 * Read every plan's front matter `related` before any page renders, so each
 * page in a group knows the group.
 * @param {ReturnType<typeof pages_context>} ctx
 * @param {string[]} files
 */
const load_groups = async (ctx, files) => {
  const read = await Promise.all(
    files.map(async file => {
      const src = await read_file(file, 'utf8')
      return { file, src, data: (await parse(src)).frontmatter }
    })
  )
  for (const { file, src, data } of read) {
    const links = (Array.isArray(data.related) ? data.related : []).filter(
      l => l?.title && l?.href
    )
    if (!links.length) continue
    const heading = src.match(/^# (.+)$/m)
    const slug = article_slug(file, ctx.articles_directory)
    const owner = {
      title: title_of(data, heading?.[1], slug),
      href: `/blog/${slug}`
    }
    const group = [owner, ...links]
    for (const { href } of group)
      if (!ctx.groups.has(path_of(href))) ctx.groups.set(path_of(href), group)
  }
}

/**
 * A page's listing metadata without rendering its body: what the index,
 * sitemap, and group navigation need from a page this build leaves alone.
 * @param {ReturnType<typeof pages_context>} ctx
 * @param {string} file
 * @returns {Promise<import('./types.js').Article>}
 */
const load_article = async (ctx, file) => {
  const src = await read_file(file, 'utf8')
  const { frontmatter: data } = await parse(src)
  const slug = article_slug(file, ctx.articles_directory)
  const heading = src.match(/^# (.+)$/m)?.[1]
  const title = title_of(
    data,
    heading ? strip_tags(await render(heading)) : null,
    slug
  )
  const draft = is_draft(data)
  if (draft && !ctx.drafts) return { slug, title, date: data.date, draft }
  return {
    slug,
    title,
    itemid: data.itemid,
    date: data.date,
    img: data.img,
    focus: data.focus,
    draft,
    created: data.created,
    updated: (await stat(file)).mtimeMs
  }
}

/**
 * Render one article, write it at its own address and its itemid's, and
 * render a plan's linked notes beside it.
 * @param {ReturnType<typeof pages_context>} ctx
 * @param {string} file
 */
const build_article = async (ctx, file) => {
  const { shell, article_body } = ctx.templates
  const { raster_og_image } = ctx.images
  const src = await read_file(file, 'utf8')
  const slug = article_slug(file, ctx.articles_directory)
  const rendered = await render_article(src, slug)
  const { data, title, notes } = rendered
  const draft = is_draft(data)
  if (draft && !ctx.drafts) return { slug, title, date: data.date, draft }
  if (data.itemid && !/^\/\+\d+\/[a-z][a-z-]*\/\d+$/.test(data.itemid))
    throw new Error(`unsafe itemid: ${data.itemid}`)
  const linked =
    ctx.plans && data.itemid ? await linked_notes(file, rendered.html) : []
  const html = link_notes(rendered.html, data.itemid, linked)
  const article = article_body(data, title, html, notes, {
    related: ctx.templates.related_nav(
      ctx.groups.get(`/blog/${slug}`),
      `/blog/${slug}`
    )
  })
  const description =
    data.description || strip_tags(html).slice(0, DESCRIPTION_CHARS).trim()
  const og_image_path = await raster_og_image(data.img)
  const page = shell(title, article, {
    url: `/blog/${slug}`,
    og_image_path,
    description,
    type: 'article',
    layout: data.layout
  })
  await write_route(ctx.output_directory, `/blog/${slug}`, page)
  if (data.itemid) {
    const item_directory = join(ctx.output_directory, data.itemid.slice(1))
    await mkdir(item_directory, { recursive: true })
    await write_file(join(item_directory, 'index.html'), page)
    if (ctx.plans)
      await build_linked(
        { notes: linked, itemid: data.itemid },
        {
          shell,
          article_body,
          write_route: (route, linked_page) =>
            write_route(ctx.output_directory, route, linked_page)
        }
      )
  }
  return {
    slug,
    title,
    itemid: data.itemid,
    date: data.date,
    img: data.img,
    focus: data.focus,
    draft,
    html,
    notes,
    created: data.created,
    updated: (await stat(file)).mtimeMs
  }
}

/**
 * @param {ReturnType<typeof pages_context>} ctx
 * @param {import('./types.js').Article[]} articles
 */
const build_index = async (ctx, articles) => {
  const { shell, index_body } = ctx.templates
  const published = published_articles(articles, ctx.drafts, ctx.plans)
  const latest = published.find(article => article.img)
  const og_image_path = await ctx.images.raster_og_image(latest?.img)
  await write_file(
    join(ctx.output_directory, 'index.html'),
    shell(ctx.site.name, index_body(published), {
      root: true,
      url: '/',
      og_image_path
    })
  )
}

/**
 * @param {ReturnType<typeof pages_context>} ctx
 */
const build_pages = async ctx => {
  const { shell, related_nav } = ctx.templates
  if (!exists_sync(ctx.pages_directory)) return []
  const names = (await readdir(ctx.pages_directory))
    .filter(file => file.endsWith('.html'))
    .map(file => file.slice(0, -'.html'.length))
  const og_image_path = await ctx.images.raster_og_image()
  await Promise.all(
    names.map(async name => {
      const meta = ctx.site.pages?.[name] || {}
      const body =
        related_nav(ctx.groups.get(`/${name}`), `/${name}`) +
        (await read_file(join(ctx.pages_directory, `${name}.html`), 'utf8'))
      await write_route(
        ctx.output_directory,
        `/${name}`,
        shell(meta.title || title_case(name.replace(/-/g, ' ')), body, {
          url: `/${name}`,
          og_image_path,
          description: meta.description,
          type: meta.type
        })
      )
    })
  )
  return names
}

/**
 * @param {ReturnType<typeof pages_context>} ctx
 * @param {import('./types.js').Article[]} articles
 * @param {string[]} pages
 */
const build_sitemap = async (ctx, articles, pages) => {
  const published = published_articles(articles, ctx.drafts, ctx.plans)
  const urls = [
    { loc: '/', lastmod: published[0]?.date },
    ...pages.map(name => ({ loc: `/${name}` })),
    ...(ctx.site.selected_pages ?? []).map(loc => ({ loc })),
    ...published.map(article => ({
      loc: `/blog/${article.slug}`,
      lastmod: article.date
    }))
  ]
  await write_file(
    join(ctx.output_directory, 'sitemap.xml'),
    ctx.templates.sitemap(urls)
  )
  await write_file(
    join(ctx.output_directory, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${ctx.site.url}/sitemap.xml\n`
  )
}

/**
 * @param {import('./types.js').Site} site
 * @param {import('./templates.js').Templates} templates
 * @param {import('./images.js').Images} images
 * @param {boolean} [drafts=false]
 */
export const create_pages = (site, templates, images, drafts = false) => {
  const ctx = pages_context(site, templates, images, drafts)
  return {
    load_groups: files => load_groups(ctx, files),
    slug_of: file => article_slug(file, ctx.articles_directory),
    load_article: file => load_article(ctx, file),
    build_article: file => build_article(ctx, file),
    build_index: articles => build_index(ctx, articles),
    build_pages: () => build_pages(ctx),
    build_sitemap: (articles, pages) => build_sitemap(ctx, articles, pages)
  }
}
