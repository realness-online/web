import assert from 'node:assert/strict'
import { it } from 'node:test'
import { report_note, report_path } from '#root/src/scouts/report.js'
const lead = (score, extra = {}) => ({
  url: `https://example.com/${score}`,
  title: 'Product Engineer',
  org: 'Acme',
  source: 'VueJobs',
  score,
  reason: 'small team, own the product',
  research: '[[acme]]',
  draft: '',
  ...extra
})

it('the note lands in the scout folder, dated', () => {
  assert.equal(
    report_path('/vault/Projects/Scouts/Realness', '2026-11-05'),
    '/vault/Projects/Scouts/Realness/Leads/2026-11-05.md'
  )
  assert.equal(
    report_path('/vault/Projects/Scouts/SMS', '2026-11-05'),
    '/vault/Projects/Scouts/SMS/Leads/2026-11-05.md'
  )
})

it('new leads come first, with their reason, then drafts', () => {
  const note = report_note({
    label: 'Realness',
    date: '2026-11-05',
    found: 2,
    fresh: [lead(8, { draft: 'Hello.\n\nI build this.' }), lead(4)],
    repeats: [],
    problems: [],
    seen: 10
  })
  assert.match(note, /^# Realness leads, 2026-11-05/)
  assert.match(note, /2 found, 2 new, 0 already seen\. The store held 10 leads/)
  assert.match(note, /## 8\.0 - Acme/)
  assert.match(note, /- why: small team, own the product/)
  assert.match(note, /## Drafts[\s\S]*> Hello\./)
  assert.match(note, /## Below the line[\s\S]*\| 4\.0 \| Acme \|/)
})

it('a lead below the research line is a row, not a draft', () => {
  const note = report_note({
    label: 'SMS',
    date: '2026-11-05',
    found: 1,
    fresh: [lead(5)],
    repeats: [lead(9)],
    problems: [{ item: 3, problem: 'no reason' }],
    seen: 4
  })
  assert.doesNotMatch(note, /## Leads/)
  assert.doesNotMatch(note, /## Drafts/)
  assert.match(note, /## Already seen/)
  assert.match(note, /## Records the run wrote wrong[\s\S]*item 3: no reason/)
})

it('a run with nothing new says so', () => {
  const note = report_note({
    label: 'Realness',
    date: '2026-11-05',
    found: 0,
    fresh: [],
    repeats: [],
    problems: [],
    seen: 0
  })
  assert.match(note, /No new leads\./)
})
