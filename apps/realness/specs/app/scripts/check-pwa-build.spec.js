import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { check_pwa_build, main } from '../../../scripts/check-pwa-build.js'

const cached = [
  'index.html',
  'icons.svg',
  'vector.worker.js',
  'fonts/Lato-Regular-Subset.woff2'
]
const worker = (urls = cached) =>
  `importScripts("/push-handlers.js");
self.addEventListener("message",s=>{s.data&&"SKIP_WAITING"===s.data.type&&self.skipWaiting()});
e.clientsClaim();
e.precacheAndRoute([${urls.map(url => `{url:"${url}",revision:"1"}`).join(',')}]);`
const push = `self.addEventListener('push', () => {})
self.addEventListener('notificationclick', () => {})`
const manifest = (version = '3.0.0') =>
  JSON.stringify({
    icons: [{ src: `192.png?v=${version}` }, { src: `512.png?v=${version}` }]
  })
const html = (version = '3.0.0') =>
  `<link rel="apple-touch-icon" href="/192.png?v=${version}" />`

let dist_dir
const write = (name, text) => writeFileSync(path.join(dist_dir, name), text)

beforeEach(() => {
  dist_dir = mkdtempSync(path.join(tmpdir(), 'pwa-build-'))
  mkdirSync(path.join(dist_dir, 'fonts'))
  write('fonts/Lato-Regular-Subset.woff2', '')
  write('service.worker.js', worker())
  write('push-handlers.js', push)
  write('manifest.webmanifest', manifest())
  write('index.html', html())
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  rmSync(dist_dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

const rules = () => check_pwa_build(dist_dir).map(hit => hit.rule)

describe('check-pwa-build', () => {
  it('passes a build that keeps every trait', () => {
    expect(check_pwa_build(dist_dir)).toEqual([])
    expect(() => main({ dist_dir })).not.toThrow()
  })

  const controls = [
    ['pwa-worker', () => rmSync(path.join(dist_dir, 'service.worker.js'))],
    [
      'pwa-prompt',
      () => write('service.worker.js', worker().replace('SKIP_WAITING', 'X'))
    ],
    [
      'pwa-prompt',
      () => write('service.worker.js', `self.skipWaiting();${worker()}`)
    ],
    [
      'pwa-claim',
      () => write('service.worker.js', worker().replace('clientsClaim()', ''))
    ],
    ['pwa-precache', () => write('service.worker.js', worker(cached.slice(1)))],
    ['pwa-precache', () => write('fonts/Lato-Heavy-Subset.woff2', '')],
    [
      'pwa-precache',
      () =>
        write(
          'service.worker.js',
          worker([...cached, 'wasm/ghostty-vt-abc.wasm'])
        )
    ],
    [
      'pwa-push',
      () => write('service.worker.js', worker().replace('importScripts', 'x'))
    ],
    [
      'pwa-push',
      () => write('push-handlers.js', push.replace('notificationclick', 'x'))
    ],
    ['pwa-icon-version', () => write('index.html', html('2.5.1'))],
    ['pwa-icon-version', () => write('manifest.webmanifest', manifest(''))]
  ]
  for (const [index, [rule, mutate]] of controls.entries())
    it(`negative control ${index + 1}: ${rule}`, () => {
      mutate()
      expect(rules()).toContain(rule)
      expect(() => main({ dist_dir })).toThrow('hit(s)')
    })
})
