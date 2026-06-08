import { describe, it, expect } from 'vite-plus/test'
import {
  apply_page_meta,
  inject_app_html,
  prerender_dir_for_route
} from '../../scripts/prerender-html.js'

describe('prerender-html', () => {
  it('maps routes to output directories', () => {
    expect(prerender_dir_for_route('/about')).toBe('about')
    expect(prerender_dir_for_route('/docs')).toBe('docs')
  })

  it('replaces the app shell with rendered markup', () => {
    const template =
      '<html><body><div id="app"><p>loading</p></div></body></html>'
    const html = inject_app_html(template, '<section id="about"></section>')
    expect(html).toContain('data-prerender="true"')
    expect(html).toContain('<section id="about"></section>')
    expect(html).not.toContain('loading')
  })

  it('applies per-page meta tags', () => {
    const template = `<!doctype html>
<html>
  <head>
    <title>Realness Online</title>
    <meta name="description" content="old" />
    <meta property="og:url" content="https://realness.online" />
    <meta property="og:title" content="Realness Online" />
  </head>
  <body></body>
</html>`
    const html = apply_page_meta(template, {
      title: 'About',
      description: 'new description',
      og_title: 'About OG',
      og_url: 'https://realness.online/about',
      canonical: 'https://realness.online/about'
    })
    expect(html).toContain('<title>About</title>')
    expect(html).toContain('content="new description"')
    expect(html).toContain('content="https://realness.online/about"')
    expect(html).toContain('rel="canonical"')
  })
})
