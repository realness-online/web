import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL as path_to_file_url } from 'node:url'
import {
  apply_page_meta,
  build_sitemap_xml,
  inject_app_html,
  inject_json_ld,
  prerender_dir_for_route
} from './prerender-html.js'
import {
  default_og_image,
  og_image_alt,
  og_image_type,
  prerender_pages,
  site_name,
  site_origin
} from '../../src/app/prerender/pages.js'
import { software_application_schema } from '../../src/app/prerender/schema.js'
import { fetch_print_pages } from './print-pages.js'
import { product_paths } from '#root/src/settings/layout.js'
import { frontend_out } from '#root/src/settings/output.js'

/** The site-wide OG image's own size, which is what the shell declares. */
const DEFAULT_OG_IMAGE_WIDTH = 1280
const DEFAULT_OG_IMAGE_HEIGHT = 960

/** @type {Record<string, (page: { description: string, url: string }) => Record<string, unknown>>} */
const json_ld_builders = {
  software_application: software_application_schema
}

const ISO_DATE_LENGTH = 10
const dist_dir = frontend_out()
const server_entry = path.join(dist_dir, 'server', 'entry-server.js')
const template_path = path.join(dist_dir, 'index.html')

if (!fs.existsSync(template_path)) {
  console.error('prerender: dist/index.html missing — run vp build first')
  process.exit(1)
}

if (!fs.existsSync(server_entry)) {
  console.error(
    'prerender: dist/server/entry-server.js missing — run build:prerender-ssr first'
  )
  process.exit(1)
}

const template = fs.readFileSync(template_path, 'utf8')
const { render } = await import(path_to_file_url(server_entry).href)

const print_pages = await fetch_print_pages(
  process.env.PRINTS_LIST_URL ?? `${site_origin}/prints-list`
)
const pages = [...prerender_pages, ...print_pages]

await Promise.all(
  pages.map(async page => {
    const render_path = page.render_path ?? page.path
    const canonical = page.canonical ?? page.path
    const app_html = await render(render_path)
    const dir = path.join(dist_dir, prerender_dir_for_route(page.path))
    fs.mkdirSync(dir, { recursive: true })

    let html = inject_app_html(template, app_html)
    const og_image = page.og_image ?? default_og_image
    const own_image = Boolean(page.og_image)
    html = apply_page_meta(html, {
      title: page.title,
      description: page.description,
      robots: 'index, follow',
      og_title: page.og_title,
      og_description: page.description,
      og_url: `${site_origin}${page.path}`,
      og_image,
      og_image_alt: own_image ? page.og_image_alt : og_image_alt,
      og_image_type: own_image ? page.og_image_type : og_image_type,
      og_image_width: own_image ? null : DEFAULT_OG_IMAGE_WIDTH,
      og_image_height: own_image ? null : DEFAULT_OG_IMAGE_HEIGHT,
      og_site_name: site_name,
      twitter_title: page.og_title,
      twitter_description: page.description,
      twitter_image: og_image,
      twitter_image_alt: own_image ? page.og_image_alt : og_image_alt,
      canonical: `${site_origin}${canonical}`
    })

    if (page.json_ld) {
      const builder =
        typeof page.json_ld === 'function'
          ? page.json_ld
          : json_ld_builders[page.json_ld]
      if (builder)
        html = inject_json_ld(
          html,
          builder({
            description: page.description,
            url: `${site_origin}${page.path}`
          })
        )
    }

    const out_path = path.join(dir, 'index.html')
    fs.writeFileSync(out_path, html)
    console.info(`prerender: wrote ${out_path}`)
  })
)

const sitemap_lastmod = new Date().toISOString().slice(0, ISO_DATE_LENGTH)
const sitemap = build_sitemap_xml({
  site_origin,
  pages,
  lastmod: sitemap_lastmod,
  extra_urls: ['/', '/documentation.md']
})
fs.writeFileSync(path.join(dist_dir, 'sitemap.xml'), sitemap)
console.info(`prerender: wrote ${path.join(dist_dir, 'sitemap.xml')}`)

const documentation_md = path.join(
  product_paths().app,
  'content/documentation.md'
)
const documentation_out = path.join(dist_dir, 'documentation.md')
fs.copyFileSync(documentation_md, documentation_out)
console.info(`prerender: wrote ${documentation_out}`)
