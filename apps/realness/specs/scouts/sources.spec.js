import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  find_source,
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

it('a Sources page with no sections is one unnamed source', () => {
  assert.deepEqual(source_sections('# Sources\n\nRead things.\n'), [])
})
