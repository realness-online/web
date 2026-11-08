import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { it } from 'node:test'
import { item_html, read_items } from '#root/lib/items.js'
import { run_scout } from '#root/src/scouts/run.js'
import { scout_page } from '#root/src/scouts/scout.js'

const SCOUTS = 'vault/Projects/Scouts'

/** One plan folder with a scout page, and a profile and sources beside it. */
const plan = async (root, name, fields = {}) => {
  const folder = join(root, SCOUTS, name)
  await mkdir(folder, { recursive: true })
  await writeFile(
    join(folder, 'scout.html'),
    scout_page(name, {
      itemid: `/+1/scouts/${name}`,
      org: '+1',
      schedule: 'a few times a day',
      minutes: 30,
      per_day: 4,
      status: 'active',
      ...fields
    })
  )
  return folder
}

const scratch = async () => {
  const root = await mkdtemp(join(tmpdir(), 'scout-run-'))
  await plan(root, 'Realness')
  await plan(root, 'SMS')
  await writeFile(join(root, SCOUTS, 'Realness/Profile.md'), '# profile\n')
  await writeFile(join(root, SCOUTS, 'Realness/Sources.md'), '# sources\n')
  return root
}

/** A pi that answers with the leads given, as a run would write them. */
const pi_writing = leads => async (brief, run_dir) => {
  assert.match(brief, /# The profile/)
  await writeFile(
    join(run_dir, 'finds.html'),
    leads.map(lead => item_html('find', lead, { links: ['url'] })).join('')
  )
}

const FINDS = 'vault/Projects/Scouts/Realness/Finds/finds.html'

/** A nested plan gets its own scout folder, with no list in code to change. */
it('a scout in a plan inside a plan is found by its page alone', async () => {
  const root = await scratch()
  const nested = await plan(root, 'Bedroom/Realness', {
    itemid: '/+1/scouts/bedroom',
    minutes: 5,
    per_day: 2
  })
  await writeFile(join(nested, 'Profile.md'), '# bedroom profile\n')
  await writeFile(join(nested, 'Sources.md'), '# bedroom sources\n')
  const result = await run_scout({
    scout: 'Scouts/Bedroom/Realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    spawn_pi: async (brief, run_dir, minutes) => {
      assert.equal(minutes, 5)
      assert.match(brief, /# bedroom profile/)
      assert.match(brief, /Projects\/Scouts\/Bedroom\/Realness\/Companies/)
    }
  })
  assert.equal(result.run_dir.startsWith(nested), true)
  await rm(root, { recursive: true })
})

it('a paused scout does not run', async () => {
  const root = await scratch()
  await plan(root, 'SMS', { status: 'paused' })
  await writeFile(join(root, SCOUTS, 'SMS/Profile.md'), '# sms\n')
  await writeFile(join(root, SCOUTS, 'SMS/Sources.md'), '# sms\n')
  let spawned = false
  await assert.rejects(
    run_scout({
      scout: 'sms',
      vault_dir: join(root, 'vault'),
      person: '/+1',
      date: '2026-11-05',
      spawn_pi: async () => {
        spawned = true
      }
    }),
    /SMS is paused/
  )
  assert.equal(spawned, false)
  await rm(root, { recursive: true })
})

/** The finds page as the next run reads it. */
const finds_of = async root =>
  read_items(await readFile(join(root, FINDS), 'utf8'), 'find')

/** A page already holding one find. */
const seed = (root, url) =>
  mkdir(dirname(join(root, FINDS)), { recursive: true }).then(() =>
    writeFile(
      join(root, FINDS),
      item_html('find', { itemid: '/+1/finds/1', url, status: 'passed' })
    )
  )

const lead = (url, score) => ({
  url,
  title: 'Product Engineer',
  org: 'Acme',
  source: 'VueJobs',
  score,
  reason: 'small team',
  research: '[[acme]]',
  draft: score >= 7 ? 'Hello.' : ''
})

it('a run writes the dated note, its run folder, and the finds on the page', async () => {
  const root = await scratch()
  const result = await run_scout({
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    spawn_pi: pi_writing([lead('https://vuejobs.com/jobs/acme', 8)])
  })
  const note = await readFile(result.path, 'utf8')
  assert.match(note, /## 8\.0 - Acme/)
  const runs = read_items(
    await readFile(
      join(root, 'vault/Projects/Scouts/Realness/Runs/runs.html'),
      'utf8'
    ),
    'run'
  )
  assert.equal(runs.length, 1)
  assert.equal(runs[0].found, '1')
  assert.equal(runs[0].exit, '0')
  assert.equal(runs[0].goal, 'goal.md')
  assert.equal(
    result.run_dir,
    join(
      root,
      'vault/Projects/Scouts/Realness/Runs',
      '2026-11-05-' + runs[0].itemid.split('/').at(-1)
    )
  )
  assert.equal(existsSync(join(result.run_dir, 'goal.md')), true)
  const finds = await finds_of(root)
  assert.deepEqual(
    finds.map(find => [
      find.url,
      find.status,
      find.itemid.startsWith('/+1/finds/')
    ]),
    [['https://vuejobs.com/jobs/acme', 'new', true]]
  )
  assert.equal(result.fresh.length, 1)
  await rm(root, { recursive: true })
})

it('the second run reports the same lead as already seen', async () => {
  const root = await scratch()
  const options = {
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    spawn_pi: pi_writing([lead('https://vuejobs.com/jobs/acme', 8)])
  }
  await run_scout({ ...options, date: '2026-11-05' })
  const second = await run_scout({ ...options, date: '2026-11-06' })
  assert.equal(second.fresh.length, 0)
  assert.equal(second.repeats.length, 1)
  assert.match(await readFile(second.path, 'utf8'), /## Already seen/)
  assert.equal((await finds_of(root)).length, 1)
  await rm(root, { recursive: true })
})

it('a run that writes no finds is reported, and the page keeps what it had', async () => {
  const root = await scratch()
  await seed(root, 'https://example.com/old')
  const result = await run_scout({
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    spawn_pi: async () => {}
  })
  assert.deepEqual(result.problems, [
    { item: 0, problem: 'the run wrote no finds.html' }
  ])
  assert.match(await readFile(result.path, 'utf8'), /No new leads\./)
  assert.deepEqual(await finds_of(root), [
    { itemid: '/+1/finds/1', url: 'https://example.com/old', status: 'passed' }
  ])
  await rm(root, { recursive: true })
})

it('a run that wrote nothing and failed writes no note and keeps the store alone', async () => {
  const root = await scratch()
  await assert.rejects(
    run_scout({
      scout: 'realness',
      vault_dir: join(root, 'vault'),
      person: '/+1',
      date: '2026-11-05',
      spawn_pi: async () => 1
    }),
    /the run failed: pi exited 1/
  )
  await assert.rejects(
    readFile(join(root, 'vault/Projects/Scouts/Realness/Leads/2026-11-05.md')),
    {
      code: 'ENOENT'
    }
  )
  await rm(root, { recursive: true })
})

it('a run that exits badly after writing its leads still reports them', async () => {
  const root = await scratch()
  const result = await run_scout({
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    spawn_pi: async (brief, run_dir) => {
      await pi_writing([lead('https://vuejobs.com/jobs/acme', 8)])(
        brief,
        run_dir
      )
      return 1
    }
  })
  assert.equal(result.fresh.length, 1)
  assert.deepEqual(result.problems, [
    { item: 0, problem: 'pi exited 1 after writing its leads' }
  ])
  await rm(root, { recursive: true })
})

it('a scout with no profile stops before pi starts', async () => {
  const root = await scratch()
  let spawned = false
  await assert.rejects(
    run_scout({
      scout: 'sms',
      vault_dir: join(root, 'vault'),
      person: '/+1',
      date: '2026-11-05',
      spawn_pi: async () => {
        spawned = true
      }
    }),
    /the profile is missing/
  )
  assert.equal(spawned, false)
  await rm(root, { recursive: true })
})

it('the brief carries the profile, the sources, the open nodes, and the leads to skip', async () => {
  const root = await scratch()
  await seed(root, 'https://example.com/old')
  await writeFile(
    join(root, SCOUTS, 'index.md'),
    '# Scouts\n\n## Nodes\n\n| id | goal | effort |\n| -- | ---- | ------ |\n| c4 | draft outreach | medium |\n'
  )
  let brief = ''
  await run_scout({
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    spawn_pi: async text => {
      brief = text
    }
  })
  assert.match(brief, /# profile/)
  assert.match(brief, /# sources/)
  assert.match(brief, /example\.com\/old/)
  assert.match(brief, /c4: draft outreach/)
  assert.match(brief, /Projects\/Scouts\/Realness\/Companies/)
  await rm(root, { recursive: true })
})

it('a run directory keeps its own brief, beside the leads', async () => {
  const root = await scratch()
  const result = await run_scout({
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    spawn_pi: pi_writing([lead('https://vuejobs.com/jobs/acme', 8)])
  })
  const brief = await readFile(join(result.run_dir, 'goal.md'), 'utf8')
  assert.equal(dirname(join(result.run_dir, 'goal.md')), result.run_dir)
  assert.match(brief, /You are the Realness scout/)
  await rm(root, { recursive: true })
})

it('a dry run returns the brief and writes nothing to the vault', async () => {
  const root = await scratch()
  let spawned = false
  const result = await run_scout({
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    dry_run: true,
    spawn_pi: async () => {
      spawned = true
    }
  })
  assert.match(result.brief, /You are the Realness scout/)
  assert.equal(spawned, false)
  assert.equal(existsSync(join(root, SCOUTS, 'Realness/Runs')), false)
  assert.equal(existsSync(join(root, SCOUTS, 'Realness/Leads')), false)
  assert.equal(existsSync(join(root, FINDS)), false)
  await rm(root, { recursive: true })
})
