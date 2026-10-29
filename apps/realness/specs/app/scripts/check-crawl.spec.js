import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  check_crawl,
  main,
  robots_allows
} from '../../../scripts/check-crawl.js'
import { app_shell_html } from '../../../scripts/prerender-html.js'

const origin = 'https://realness.online'
const robots = `User-agent: *
Disallow: /
Allow: /$
Allow: /about
Allow: /prints
`
const page = url =>
  `<head><link rel="canonical" href="${url}" /><meta name="robots" content="index, follow" /></head>`
const sitemap = urls =>
  `<urlset>${urls.map(url => `<url><loc>${url}</loc></url>`).join('')}</urlset>`

let dist_dir
const write = (name, text) => {
  mkdirSync(path.dirname(path.join(dist_dir, name)), { recursive: true })
  writeFileSync(path.join(dist_dir, name), text)
}

beforeEach(() => {
  dist_dir = mkdtempSync(path.join(tmpdir(), 'crawl-'))
  write('robots.txt', robots)
  write('index.html', page(`${origin}/`))
  write('about/index.html', page(`${origin}/about`))
  write('prints/1.html', page(`${origin}/prints/1`))
  write('app.html', app_shell_html(page(`${origin}/`)))
  write(
    'sitemap.xml',
    sitemap([`${origin}/`, `${origin}/about`, `${origin}/prints/1`])
  )
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  rmSync(dist_dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('robots_allows', () => {
  it('lets the longest pattern win, and Allow win a tie', () => {
    expect(robots_allows(robots, '/')).toBe(true)
    expect(robots_allows(robots, '/thoughts')).toBe(false)
    expect(robots_allows(robots, '/prints/1')).toBe(true)
    expect(robots_allows('Disallow: /x\nAllow: /x', '/x')).toBe(true)
    expect(robots_allows('Disallow: /*.json$', '/a.json')).toBe(false)
    expect(robots_allows('Disallow: /*.json$', '/a.json/b')).toBe(true)
  })
})

describe('app_shell_html', () => {
  it('drops the canonical and adds noindex', () => {
    const shell = app_shell_html(page(`${origin}/`))
    expect(shell).not.toContain('canonical')
    expect(shell).toContain('<meta name="robots" content="noindex" />')
  })
})

describe('check-crawl', () => {
  it('passes when sitemap, robots, and canonicals agree', () => {
    expect(check_crawl(dist_dir)).toEqual([])
    expect(() => main({ dist_dir })).not.toThrow()
  })

  const controls = [
    ['robots.txt blocks', () => write('robots.txt', 'Disallow: /prints')],
    ['has no file', () => rmSync(path.join(dist_dir, 'prints/1.html'))],
    ['names', () => write('about/index.html', page(`${origin}/`))],
    [
      'is noindex',
      () => write('about/index.html', app_shell_html(page(`${origin}/about`)))
    ],
    ['app.html has a canonical', () => write('app.html', page(`${origin}/`))],
    ['no app.html', () => rmSync(path.join(dist_dir, 'app.html'))]
  ]
  for (const [index, [problem, mutate]] of controls.entries())
    it(`negative control ${index + 1}: ${problem}`, () => {
      mutate()
      expect(check_crawl(dist_dir).join('\n')).toContain(problem)
      expect(() => main({ dist_dir })).toThrow('problem(s)')
    })

  it('firebase serves app routes the shell, not the home page', () => {
    const firebase = JSON.parse(
      readFileSync(path.resolve('firebase.json'), 'utf8')
    )
    const fallback = firebase.hosting
      .find(site => site.target === 'app')
      .rewrites.find(rule => rule.source === '**' && rule.destination)
    expect(fallback.destination).toBe('/app.html')
  })
})
