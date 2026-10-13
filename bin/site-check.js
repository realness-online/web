import { readFileSync as read_file, readdirSync as readdir, realpathSync as realpath } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { parseHTML as parse_html } from 'linkedom'
import { create_itemid } from '../apps/realness/frontend/packages/itemid/src/index.js'

const style_root = new URL('../apps/realness/src/app/style/', import.meta.url)
const without_comments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '')

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
  const html_files = []
  const walk = dir => {
    for (const entry of readdir(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (entry.isFile() && entry.name.endsWith('.html')) html_files.push(file)
    }
  }
  walk(root)
  if (!html_files.length) report(join(root, 'index.html'), 'site-html', 'no built HTML pages')

  for (const file of html_files) {
    const { document } = parse_html(read_file(file, 'utf8'))
    const primary = [...document.querySelectorAll('html[itemid], main[itemid], article[itemid]')]
    if (!primary.length) report(file, 'itemid', 'page has no primary itemid')
    for (const node of [...primary, ...document.querySelectorAll('article[itemscope]:not([itemid])')]) {
      const id = node.getAttribute('itemid') ?? ''
      const type = id.split('/')[2]
      const parser = create_itemid({ types: [type], requires_timestamp: [type] })
      if (!parser.is_itemid(id) || !node.hasAttribute('itemscope') || !/^https?:\/\/schema\.org\/[A-Za-z]+$/.test(node.getAttribute('itemtype') ?? ''))
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
    for (const link of document.querySelectorAll('link[rel="stylesheet"]')) read_css(asset(link.getAttribute('href'), file, 'palette'))
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
        if (!manifest.name || !manifest.start_url || !manifest.scope || !['standalone', 'minimal-ui', 'fullscreen'].includes(manifest.display))
          report(file, 'pwa-manifest', 'manifest needs name, start_url, scope, and installed display mode')
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
    const scripts = [...document.querySelectorAll('script')].map(script => script.hasAttribute('src')
      ? read_script(asset(script.getAttribute('src'), file, 'pwa-registration'))
      : script.textContent).join('\n')
    if (!/serviceWorker/.test(scripts) || !/\bregister\s*\(/.test(scripts))
      report(file, 'pwa-registration', 'no service worker registration in page scripts')
  }
  if (html_files.length) asset(`/${worker}`, join(root, 'index.html'), 'pwa-worker')
  return hits
}
