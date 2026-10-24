import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { artifacts_dir } from '../../../scripts/lib/artifacts.js'
import { main } from '../../../scripts/prerender.js'
import { prerender_pages } from '../../../src/app/prerender/pages.js'

const template = `<!doctype html>
<html>
  <head><title>x</title></head>
  <body><main id="realness"></main></body>
</html>`

let dist_dir
let documentation_md
beforeEach(() => {
  mkdirSync(artifacts_dir, { recursive: true })
  dist_dir = mkdtempSync(path.join(artifacts_dir, 'prerender-'))
  documentation_md = path.join(dist_dir, 'docs-source.md')
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  rmSync(dist_dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

const build = () => {
  writeFileSync(path.join(dist_dir, 'index.html'), template)
  mkdirSync(path.join(dist_dir, 'server'))
  writeFileSync(path.join(dist_dir, 'server', 'entry-server.js'), '')
  writeFileSync(documentation_md, '# Docs\n')
}

const prints = [
  {
    path: '/prints/one',
    render_path: '/prints/:id',
    canonical: '/prints/canon',
    title: 'One',
    description: 'A print',
    og_title: 'One',
    og_image: 'https://a.test/one.png',
    og_image_alt: 'one alt',
    og_image_type: 'image/png',
    json_ld: ({ url }) => ({ '@type': 'Product', url })
  },
  {
    path: '/prints/two',
    title: 'Two',
    description: 'Another',
    og_title: 'Two',
    json_ld: 'unknown_kind'
  }
]

const run = options =>
  main({
    dist_dir,
    documentation_md,
    load: async () => ({ render: async route => `<p>${route}</p>` }),
    fetch_prints: async () => prints,
    prints_url: 'https://a.test/prints-list',
    now: () => new Date('2026-01-02T03:04:05Z'),
    ...options
  })

const page_html = route =>
  readFileSync(path.join(dist_dir, route, 'index.html'), 'utf8')

describe('prerender main', () => {
  it('needs the client build and the server entry', async () => {
    await expect(run()).rejects.toThrow(/index.html missing/)
    writeFileSync(path.join(dist_dir, 'index.html'), template)
    await expect(run()).rejects.toThrow(/entry-server.js missing/)
  })

  it('writes every page, the sitemap, and the docs', async () => {
    build()
    const fetch_prints = vi.fn(async () => prints)
    const pages = await run({ fetch_prints })
    expect(fetch_prints).toHaveBeenCalledWith('https://a.test/prints-list')
    expect(pages).toHaveLength(prerender_pages.length + prints.length)

    const one = page_html('prints/one')
    expect(one).toContain('<p>/prints/:id</p>')
    expect(one).toContain('https://a.test/one.png')
    expect(one).toContain('/prints/canon')
    expect(one).toContain('"@type":"Product"')
    expect(one).not.toContain('og:image:width')

    const two = page_html('prints/two')
    expect(two).toContain('<p>/prints/two</p>')
    expect(two).toContain('og:image:width')
    expect(two).not.toContain('application/ld+json')

    const sitemap = readFileSync(path.join(dist_dir, 'sitemap.xml'), 'utf8')
    expect(sitemap).toContain('2026-01-02')
    expect(sitemap).toContain('/documentation.md')
    expect(readFileSync(path.join(dist_dir, 'documentation.md'), 'utf8')).toBe(
      '# Docs\n'
    )
    expect(existsSync(path.join(dist_dir, 'index.html'))).toBe(true)
  })
})
