import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { main } from '../../../scripts/check-pwa-offline.js'

let dist_dir
let chrome_path

beforeEach(() => {
  dist_dir = mkdtempSync(path.join(tmpdir(), 'pwa-offline-'))
  chrome_path = path.join(dist_dir, 'chrome')
  writeFileSync(path.join(dist_dir, 'service.worker.js'), '')
  writeFileSync(chrome_path, '')
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  rmSync(dist_dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

const runs = (online, control) =>
  vi.fn(async ({ without_worker }) => (without_worker ? control : online))

describe('check-pwa-offline', () => {
  it('passes when offline renders and the control fails', async () => {
    const run = runs([], ['reload offline did not render'])
    await main({ args: ['--dir', dist_dir], chrome_path, run })
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('fails when the page does not survive offline', async () => {
    const run = runs(['reload offline did not render'], ['x'])
    await expect(
      main({ args: ['--dir', dist_dir], chrome_path, run })
    ).rejects.toThrow('offline failed')
  })

  it('fails when the control passes without a worker', async () => {
    await expect(
      main({ args: ['--dir', dist_dir], chrome_path, run: runs([], []) })
    ).rejects.toThrow('check is blind')
  })

  it('needs a built worker and a browser', async () => {
    await expect(
      main({
        args: ['--dir', dist_dir],
        chrome_path: '/nope',
        run: runs([], ['x'])
      })
    ).rejects.toThrow('CHROME_PATH')
    rmSync(path.join(dist_dir, 'service.worker.js'))
    await expect(
      main({ args: ['--dir', dist_dir], chrome_path, run: runs([], ['x']) })
    ).rejects.toThrow('no built worker')
  })
})
