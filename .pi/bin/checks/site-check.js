import {
  existsSync as exists,
  readFileSync as read_file,
  readdirSync as readdir,
  realpathSync as realpath,
  statSync as stat
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { parse_html } from '../lib/harness-dependencies.js'
import { check_worker, navigation_offline, precached } from './pwa-worker.js'
import { create_itemid } from '../../../apps/realness/packages/itemid/src/index.js'

const style_root = new URL('../../../apps/realness/src/app/style/', import.meta.url)
const without_comments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '')
/** Search engines' ownership files must stay exactly as issued. */
const SEARCH_VERIFICATION = /^google[0-9a-f]+\.html$/

/** Check shipped HTML and local assets. This does not execute CSS or a worker. */
export const check_site = (directory, { worker = 'service.worker.js' } = {}) => {
  const root = realpath(directory)
  const hits = []
  const report = (file, rule, text) => hits.push({ file: relative(root, file), rule, text })
  const local_file = (href, owner) => {
    const url = new URL(href, `https://site.invalid/${relative(root, owner)}`)
    if (url.origin !== 'https://site.invalid') throw new Error(`asset must be local: ${href}`)
    const file = realpath(join(root, decodeURIComponent(url.pathname).slice(1)))
    const path = relative(root, file)
    if (path.startsWith('..') || path === '') throw new Error(`asset leaves site: ${href}`)
    return file
  }
  const asset = (href, owner, rule) => {
    try {
      return local_file(href, owner)
    } catch (error) {
      report(owner, rule, error.message)
      return null
    }
  }
  const local_file_or_null = (href, owner) => {
    try {
      return local_file(href, owner)
    } catch {
      return null
    }
  }
  const pages = []
  const html_files = []
  const walk = dir => {
    for (const entry of readdir(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (entry.isFile() && entry.name.endsWith('.html') && !SEARCH_VERIFICATION.test(entry.name))
        html_files.push(file)
    }
  }
  walk(root)
  if (!html_files.length) report(join(root, 'index.html'), 'site-html', 'no built HTML pages')

  /** The file a host serves for a URL path with no redirect, or null. */
  const served = pathname => {
    const path = join(root, decodeURIComponent(pathname).slice(1))
    if (pathname.endsWith('/')) return exists(join(path, 'index.html')) ? join(path, 'index.html') : null
    if (exists(path) && stat(path).isFile()) return path
    return exists(`${path}.html`) ? `${path}.html` : null
  }
  for (const file of html_files) {
    const { document } = parse_html(read_file(file, 'utf8'))
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href')
    if (canonical && !served(new URL(canonical, 'https://site.invalid/').pathname))
      report(file, 'canonical', `${canonical} has no file served without a redirect`)
    const primary = [...document.querySelectorAll('html[itemid], main[itemid], article[itemid]')]
    if (!primary.length) report(file, 'itemid', 'page has no primary itemid')
    for (const node of [...primary, ...document.querySelectorAll('article[itemscope]:not([itemid])')]) {
      const id = node.getAttribute('itemid') ?? ''
      const type = id.split('/')[2]
      const parser = create_itemid({ types: [type], requires_timestamp: [type] })
      if (
        !parser.is_itemid(id) ||
        !node.hasAttribute('itemscope') ||
        !/^https?:\/\/schema\.org\/[A-Za-z]+$/.test(node.getAttribute('itemtype') ?? '')
      )
        report(file, 'itemid', 'primary items need a valid itemid, itemscope, and Schema.org itemtype')
    }

    const css = []
    const seen = new Set()
    const read_css = path => {
      if (!path || seen.has(path)) return
      seen.add(path)
      const text = read_file(path, 'utf8')
      css.push(text)
      for (const match of text.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g))
        read_css(asset(match[1], path, 'palette'))
    }
    for (const link of document.querySelectorAll('link[rel="stylesheet"]'))
      read_css(asset(link.getAttribute('href'), file, 'palette'))
    const styles = without_comments(css.join('\n'))
    for (const name of ['palette.css', 'color.css']) {
      const reference = without_comments(read_file(new URL(name, style_root), 'utf8'))
      if (!styles.includes(reference)) report(file, 'palette', `linked CSS must include unchanged Realness ${name}`)
    }
    if (!styles.includes('--surface:var(--chalk)') || !styles.includes('--text:var(--graphite)'))
      report(file, 'light-mode', 'missing Realness light surface and text roles')
    if (!styles.includes('@media(prefers-color-scheme:dark)') || !styles.includes('color-scheme:lightdark'))
      report(file, 'dark-mode', 'missing system light/dark wiring')

    const manifest_link = document.querySelector('link[rel="manifest"]')
    const manifest_file = manifest_link && asset(manifest_link.getAttribute('href'), file, 'pwa-manifest')
    if (!manifest_link) report(file, 'pwa-manifest', 'missing manifest link')
    if (manifest_file) {
      try {
        const manifest = JSON.parse(read_file(manifest_file, 'utf8'))
        if (
          !manifest.name ||
          !manifest.start_url ||
          !manifest.scope ||
          !manifest.theme_color ||
          !manifest.background_color ||
          !['standalone', 'minimal-ui', 'fullscreen'].includes(manifest.display)
        )
          report(
            file,
            'pwa-manifest',
            'manifest needs name, start_url, scope, theme and background colors, and installed display mode'
          )
        if (!manifest.icons?.some(icon => icon.purpose?.split(' ').includes('maskable')))
          report(file, 'pwa-icons', 'no maskable icon')
        for (const size of ['192x192', '512x512']) {
          const icon = manifest.icons?.find(icon => icon.sizes?.split(' ').includes(size))
          if (!icon) report(file, 'pwa-icons', `missing ${size} icon`)
          else asset(icon.src, manifest_file, 'pwa-icons')
        }
      } catch (error) {
        report(file, 'pwa-manifest', error.message)
      }
    }
    const modules = new Set()
    const read_script = path => {
      if (!path || modules.has(path)) return ''
      modules.add(path)
      const text = read_file(path, 'utf8')
      const imports = [...text.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g)]
      return [text, ...imports.map(match => read_script(asset(match[1], path, 'pwa-registration')))].join('\n')
    }
    const local = href => href && !/^[a-z]+:|^\/\//i.test(href)
    pages.push({
      file,
      assets: [
        ...[...document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.getAttribute('href')),
        ...[...document.querySelectorAll('script[src]')].map(script => script.getAttribute('src'))
      ].filter(local)
    })
    const scripts = [...document.querySelectorAll('script')]
      .map(script =>
        script.hasAttribute('src')
          ? read_script(asset(script.getAttribute('src'), file, 'pwa-registration'))
          : script.textContent
      )
      .join('\n')
    if (!/serviceWorker/.test(scripts) || !/\bregister\s*\(/.test(scripts))
      report(file, 'pwa-registration', 'no service worker registration in page scripts')
    if (!/SKIP_WAITING/.test(scripts) || !/visibilitychange/.test(scripts))
      report(file, 'pwa-update', 'page scripts lack the update rule: activate on SKIP_WAITING while hidden')
  }
  const worker_file = html_files.length ? asset(`/${worker}`, join(root, 'index.html'), 'pwa-worker') : null
  if (worker_file) {
    const text = read_file(worker_file, 'utf8')
    for (const hit of check_worker(text)) report(worker_file, hit.rule, hit.text)
    const cached = precached(text)
    const falls_back = navigation_offline(text)
    for (const page of pages) {
      const path = relative(root, page.file)
      if (!falls_back && !cached.has(path)) report(page.file, 'pwa-precache', 'page is not precached and no navigation route answers offline')
      for (const href of page.assets) {
        const file = local_file_or_null(href, page.file)
        if (file && !cached.has(relative(root, file)))
          report(page.file, 'pwa-precache', `${href} is not precached; the page breaks offline`)
      }
    }
  }
  const sitemap = join(root, 'sitemap.xml')
  if (exists(sitemap))
    for (const [, loc] of read_file(sitemap, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g))
      if (!served(new URL(loc).pathname)) report(sitemap, 'canonical', `${loc} has no file served without a redirect`)
  return hits
}
