import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  find_source,
  hops_inside,
  origins_on,
  source_problem,
  source_sections,
  source_urls
} from '#root/src/scouts/sources.js'

const SOURCES = `# Sources

Read a page with realness-read.

## 1. YC Work at a Startup

Start here.

    realness-read --site yc https://www.workatastartup.com/

## 2. VueJobs

https://vuejobs.com/jobs

## 3. Hacker News

https://hn.algolia.com/api/v1/search

## Already seen

A note, not a place to look.

## Out

Staffing agencies with no named client.
`

it('each numbered heading is its own source, and a note is not', () => {
  const sections = source_sections(SOURCES)
  assert.deepEqual(
    sections.map(source => source.key),
    ['yc-work-at-a-startup', 'vuejobs', 'hacker-news']
  )
  assert.deepEqual(
    sections.map(source => source.title),
    ['YC Work at a Startup', 'VueJobs', 'Hacker News']
  )
})

it('a source carries its heading and its text, and nothing of the others', () => {
  const [yc, vuejobs] = source_sections(SOURCES)
  assert.match(yc.text, /^## 1\. YC Work at a Startup/)
  assert.match(yc.text, /realness-read --site yc/)
  assert.doesNotMatch(yc.text, /vuejobs\.com/)
  assert.doesNotMatch(vuejobs.text, /workatastartup/)
})

it('a run names the source it reads, and a wrong name lists the right ones', () => {
  const sections = source_sections(SOURCES)
  assert.equal(find_source(sections, 'vuejobs').key, 'vuejobs')
  assert.throws(
    () => find_source(sections, 'indeed'),
    /try yc-work-at-a-startup/
  )
})

it('a section names its URLs once, in order, without trailing punctuation', () => {
  assert.deepEqual(
    source_urls('see https://a.test/x, https://b.test/y. and https://a.test/x'),
    ['https://a.test/x', 'https://b.test/y']
  )
})

it('a source is ready when it names its pages, its command, or the vault', () => {
  const ready = [
    '## 1. Board\n\nhttps://a.test/jobs\n',
    '## 2. Audit\n\nRun `npm audit --json` in `apps/realness`.\n',
    '## 3. Known\n\n`Realness/Companies/` lists what was tried.\n',
    '## 4. Board\n\n    realness-read --site yc https://a.test/\n'
  ]
  for (const text of ready)
    assert.equal(source_problem(source_sections(text)[0]), '')
})

it('a source still being decided is refused, and says which one and why', () => {
  const cases = [
    [
      '## 1. Words\n\nRead things.\n',
      /Words names no page, command, or vault path/
    ],
    ['## 2. Empty\n', /Empty says nothing to read/],
    [
      '## 3. Feeds\n\n- `.../rss/search?q=one`\n',
      /Feeds leaves a URL half-written/
    ]
  ]
  for (const [text, expected] of cases)
    assert.match(source_problem(source_sections(text)[0]), expected)
})

it('a Sources page with no sections is one unnamed source', () => {
  assert.deepEqual(source_sections('# Sources\n\nRead things.\n'), [])
})

it('the origins a page links to, each once', () => {
  const page =
    '[a](https://company.test/news) [b](https://company.test/about) <a href="https://other.test/x">c</a>'
  assert.deepEqual(origins_on(page), [
    'https://company.test',
    'https://other.test'
  ])
})

it('a page on an origin the run read a link from is a hop inside', () => {
  assert.equal(
    hops_inside('https://company.test/leadership', ['https://company.test']),
    true
  )
  assert.equal(
    hops_inside('https://elsewhere.test/leadership', ['https://company.test']),
    false
  )
})
