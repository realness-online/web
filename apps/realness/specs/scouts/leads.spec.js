import assert from 'node:assert/strict'
import { it } from 'node:test'
import { item_html } from '#root/lib/items.js'
import {
  at_least,
  highest_per_url,
  read_leads
} from '#root/src/scouts/leads.js'

const lead = (url, score) => ({
  url,
  score,
  reason: `reason for ${score}`
})

/** Finds as the run writes them. */
const page = values =>
  values.map(value => item_html('find', value, { links: ['url'] })).join('')

it('a lead needs a URL, a score in band, and a reason', () => {
  const { leads, problems } = read_leads(
    page([
      { url: 'https://example.com/role', score: 8, reason: 'named team' },
      { url: 'https://example.com/b', score: 11, reason: 'out of band' },
      { url: 'https://example.com/c', score: 7 },
      { score: 9, reason: 'no url' },
      { url: '/relative', score: 9, reason: 'not absolute' }
    ])
  )
  assert.equal(leads[0].score, 8)
  assert.equal(leads.length, 1)
  assert.deepEqual(
    problems.map(problem => problem.problem),
    ['score is not 0-10', 'no reason', 'no url', 'url is not absolute']
  )
})

it('one bad item does not lose the run, and anything else on the page is ignored', () => {
  const { leads, problems } = read_leads(
    `<p>notes</p>${page([{ score: 2 }, lead('https://a.com/1', 7)])}`
  )
  assert.equal(leads.length, 1)
  assert.deepEqual(problems, [{ item: 1, problem: 'no url' }])
})

it('the same opening keeps the better score', () => {
  const leads = highest_per_url([
    lead('https://vuejobs.com/jobs/acme?utm_source=news', 6),
    lead('https://vuejobs.com/jobs/acme', 9),
    lead('https://www.vuejobs.com/jobs/acme/', 7)
  ])
  assert.equal(leads.length, 1)
  assert.equal(leads[0].score, 9)
})

it('leads come back best first and the band filters them', () => {
  const { leads } = read_leads(
    page([
      lead('https://a.com/1', 4),
      lead('https://a.com/2', 9),
      lead('https://a.com/3', 7)
    ])
  )
  assert.deepEqual(
    leads.map(value => value.score),
    [9, 7, 4]
  )
  assert.deepEqual(
    at_least(leads, 6).map(value => value.url),
    ['https://a.com/2', 'https://a.com/3']
  )
})
