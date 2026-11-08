import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { item_html } from '#root/lib/items.js'
import {
  ACTOR_VAULT,
  active_scouts,
  run_scout_loop
} from '#root/src/scouts/halo.js'
import { scout_page } from '#root/src/scouts/scout.js'

const scratch = async () => {
  const root = await mkdtemp(join(tmpdir(), 'scout-halo-'))
  const folder = join(root, 'vault/Projects/Scouts/SMS')
  await mkdir(folder, { recursive: true })
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
  await writeFile(join(folder, 'Profile.md'), '# profile\n')
  await writeFile(join(folder, 'Sources.md'), '# sources\n')
  return root
}

/** A Loops stand-in: the loop "writes" its finds into the host run folder, then exits. */
const fake_loops = (vault_dir, reason) => {
  const started = []
  const loops = {
    loops: {},
    start: async (parent, goal, options) => {
      started.push({ parent, goal, options })
      const actor_dir = goal.match(/Read (\S+)\/goal\.md/)[1]
      const host_dir = join(vault_dir, actor_dir.slice(ACTOR_VAULT.length))
      const brief = await readFile(join(host_dir, 'goal.md'), 'utf8')
      assert.match(
        brief,
        new RegExp(`${ACTOR_VAULT}/Projects/Scouts/SMS/Companies`)
      )
      await writeFile(
        join(host_dir, 'finds.html'),
        item_html(
          'find',
          {
            url: 'https://example.com/a',
            title: 'A',
            org: 'Acme',
            source: 'News',
            score: '8',
            reason: 'fits'
          },
          { links: ['url'] }
        )
      )
      loops.loops.L = { status: 'running' }
      setTimeout(
        () => Object.assign(loops.loops.L, { status: 'stopped', reason }),
        5
      )
      return { id: 'L', depth: 1 }
    }
  }
  return { loops, started }
}

it('a halo scout runs its brief in a one-shot loop and merges the finds', async () => {
  const root = await scratch()
  const vault_dir = join(root, 'vault')
  const { loops, started } = fake_loops(vault_dir, 'exited')
  const result = await run_scout_loop({
    loops,
    parent: 'a-1',
    scout: 'Scouts/SMS',
    vault_dir,
    person: '/+1',
    date: '2026-11-08',
    poll_ms: 1
  })
  assert.equal(started.length, 1)
  assert.deepEqual(started[0].options, { once: true, deadline_ms: 30 * 60_000 })
  assert.match(
    started[0].goal,
    /^Read \/realness\/vault\/Projects\/Scouts\/SMS\/Runs\//
  )
  assert.equal(result.fresh.length, 1)
  assert.deepEqual(result.problems, [])
  await rm(root, { recursive: true })
})

it('a loop stopped by its deadline still reports what it wrote', async () => {
  const root = await scratch()
  const vault_dir = join(root, 'vault')
  const { loops } = fake_loops(vault_dir, 'deadline')
  const result = await run_scout_loop({
    loops,
    parent: 'a-1',
    scout: 'Scouts/SMS',
    vault_dir,
    person: '/+1',
    date: '2026-11-08',
    poll_ms: 1
  })
  assert.equal(result.fresh.length, 1)
  assert.match(result.problems[0].problem, /pi exited 1/)
  await rm(root, { recursive: true })
})

it('a batch run takes every active scout and skips a paused one', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scout-batch-'))
  for (const [name, status] of [
    ['Realness', 'active'],
    ['SMS', 'paused']
  ]) {
    const folder = join(root, 'vault/Projects/Scouts', name)
    await mkdir(folder, { recursive: true })
    await writeFile(
      join(folder, 'scout.html'),
      scout_page(name, {
        itemid: `/+1/scouts/${name.toLowerCase()}`,
        org: '+1',
        schedule: 'daily',
        minutes: 30,
        per_day: 1,
        status
      })
    )
  }
  assert.deepEqual(
    active_scouts(join(root, 'vault')).map(page => page.path),
    ['Scouts/Realness']
  )
  await rm(root, { recursive: true })
})
