import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { runs_path } from '../../../src/scouts/report.js'
import { load_runs, run_item, save_runs } from '../../../src/scouts/runs.js'
import { scout_page } from '../../../src/scouts/scout.js'
import { main } from '../../../scripts/mail-digest.js'

const NOW = Date.parse('2026-11-08T20:00:00.000Z')

/** One scout folder with one run started half an hour ago. */
const scratch = async () => {
  const root = await mkdtemp(join(tmpdir(), 'scout-mail-script-'))
  const folder = join(root, 'vault/Projects/Scouts/SMS')
  await mkdir(join(folder, 'Runs/2026-11-08-1794000000000'), {
    recursive: true
  })
  await writeFile(
    join(folder, 'scout.html'),
    scout_page('SMS', {
      itemid: '/+1/scouts/sms',
      org: '+1',
      schedule: 'daily',
      minutes: 30,
      per_day: 1,
      status: 'active'
    })
  )
  const path = runs_path(folder)
  await save_runs(path, 'SMS', [
    run_item({
      itemid: '/+1/runs/1794000000000',
      scout: 'SMS',
      started: '2026-11-08T19:30:00.000Z',
      ended: '2026-11-08T19:40:00.000Z',
      exit: 0,
      leads: [],
      fresh: [],
      repeats: [],
      problems: []
    })
  ])
  return { root, vault: join(root, 'vault'), path }
}

/** A stand-in stdout or stderr that keeps what a command printed. */
const lines = () => {
  const written = []
  return { written, write: line => written.push(line) }
}

describe('mail digest script', () => {
  it('prints the digest and stamps nothing without --send', async () => {
    const { root, vault, path } = await scratch()
    const out = lines()
    const count = await main({ vault, clock: () => NOW, out })
    expect(count).toBe(1)
    expect(out.written.join('')).toMatch(/Scouts: 1 run/)
    expect((await load_runs(path))[0].mailed).toBe(undefined)
    await rm(root, { recursive: true })
  })

  it('says there is nothing to mail when every run is stamped', async () => {
    const { root, vault } = await scratch()
    await main({
      args: ['--send'],
      vault,
      clock: () => NOW,
      send: async () => {}
    })
    const again = lines()
    await main({
      args: ['--send'],
      vault,
      clock: () => NOW,
      send: async () => {},
      out: again
    })
    expect(again.written.length).toBe(0)
    await main({ vault, clock: () => NOW, out: again })
    expect(again.written.join('')).toMatch(/nothing to mail/)
    await rm(root, { recursive: true })
  })

  it('prints why Mail refused, and leaves the run owed', async () => {
    const { root, vault, path } = await scratch()
    const err = lines()
    await main({
      args: ['--send'],
      vault,
      clock: () => NOW,
      send: async () => {
        throw new Error('Mail is not running')
      },
      out: lines(),
      err
    })
    expect(err.written.join('')).toMatch(/Mail is not running/)
    expect((await load_runs(path))[0].mailed).toBe(undefined)
    await rm(root, { recursive: true })
  })
})
