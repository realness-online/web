import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { artifacts_dir } from '../../../scripts/lib/artifacts.js'
import { main } from '../../../scripts/test-prerender-render.js'

let dir
beforeEach(() => {
  mkdirSync(artifacts_dir, { recursive: true })
  dir = mkdtempSync(path.join(artifacts_dir, 'prerender-smoke-'))
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('test-prerender-render main', () => {
  it('renders each route from the server entry', async () => {
    const server_entry = path.join(dir, 'entry-server.js')
    const load = vi.fn(async () => ({
      render: async route => `<p>${route}</p>`
    }))
    expect(await main({ server_entry, routes: ['/a', '/docs'], load })).toEqual(
      {
        '/a': 9,
        '/docs': 12
      }
    )
    expect(load).toHaveBeenCalledWith(
      expect.stringMatching(/^file:.*entry-server\.js$/)
    )
  })
})
