import { describe, it, expect } from 'vite-plus/test'
import {
  apply_page_meta,
  build_sitemap_xml,
  inject_app_html,
  inject_json_ld,
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
    <meta name="robots" content="noindex, nofollow" />
    <meta property="og:url" content="https://realness.online" />
    <meta property="og:title" content="Realness Online" />
    <meta property="og:image" content="https://realness.online/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
  </head>
  <body></body>
</html>`
    const html = apply_page_meta(template, {
      title: 'About',
      description: 'new description',
      robots: 'index, follow',
      og_title: 'About OG',
      og_description: 'new description',
      og_url: 'https://realness.online/about',
      og_image: 'https://realness.online/og.png',
      og_image_alt: 'Realness Online — Make some posters today',
      og_image_type: 'image/png',
      og_site_name: 'Realness Online',
      twitter_title: 'About OG',
      twitter_description: 'new description',
      twitter_image: 'https://realness.online/og.png',
      twitter_image_alt: 'Realness Online — Make some posters today',
      canonical: 'https://realness.online/about'
    })
    expect(html).toContain('<title>About</title>')
    expect(html).toContain('content="new description"')
    expect(html).toContain('content="index, follow"')
    expect(html).toContain('property="og:description"')
    expect(html).toContain('property="og:site_name"')
    expect(html).toContain('property="og:image:type"')
    expect(html).toContain('name="twitter:image:alt"')
    expect(html).toContain('name="twitter:title"')
    expect(html).toContain('content="https://realness.online/about"')
    expect(html).toContain('rel="canonical"')
  })

  it('injects JSON-LD into the head', () => {
    const template = '<html><head></head><body></body></html>'
    const html = inject_json_ld(template, {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Realness'
    })
    expect(html).toContain('<script type="application/ld+json">')
    expect(html).toContain('"@type":"SoftwareApplication"')
    expect(html).toContain('"name":"Realness"')
  })

  it('builds a sitemap with lastmod dates', () => {
    const xml = build_sitemap_xml({
      site_origin: 'https://realness.online',
      pages: [{ path: '/about' }, { path: '/docs' }],
      lastmod: '2026-07-02',
      extra_urls: ['/documentation.md']
    })
    expect(xml).toContain('<loc>https://realness.online/about</loc>')
    expect(xml).toContain('<loc>https://realness.online/documentation.md</loc>')
    expect(xml).toContain('<lastmod>2026-07-02</lastmod>')
    expect(xml.match(/<lastmod>/g)).toHaveLength(3)
  })
})
