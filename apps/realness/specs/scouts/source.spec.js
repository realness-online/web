import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { item_html } from '#root/lib/items.js'
import { run_scout } from '#root/src/scouts/run.js'
import { scout_page } from '#root/src/scouts/scout.js'
import { dead_source } from '#root/src/scouts/source.js'

it('a log with no lease line reads clean', () => {
  assert.equal(dead_source('read 12 pages\nwrote finds.html\n'), null)
})

it('a failed lease in the log is why the run died', () => {
  assert.match(
    dead_source('realness chrome: no saved yc login\n'),
    /no saved yc login/
  )
  assert.match(
    dead_source('...\nrealness chrome: timed out\n'),
    /realness chrome: timed out/
  )
})

const scratch = async () => {
  const root = await mkdtemp(join(tmpdir(), 'scout-dead-'))
  const folder = join(root, 'vault/Projects/Scouts/Realness')
  await mkdir(folder, { recursive: true })
  await writeFile(
    join(folder, 'scout.html'),
    scout_page('Realness', {
      itemid: '/+1/scouts/realness',
      org: '+1',
      schedule: 'daily',
      minutes: 30,
      per_day: 1,
      status: 'active'
    })
  )
  await writeFile(join(folder, 'Profile.md'), '# profile\n')
  await writeFile(join(folder, 'Sources.md'), '# sources\n')
  return { root, folder }
}

it('a dead login source fails the run instead of a quiet zero', async () => {
  const { root, folder } = await scratch()
  await assert.rejects(
    run_scout({
      scout: 'realness',
      vault_dir: join(root, 'vault'),
      person: '/+1',
      date: '2026-11-05',
      spawn_pi: async (brief, run_dir) => {
        await writeFile(
          join(run_dir, 'pi.log'),
          'realness chrome: no reply from the halo\n'
        )
        return 0
      }
    }),
    /a login source was unreadable: realness chrome: no reply from the halo/
  )
  assert.equal(existsSync(join(folder, 'Runs/runs.html')), false)
  await rm(root, { recursive: true })
})

it('a clean log still writes the run', async () => {
  const { root } = await scratch()
  const result = await run_scout({
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    spawn_pi: async (brief, run_dir) => {
      await writeFile(join(run_dir, 'pi.log'), 'read 3 pages\n')
      await writeFile(
        join(run_dir, 'finds.html'),
        item_html('find', {
          url: 'https://example.com/a',
          title: 'Engineer',
          org: 'Acme',
          source: 'VueJobs',
          score: '7',
          reason: 'small team'
        })
      )
    }
  })
  assert.match(await readFile(result.path, 'utf8'), /Acme/)
  await rm(root, { recursive: true })
})
