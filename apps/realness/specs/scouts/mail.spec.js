import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { item_html } from '#root/lib/items.js'
import { digest_of, mail_digest, unmailed } from '#root/src/scouts/mail.js'
import { runs_path } from '#root/src/scouts/report.js'
import { load_runs, run_item, save_runs } from '#root/src/scouts/runs.js'
import { scout_page } from '#root/src/scouts/scout.js'

const NOW = Date.parse('2026-11-08T20:00:00.000Z')
const MINUTE = 60_000

const find = (url, score, org) =>
  item_html(
    'find',
    {
      url,
      title: org,
      org,
      source: 'News',
      score: String(score),
      reason: 'fits'
    },
    { links: ['url'] }
  )

/** One scout folder with a page, a run, and the finds that run wrote. */
const scratch = async ({ runs = [], finds = '' } = {}) => {
  const root = await mkdtemp(join(tmpdir(), 'scout-mail-'))
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
  for (const run of runs) {
    const stamp = run.itemid.split('/').at(-1)
    const run_dir = join(folder, 'Runs', `2026-11-08-${stamp}`)
    await mkdir(run_dir, { recursive: true })
    await writeFile(join(run_dir, 'finds.html'), finds)
  }
  const path = runs_path(folder)
  if (runs.length) await save_runs(path, 'SMS', runs)
  return { root, folder, path }
}

const run_of = (ms, started, fields = {}) =>
  run_item({
    itemid: `/+1/runs/${ms}`,
    scout: 'SMS',
    started,
    ended: started,
    exit: 0,
    leads: [],
    fresh: [],
    repeats: [],
    problems: [],
    ...fields
  })

it('a run inside the day and not yet mailed is owed', () => {
  const runs = [run_of('1', new Date(NOW - MINUTE).toISOString())]
  assert.equal(unmailed(runs, NOW).length, 1)
})

it('a mailed run, and one older than a day, is not owed', () => {
  const runs = [
    { ...run_of('1', new Date(NOW - MINUTE).toISOString()), mailed: 'yes' },
    run_of('2', new Date(NOW - 24 * 60 * MINUTE).toISOString())
  ]
  assert.equal(unmailed(runs, NOW).length, 0)
})

it('the digest carries each run and only the leads worth researching', async () => {
  const finds = [
    find('https://example.com/a', 8, 'Acme'),
    find('https://example.com/b', 3, 'Meh')
  ].join('\n')
  const { root, path } = await scratch({
    runs: [run_of('1794000000000', '2026-11-08T19:30:00.000Z')],
    finds
  })
  const digest = await digest_of({ vault_dir: join(root, 'vault'), now: NOW })
  assert.equal(digest.count, 1)
  assert.equal(digest.subject, 'Scouts: 1 run')
  assert.match(digest.body, /Scouts\/SMS: 0 new, 0 seen/)
  assert.match(digest.body, /8 Acme\n {4}https:\/\/example\.com\/a/)
  assert.doesNotMatch(digest.body, /Meh/)
  assert.equal((await load_runs(path))[0].mailed, undefined)
  await rm(root, { recursive: true })
})

it('a mailed digest stamps its runs after the send, and only then', async () => {
  const { root, path } = await scratch({
    runs: [run_of('1794000000000', '2026-11-08T19:30:00.000Z')]
  })
  const vault_dir = join(root, 'vault')
  let subject = ''
  await mail_digest({
    vault_dir,
    now: NOW,
    send: async value => {
      subject = value
    }
  })
  assert.equal(subject, 'Scouts: 1 run')
  assert.equal((await load_runs(path))[0].mailed, new Date(NOW).toISOString())
  assert.equal(
    await mail_digest({ vault_dir, now: NOW, send: async () => {} }),
    0
  )
  await rm(root, { recursive: true })
})

it('a send that fails leaves its runs owed, so the next try repeats them', async () => {
  const { root, path } = await scratch({
    runs: [run_of('1794000000000', '2026-11-08T19:30:00.000Z')]
  })
  const vault_dir = join(root, 'vault')
  await assert.rejects(
    mail_digest({
      vault_dir,
      now: NOW,
      send: async () => {
        throw new Error('mail refused')
      }
    }),
    /mail refused/
  )
  assert.equal((await load_runs(path))[0].mailed, undefined)
  await rm(root, { recursive: true })
})

it('nothing owed sends nothing', async () => {
  const { root } = await scratch()
  let sent = 0
  const count = await mail_digest({
    vault_dir: join(root, 'vault'),
    now: NOW,
    send: async () => {
      sent += 1
    }
  })
  assert.equal(count, 0)
  assert.equal(sent, 0)
  await rm(root, { recursive: true })
})
