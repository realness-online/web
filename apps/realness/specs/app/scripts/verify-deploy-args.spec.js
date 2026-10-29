import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  github_download_url,
  load_manifest,
  parse_args,
  verify_file
} from '../../../scripts/verify-deploy.js'

const digest = bytes =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`

describe('parse_args', () => {
  it('defaults to the latest release on the live site', () => {
    expect(parse_args([])).toEqual({
      base_url: 'https://realness.online',
      manifest_path: null,
      release: 'latest',
      from_site: false,
      repo: 'realness-online/web',
      settle: 0,
      services: null
    })
  })

  it('says a help request instead of exiting', () => {
    expect(parse_args(['-h'])).toEqual({ help: true })
    expect(parse_args(['--help'])).toEqual({ help: true })
  })

  it('reads a url without a trailing slash and a named release', () => {
    const parsed = parse_args([
      '--url',
      'https://a.test/',
      '--release',
      'v2.5.8'
    ])
    expect(parsed.base_url).toBe('https://a.test')
    expect(parsed.release).toBe('v2.5.8')
  })

  it('takes a bare --release as the package version', () => {
    expect(parse_args(['--release']).release).toBe('package')
    expect(parse_args(['--release', '--url', 'https://a.test']).release).toBe(
      'package'
    )
  })

  it('prefers a manifest file and a site-only read over the release', () => {
    const with_manifest = parse_args(['--manifest', '/tmp/m.json'])
    expect(with_manifest.manifest_path).toBe('/tmp/m.json')
    expect(with_manifest.release).toBe(null)

    const site = parse_args(['--from-site'])
    expect(site.from_site).toBe(true)
    expect(site.release).toBe(null)
  })

  it('reads a repo and ignores a flag with no value', () => {
    expect(parse_args(['--repo', 'someone/thing']).repo).toBe('someone/thing')
    expect(parse_args(['--url']).base_url).toBe('https://realness.online')
    expect(parse_args(['--manifest']).manifest_path).toBe(null)
  })
})

describe('github_download_url', () => {
  it('names the release asset for a repo and tag', () => {
    expect(github_download_url('realness-online/web', 'v2.5.8')).toBe(
      'https://github.com/realness-online/web/releases/download/v2.5.8/build-manifest.json'
    )
  })
})

describe('verify_file', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('matches, mismatches, and reports HTTP failures', async () => {
    const body = new TextEncoder().encode('hello').buffer
    vi.stubGlobal('fetch', async url =>
      url.endsWith('/missing')
        ? { ok: false, status: 404 }
        : { ok: true, arrayBuffer: async () => body }
    )
    expect(await verify_file('https://a.test', '/a', digest('hello'))).toEqual({
      file_path: '/a',
      ok: true
    })
    const wrong = await verify_file('https://a.test', '/a', 'sha256:nope')
    expect(wrong.ok).toBe(false)
    expect(wrong.message).toContain(digest('hello'))
    expect(await verify_file('https://a.test', '/missing', 'x')).toEqual({
      file_path: '/missing',
      ok: false,
      message: 'HTTP 404'
    })
  })
})
