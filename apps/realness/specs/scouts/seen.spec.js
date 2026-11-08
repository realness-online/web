import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { key_of } from '#root/src/scouts/leads.js'
import {
  load_finds,
  save_finds,
  split_fresh,
  with_finds
} from '#root/src/scouts/seen.js'

const scratch = () => mkdtemp(join(tmpdir(), 'scout-seen-'))

it('a finds page that does not exist is a scout that has not run', async () => {
  const dir = await scratch()
  assert.deepEqual(await load_finds(join(dir, 'Finds/finds.html')), [])
  await rm(dir, { recursive: true })
})

it('a URL compares without scheme, www, tracking query, or trailing slash', () => {
  assert.equal(
    key_of('https://www.VueJobs.com/jobs/acme/?utm_source=x#top'),
    'vuejobs.com/jobs/acme'
  )
})

it('two posts on one page address are two leads', () => {
  assert.notEqual(
    key_of('https://news.ycombinator.com/item?id=50351981'),
    key_of('https://news.ycombinator.com/item?id=50348145')
  )
  assert.equal(
    key_of('https://news.ycombinator.com/item?ref=x&id=1'),
    key_of('https://news.ycombinator.com/item?id=1')
  )
})

it('a repeat is caught even through a tracking link', () => {
  const finds = [{ url: 'https://vuejobs.com/jobs/acme' }]
  const { fresh, repeats } = split_fresh(finds, [
    { url: 'https://www.vuejobs.com/jobs/acme/?ref=newsletter', score: 8 },
    { url: 'https://vuejobs.com/jobs/other', score: 7 }
  ])
  assert.deepEqual(
    fresh.map(lead => lead.url),
    ['https://vuejobs.com/jobs/other']
  )
  assert.equal(repeats.length, 1)
})

it('fresh finds join the page as new items; earlier finds keep their status', async () => {
  const dir = await scratch()
  const path = join(dir, 'Finds/finds.html')
  const before = [
    { itemid: '/+1/finds/1', url: 'https://b.com/2', status: 'passed' }
  ]
  const after = with_finds(
    before,
    [
      {
        url: 'https://a.com/1',
        title: 'Engineer',
        org: 'A & Co',
        source: 'HN',
        score: 8,
        reason: 'small <team>',
        node: 'p1'
      }
    ],
    { person: '/+1', now: Date.parse('2026-11-06T12:00:00Z') }
  )
  await save_finds(path, 'Realness', after)
  const read = await load_finds(path)
  assert.deepEqual(read[0], before[0])
  assert.deepEqual(read[1], {
    itemid: `/+1/finds/${Date.parse('2026-11-06T12:00:00Z')}`,
    url: 'https://a.com/1',
    title: 'Engineer',
    org: 'A & Co',
    source: 'HN',
    score: '8',
    reason: 'small <team>',
    node: 'p1',
    found: '2026-11-06',
    status: 'new'
  })
  assert.match(
    await readFile(path, 'utf8'),
    /^<!doctype html>\n<title>Realness finds<\/title>/
  )
  await rm(dir, { recursive: true })
})
