import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  load_github_manifest,
  load_manifest,
  parse_args
} from '../../../scripts/verify-deploy.js'

const json = (body, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parse_args for a release pass', () => {
  it('reads the repo and how long to settle', () => {
    const parsed = parse_args(['--repo', 'me/site', '--settle', '180'])
    expect(parsed.repo).toBe('me/site')
    expect(parsed.settle).toBe(180)
  })

  it('names the services to check, or all of them when bare', () => {
    expect(parse_args(['--services', 'sync,gate']).services).toEqual([
      'sync',
      'gate'
    ])
    const bare = parse_args(['--services']).services
    expect(bare).toEqual(expect.arrayContaining(['sync', 'proxy', 'gate']))
    expect(parse_args(['--services', '--settle', '5']).services).toEqual(bare)
  })
})

describe('the latest release', () => {
  it('is the newest one that carries a build manifest', async () => {
    const asked = []
    vi.stubGlobal('fetch', async url => {
      asked.push(url)
      return json([
        { tag_name: 'v9', assets: [{ name: 'notes.txt' }] },
        { tag_name: 'v8', assets: [{ name: 'build-manifest.json' }] },
        { tag_name: 'v7' }
      ])
    })
    const fetch_impl = vi.fn(async () => json({ files: {} }))
    const { source } = await load_github_manifest(
      { repo: 'me/site', release: 'latest' },
      { fetch_impl }
    )
    expect(asked[0]).toMatch(/api\.github\.com\/repos\/me\/site\/releases/)
    expect(source).toBe('github:me/site@v8')
    expect(fetch_impl).toHaveBeenCalledTimes(1)
  })

  it('says how to publish one when no release has a manifest', async () => {
    vi.stubGlobal('fetch', async () => json([{ tag_name: 'v9', assets: [] }]))
    await expect(
      load_github_manifest({ repo: 'me/site', release: 'latest' })
    ).rejects.toThrow(/No GitHub release on me\/site has a build-manifest/)
  })

  it('names the GitHub status when the listing fails', async () => {
    vi.stubGlobal('fetch', async () => json(null, 503))
    await expect(
      load_github_manifest({ repo: 'me/site', release: 'latest' })
    ).rejects.toThrow(/GitHub API 503/)
  })

  it('gives up on a missing asset without waiting when nothing is propagating', async () => {
    const sleep_impl = vi.fn()
    await expect(
      load_github_manifest(
        { repo: 'me/site', release: 'v1.0.0' },
        { fetch_impl: async () => json(null, 403), sleep_impl }
      )
    ).rejects.toThrow(
      /Could not download build-manifest.json for release v1.0.0/
    )
    expect(sleep_impl).not.toHaveBeenCalled()
  })
})

describe('load_manifest from the site', () => {
  it('fails clearly when the site has no manifest', async () => {
    vi.stubGlobal('fetch', async () => json(null, 404))
    await expect(
      load_manifest({ base_url: 'https://a.test', from_site: true })
    ).rejects.toThrow(
      'Could not load manifesto from https://a.test/build-manifest.json'
    )
  })
})
