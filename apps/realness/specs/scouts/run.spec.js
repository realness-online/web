import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { it } from 'node:test'
import { item_html, read_items } from '#root/lib/items.js'
import { run_scout } from '#root/src/scouts/run.js'
import { STAGES_PAGE } from '#root/src/scouts/stages.js'
import { append_item } from '#root/src/files/item-log.js'
import { save_finds } from '#root/src/scouts/seen.js'
import { scout_due } from '#root/src/scouts/halo.js'
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
    spawn_pi: async brief => {
      assert.match(brief, /# bedroom profile/)
      assert.match(
        brief,
        /Projects\/Scouts\/Bedroom\/Realness\/Runs\/\S+\/finds\.html/
      )
    }
  })
  assert.equal(result.run_dir.startsWith(nested), true)
  await rm(root, { recursive: true })
})

it('a run has no clock: pi gets the brief, its folder, and the stages to time', async () => {
  const root = await scratch()
  await writeFile(join(root, SCOUTS, 'SMS/Profile.md'), '# sms\n')
  await writeFile(
    join(root, SCOUTS, 'SMS/Sources.md'),
    '# sms\n\nhttps://sms.test/board\n'
  )
  await run_scout({
    scout: 'sms',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    spawn_pi: async (...args) => {
      assert.equal(args.length, 4)
      assert.equal(typeof args[2], 'function')
      assert.deepEqual(args[3], ['https://sms.test/board'])
      assert.doesNotMatch(args[0], /minutes/)
    }
  })
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

it('a run writes its day into the plan digest, and the page keeps the older days', async () => {
  const root = await scratch()
  const index = join(root, SCOUTS, 'Realness/index.md')
  await writeFile(
    index,
    '# Realness\n\n### Finds\n\n<details>\n<summary><strong>Nov 7</strong> <span>1 lead</span></summary>\n<table>\n<tbody>\n<tr><td>9</td><td><a href="https://example.com/old">Old</a></td><td>old reason</td></tr>\n</tbody>\n</table>\n</details>\n'
  )
  await run_scout({
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-08',
    spawn_pi: pi_writing([lead('https://vuejobs.com/jobs/acme', 8)])
  })
  const markdown = await readFile(index, 'utf8')
  assert.match(
    markdown,
    /<summary><strong>Nov 8<\/strong> <span>1 lead<\/span><\/summary>/
  )
  assert.ok(markdown.indexOf('Nov 8') < markdown.indexOf('Nov 7'))
  assert.match(markdown, /old reason/)
  await rm(root, { recursive: true })
})

it('a plan with no digest section still runs', async () => {
  const root = await scratch()
  const result = await run_scout({
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-08',
    spawn_pi: pi_writing([lead('https://vuejobs.com/jobs/acme', 8)])
  })
  assert.equal(result.fresh.length, 1)
  await rm(root, { recursive: true })
})

it('a source still being decided stops the run before pi starts', async () => {
  const root = await scratch()
  await writeFile(
    join(root, SCOUTS, 'Realness/Sources.md'),
    '# Sources\n\n## 1. Words\n\nRead things.\n'
  )
  let spawned = false
  await assert.rejects(
    run_scout({
      scout: 'realness',
      source: 'words',
      vault_dir: join(root, 'vault'),
      person: '/+1',
      date: '2026-11-05',
      spawn_pi: async () => {
        spawned = true
      }
    }),
    /Words names no page, command, or vault path/
  )
  assert.equal(spawned, false, 'pi never starts on an undecided source')
  await rm(root, { recursive: true })
})

it('a source that names no page gets a brief that says so', async () => {
  const root = await scratch()
  await writeFile(
    join(root, SCOUTS, 'Realness/Sources.md'),
    '# Sources\n\n## 1. Audit\n\nRun `npm audit --json`.\n'
  )
  let brief = ''
  await run_scout({
    scout: 'realness',
    source: 'audit',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    spawn_pi: async text => {
      brief = text
    }
  })
  assert.match(brief, /This source names no page/)
  assert.doesNotMatch(brief, /on each URL below/)
  await rm(root, { recursive: true })
})

it('a run that writes an empty page is a problem, not a silent zero', async () => {
  const root = await scratch()
  const result = await run_scout({
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    spawn_pi: async (_brief, run_dir) => {
      await writeFile(
        join(run_dir, 'finds.html'),
        '<section itemscope itemtype="/finds"></section>\n'
      )
      return 0
    }
  })
  assert.deepEqual(result.problems, [
    { item: 0, problem: 'the run wrote an empty page' }
  ])
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

const SOURCES = `# Sources

## 1. YC Work at a Startup

Start here.

    realness-read --site yc https://www.workatastartup.com/

## 2. VueJobs

https://vuejobs.com/jobs
`

it('a run reads one source, and its row names it', async () => {
  const root = await scratch()
  await writeFile(join(root, SCOUTS, 'Realness/Sources.md'), SOURCES)
  let brief = ''
  const result = await run_scout({
    scout: 'realness',
    source: 'vuejobs',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    spawn_pi: async text => {
      brief = text
    }
  })
  assert.match(brief, /This run reads one source: VueJobs/)
  assert.match(brief, /vuejobs\.com/)
  assert.doesNotMatch(brief, /workatastartup/)
  assert.match(
    brief,
    /Run `realness-read --brief <url>` on each\s+page below[\s\S]*- https:\/\/vuejobs\.com\/jobs/,
    'the brief names the URL to read'
  )
  assert.match(brief, /Read only the pages above\. Any other page ends the run/)
  const runs = read_items(
    await readFile(
      join(root, 'vault/Projects/Scouts/Realness/Runs/runs.html'),
      'utf8'
    ),
    'run'
  )
  assert.equal(runs.length, 1)
  assert.equal(runs[0].source, 'vuejobs')
  assert.equal(result.run_dir.includes('/Runs/'), true)
  await rm(root, { recursive: true })
})

it('a run is given its source URLs, and no other page is its own', async () => {
  const root = await scratch()
  await writeFile(join(root, SCOUTS, 'Realness/Sources.md'), SOURCES)
  let allowed = []
  await run_scout({
    scout: 'realness',
    source: 'vuejobs',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    spawn_pi: async (_brief, _run_dir, _staged, urls) => {
      allowed = urls
    }
  })
  assert.deepEqual(allowed, ['https://vuejobs.com/jobs'])
  await rm(root, { recursive: true })
})

it('two source runs the same day both keep their leads in the digest', async () => {
  const root = await scratch()
  await writeFile(join(root, SCOUTS, 'Realness/Sources.md'), SOURCES)
  const index = join(root, SCOUTS, 'Realness/index.md')
  await writeFile(
    index,
    '# Realness\n\n### Finds\n\n<small>Dimmed: scored below 6.</small>\n'
  )
  const options = {
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05'
  }
  await run_scout({
    ...options,
    source: 'yc-work-at-a-startup',
    spawn_pi: pi_writing([lead('https://example.com/acme', 8)])
  })
  await run_scout({
    ...options,
    source: 'vuejobs',
    spawn_pi: pi_writing([
      { ...lead('https://example.com/globex', 7), org: 'Globex' }
    ])
  })
  const markdown = await readFile(index, 'utf8')
  assert.match(markdown, /example\.com\/acme/)
  assert.match(markdown, /example\.com\/globex/)
  assert.equal((markdown.match(/<strong>Nov 5<\/strong>/g) ?? []).length, 1)
  await rm(root, { recursive: true })
})

it('runs that finish at once each keep their row and their find', async () => {
  const root = await scratch()
  const options = {
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05'
  }
  await Promise.all(
    [0, 1, 2, 3, 4].map(at =>
      run_scout({
        ...options,
        clock: () => 1794000000000 + at * 10,
        spawn_pi: pi_writing([lead(`https://example.com/${at}`, 7)])
      })
    )
  )
  const urls = (await finds_of(root)).map(find => find.url).sort()
  assert.deepEqual(urls, [
    'https://example.com/0',
    'https://example.com/1',
    'https://example.com/2',
    'https://example.com/3',
    'https://example.com/4'
  ])
  const runs = read_items(
    await readFile(
      join(root, 'vault/Projects/Scouts/Realness/Runs/runs.html'),
      'utf8'
    ),
    'run'
  )
  assert.equal(runs.length, 5)
  await rm(root, { recursive: true })
})

it('a run is on its page from the moment pi starts, so nothing chains a second', async () => {
  const root = await scratch()
  const page = join(root, 'vault/Projects/Scouts/Realness/Runs/runs.html')
  let during = []
  await run_scout({
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    spawn_pi: async () => {
      during = read_items(await readFile(page, 'utf8'), 'run')
    }
  })
  assert.equal(during.length, 1)
  assert.equal(during[0].ended, '')
  assert.equal(during[0].exit, '')
  assert.equal(
    scout_due({ status: 'active', per_day: 1 }, during, {
      date: during[0].started.slice(0, 10),
      now: Date.parse(during[0].started),
      running: true
    }),
    false
  )
  const after = read_items(await readFile(page, 'utf8'), 'run')
  assert.equal(after.length, 1)
  assert.notEqual(after[0].ended, '')
  await rm(root, { recursive: true })
})

it('a run times each stage and shows what it waited on', async () => {
  const root = await scratch()
  const page = join(root, 'vault/Projects/Scouts/Realness/Runs/runs.html')
  let at = 1794000000000
  let during = []
  await run_scout({
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    clock: () => (at += 1000),
    spawn_pi: async (brief, run_dir) => {
      during = read_items(await readFile(page, 'utf8'), 'run')
      at += 60000
      await writeFile(
        join(run_dir, 'finds.html'),
        item_html('find', lead('https://example.com/a', 8), { links: ['url'] })
      )
    }
  })
  assert.equal(during.length, 1)
  assert.match(during[0].stage, /^pi work since \d{4}-/)
  const [run] = read_items(await readFile(page, 'utf8'), 'run')
  assert.match(run.stages, /brief work \d{4}-/)
  assert.match(run.stages, /lock wait \d{4}-/)
  assert.match(run.stages, /pi work \d{4}-/)
  assert.match(run.stages, /write work \d{4}-/)
  assert.equal(run.stage, '')
  assert.equal(run.waited.endsWith('s'), true)
  assert.equal(run.worked.endsWith('s'), true)
  assert.equal(Number.parseFloat(run.worked) >= 60, true)
  await rm(root, { recursive: true })
})

it('a run splits pi into read, lease, and score by what pi recorded', async () => {
  const root = await scratch()
  const page = join(root, 'vault/Projects/Scouts/Realness/Runs/runs.html')
  const at = seconds => new Date(1794000000000 + seconds * 1000).toISOString()
  await run_scout({
    scout: 'realness',
    vault_dir: join(root, 'vault'),
    person: '/+1',
    date: '2026-11-05',
    spawn_pi: async (brief, run_dir) => {
      for (const record of [
        { at: Date.parse(at(0)), tool: '' },
        { at: Date.parse(at(3)), tool: 'realness-read --site yc' },
        { at: Date.parse(at(8)), tool: '' },
        { at: Date.parse(at(11)), tool: 'realness-chrome' }
      ])
        await append_item(join(run_dir, STAGES_PAGE), 'stage', record)
      await writeFile(
        join(run_dir, 'finds.html'),
        item_html('find', lead('https://example.com/a', 8), { links: ['url'] })
      )
    }
  })
  const [run] = read_items(await readFile(page, 'utf8'), 'run')
  assert.doesNotMatch(run.stages, /pi work/)
  assert.match(run.stages, /score work \d{4}-/)
  assert.match(run.stages, /read work \d{4}-/)
  assert.match(run.stages, /lease work \d{4}-/)
  assert.match(run.worked, /s$/)
  await rm(root, { recursive: true })
})

it('a later run that fails keeps the finds another run wrote first', async () => {
  const root = await scratch()
  await assert.rejects(
    run_scout({
      scout: 'realness',
      vault_dir: join(root, 'vault'),
      person: '/+1',
      date: '2026-11-06',
      spawn_pi: async () => {
        await save_finds(join(root, FINDS), 'Realness', [
          {
            itemid: '/+1/finds/9',
            url: 'https://example.com/late',
            status: 'new'
          }
        ])
        return 1
      }
    }),
    /the run failed/
  )
  assert.deepEqual(
    (await finds_of(root)).map(find => find.url),
    ['https://example.com/late']
  )
  await rm(root, { recursive: true })
})

it('a failed run keeps its row and its reason', async () => {
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
  const runs = read_items(
    await readFile(
      join(root, 'vault/Projects/Scouts/Realness/Runs/runs.html'),
      'utf8'
    ),
    'run'
  )
  assert.equal(runs.length, 1)
  assert.equal(runs[0].exit, '1')
  assert.match(runs[0].problems, /the run wrote no finds\.html/)
  assert.equal((await finds_of(root)).length, 0, 'a failed run adds no find')
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
  assert.match(brief, /Projects\/Scouts\/Realness\/Runs\/\S+\/finds\.html/)
  assert.match(brief, /This source names no page/)
  assert.match(brief, /Writing it ends the run/)
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
