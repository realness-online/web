import assert from 'node:assert/strict'
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { read_items } from '#root/lib/items.js'

const FIND =
  '<article itemscope itemtype="/find"><dl><dt>url</dt><dd><a itemprop="url" href="https://example.com/a">a</a></dd><dt>title</dt><dd><span itemprop="title">A</span></dd><dt>org</dt><dd><span itemprop="org">Acme</span></dd><dt>source</dt><dd><span itemprop="source">News</span></dd><dt>score</dt><dd><span itemprop="score">8</span></dd><dt>reason</dt><dd><span itemprop="reason">fits</span></dd></dl></article>'

import {
  active_scouts,
  due_scouts,
  run_scout_box,
  scout_due
} from '#root/src/scouts/halo.js'
import { runs_path } from '#root/src/scouts/report.js'
import { run_item, save_runs } from '#root/src/scouts/runs.js'
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

/** A box store stand-in: it records the command and answers as the box would. */
const fake_box = ({ code = 0, said = 'realness-leads news: 1 new' } = {}) => {
  const commands = []
  const store = {
    exec: async (id, argv, options) => {
      commands.push({ id, argv, options })
      return {
        exit_code: code,
        stdout_b64: Buffer.from(`step one\n${said}\n`).toString('base64'),
        stderr_b64: ''
      }
    }
  }
  return { store, commands }
}

it('a halo run hands the source to the box and writes nothing itself', async () => {
  const root = await scratch()
  const vault_dir = join(root, 'vault')
  const { store, commands } = fake_box()
  const result = await run_scout_box({
    store,
    actor: 'a-1',
    scout: 'Scouts/SMS',
    source: 'news'
  })
  assert.deepEqual(commands[0].argv, [
    '/usr/local/bin/realness-scouts',
    'Scouts/SMS',
    '--source',
    'news'
  ])
  assert.equal(commands[0].id, 'a-1')
  assert.deepEqual(result, { code: 0, said: 'realness-leads news: 1 new' })
  assert.deepEqual(
    await readdir(join(vault_dir, 'Projects/Scouts/SMS')),
    ['Profile.md', 'Sources.md', 'scout.html'],
    'the box owns the run folder; the halo makes none'
  )
  await rm(root, { recursive: true })
})

it('a box run that fails reports its exit code and last line', async () => {
  const { store } = fake_box({ code: 1, said: 'not ready: no model' })
  const result = await run_scout_box({
    store,
    actor: 'a-1',
    scout: 'Scouts/SMS'
  })
  assert.deepEqual(result, { code: 1, said: 'not ready: no model' })
})

const scout_of = (per_day, status = 'active') => ({
  path: 'Scouts/SMS',
  folder: '/nowhere',
  file: '/nowhere/scout.html',
  itemid: '/+1/scouts/sms',
  org: '+1',
  schedule: 'daily',
  minutes: 30,
  per_day,
  status
})

const HOUR = 60 * 60_000
const NOW = Date.parse('2026-11-08T12:00:00.000Z')
const date = '2026-11-08'
const run_at = started => ({ started, ended: started })

it('a scout with nothing run yet is due', () => {
  assert.equal(scout_due(scout_of(2), [], { date, now: NOW }), true)
})

it('a scout at its daily budget is not due, however long the day has run', () => {
  const runs = [
    run_at('2026-11-08T01:00:00.000Z'),
    run_at('2026-11-08T02:00:00.000Z')
  ]
  assert.equal(scout_due(scout_of(2), runs, { date, now: NOW }), false)
})

it('a scout keeps half a day between its two runs', () => {
  const runs = [run_at('2026-11-08T09:00:00.000Z')]
  assert.equal(scout_due(scout_of(2), runs, { date, now: NOW }), false)
  assert.equal(
    scout_due(scout_of(2), runs, { date, now: NOW + 9 * HOUR }),
    true
  )
})

it('a run still in flight, or a paused scout, is not due', () => {
  assert.equal(
    scout_due(scout_of(1), [], { date, now: NOW, running: true }),
    false
  )
  assert.equal(scout_due(scout_of(1, 'paused'), [], { date, now: NOW }), false)
})

it('a page without per_day still runs once a day', () => {
  assert.equal(scout_due(scout_of(0), [], { date, now: NOW }), true)
  assert.equal(
    scout_due(scout_of(0), [run_at('2026-11-08T01:00:00.000Z')], {
      date,
      now: NOW
    }),
    false
  )
})

it('due scouts read their runs page to see what today already spent', async () => {
  const root = await scratch()
  const vault_dir = join(root, 'vault')
  const runs_page = runs_path(join(vault_dir, 'Projects/Scouts/SMS'))
  const run = started =>
    run_item({
      itemid: `/+1/runs/${started}`,
      scout: 'SMS',
      started,
      ended: started,
      exit: 0,
      leads: [],
      fresh: [],
      repeats: [],
      problems: []
    })
  assert.deepEqual(
    (await due_scouts(vault_dir, { date, now: NOW })).map(
      entry => entry.page.path
    ),
    ['Scouts/SMS']
  )
  await save_runs(runs_page, 'SMS', [run('2026-11-08T01:00:00.000Z')])
  assert.deepEqual(await due_scouts(vault_dir, { date, now: NOW }), [])
  const in_flight = await due_scouts(vault_dir, {
    date,
    now: NOW,
    running: new Set(['Scouts/SMS|'])
  })
  assert.equal(in_flight.length, 0)
  await rm(root, { recursive: true })
})

const SOURCES = `# Sources

## 1. YC Work at a Startup

https://www.workatastartup.com/

## 2. VueJobs

https://vuejobs.com/jobs

## 3. Hacker News

https://news.ycombinator.com/
`

it('each source runs on its own, and one hung source leaves the rest due', async () => {
  const root = await scratch()
  const folder = join(root, 'vault/Projects/Scouts/SMS')
  await writeFile(join(folder, 'Sources.md'), SOURCES)
  const runs_page = runs_path(folder)
  await save_runs(runs_page, 'SMS', [
    run_item({
      itemid: '/+1/runs/1',
      scout: 'SMS',
      source: 'yc-work-at-a-startup',
      started: '2026-11-08T01:00:00.000Z',
      ended: '2026-11-08T01:10:00.000Z',
      exit: 0
    })
  ])
  const due = await due_scouts(join(root, 'vault'), { date, now: NOW })
  assert.deepEqual(
    due.map(entry => entry.source).sort(),
    ['hacker-news', 'vuejobs'],
    'the source that ran today is not due; the others are'
  )
  const hung = await due_scouts(join(root, 'vault'), {
    date,
    now: NOW,
    running: new Set(['Scouts/SMS|vuejobs'])
  })
  assert.deepEqual(
    hung.map(entry => entry.source),
    ['hacker-news'],
    'a source in flight costs only itself'
  )
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
