import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  apply_page_meta,
  inject_app_html,
  prerender_dir_for_route
} from './prerender-html.js'
import { prerender_pages, site_origin } from '../src/prerender/pages.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const project_root = path.join(__dirname, '..')
const dist_dir = path.join(project_root, 'dist')
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
const { render } = await import(pathToFileURL(server_entry).href)

await Promise.all(
  prerender_pages.map(async page => {
    const render_path = page.render_path ?? page.path
    const canonical = page.canonical ?? page.path
    const app_html = await render(render_path)
    const dir = path.join(dist_dir, prerender_dir_for_route(page.path))
    fs.mkdirSync(dir, { recursive: true })

    let html = inject_app_html(template, app_html)
    html = apply_page_meta(html, {
      title: page.title,
      description: page.description,
      og_title: page.og_title,
      og_url: `${site_origin}${page.path}`,
      canonical: `${site_origin}${canonical}`
    })

    const out_path = path.join(dir, 'index.html')
    fs.writeFileSync(out_path, html)
    console.info(`prerender: wrote ${out_path}`)
  })
)
