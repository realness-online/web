import { describe, it, expect, vi } from 'vite-plus/test'
import {
  release_tag_candidates,
  is_retryable_status,
  load_github_manifest
} from '../../scripts/verify-deploy.js'

/** @param {number[]} statuses One status per fetch call, in order. */
const fetch_returning = statuses => {
  const queue = [...statuses]
  return vi.fn(async () => {
    const status = queue.shift() ?? 404
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({ version: '2.5.8', files: {} })
    }
  })
}

describe('release_tag_candidates', () => {
  it('tries bare and v-prefixed tags', () => {
    expect(release_tag_candidates('2.5.8')).toEqual(['2.5.8', 'v2.5.8'])
    expect(release_tag_candidates('v2.5.8')).toEqual(['v2.5.8', '2.5.8'])
  })
})

describe('is_retryable_status', () => {
  it('waits on a not-yet-published asset and on CDN faults', () => {
    expect(is_retryable_status(404)).toBe(true)
    expect(is_retryable_status(500)).toBe(true)
    expect(is_retryable_status(503)).toBe(true)
  })

  it('takes anything else as a real answer', () => {
    expect(is_retryable_status(401)).toBe(false)
    expect(is_retryable_status(403)).toBe(false)
  })
})

describe('load_github_manifest', () => {
  const opts = { repo: 'realness-online/web', release: '2.5.8' }

  it('retries the whole pass when the asset has not propagated yet', async () => {
    // Both spellings 404, then the v-prefixed tag lands on the second pass.
    const fetch_impl = fetch_returning([404, 404, 404, 200])
    const sleep_impl = vi.fn(async () => {})

    const { source } = await load_github_manifest(opts, {
      fetch_impl,
      sleep_impl
    })

    expect(source).toBe('github:realness-online/web@v2.5.8')
    expect(fetch_impl).toHaveBeenCalledTimes(4)
    expect(sleep_impl).toHaveBeenCalledTimes(1)
  })

  it('tries every spelling before spending a backoff', async () => {
    const fetch_impl = fetch_returning([404, 200])
    const sleep_impl = vi.fn(async () => {})

    const { source } = await load_github_manifest(opts, {
      fetch_impl,
      sleep_impl
    })

    expect(source).toBe('github:realness-online/web@v2.5.8')
    expect(sleep_impl).not.toHaveBeenCalled()
  })

  it('does not wait on a status that will not change', async () => {
    const fetch_impl = fetch_returning([403, 403])
    const sleep_impl = vi.fn(async () => {})

    await expect(
      load_github_manifest(opts, { fetch_impl, sleep_impl })
    ).rejects.toThrow('Could not download build-manifest.json')

    expect(fetch_impl).toHaveBeenCalledTimes(2)
    expect(sleep_impl).not.toHaveBeenCalled()
  })

  it('gives up after the attempt budget and names both urls tried', async () => {
    const fetch_impl = fetch_returning([404, 404, 404, 404, 404, 404])
    const sleep_impl = vi.fn(async () => {})

    await expect(
      load_github_manifest(opts, { fetch_impl, sleep_impl, attempts: 3 })
    ).rejects.toThrow('releases/download/v2.5.8/build-manifest.json')

    expect(fetch_impl).toHaveBeenCalledTimes(6)
    expect(sleep_impl).toHaveBeenCalledTimes(2)
  })

  it('backs off for longer each pass', async () => {
    const fetch_impl = fetch_returning([404, 404, 404, 404, 404, 404])
    const waits = []
    const sleep_impl = vi.fn(async ms => {
      waits.push(ms)
    })

    await expect(
      load_github_manifest(opts, { fetch_impl, sleep_impl, attempts: 3 })
    ).rejects.toThrow()

    expect(waits).toEqual([2000, 4000])
  })
})
