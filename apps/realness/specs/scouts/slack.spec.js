import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  mark_posted,
  post_slack,
  slack_text,
  unposted_finds
} from '../../src/scouts/slack.js'

const finds = [
  { itemid: '1', score: '7', org: 'A', title: 'Ops', url: 'https://a.com' },
  {
    itemid: '2',
    score: '9',
    org: 'B & <C>',
    title: 'Data',
    url: 'https://b.com'
  },
  { itemid: '3', score: '5', org: 'Weak', title: 'x', url: 'https://w.com' },
  {
    itemid: '4',
    score: '10',
    org: 'Old',
    title: 'y',
    url: 'https://o.com',
    posted: '2026-11-19'
  }
]

it('every strong find not yet posted waits, best first', () => {
  assert.deepEqual(
    unposted_finds(finds).map(find => find.org),
    ['B & <C>', 'A']
  )
})

it('a posted find is stamped and waits no more', () => {
  const after = mark_posted(finds, unposted_finds(finds), '2026-11-20')
  assert.deepEqual(
    after.map(find => find.posted),
    ['2026-11-20', '2026-11-20', undefined, '2026-11-19']
  )
  assert.deepEqual(unposted_finds(after), [])
})

it('the post links each find and escapes Slack markup', () => {
  assert.equal(
    slack_text('seeq-leads', unposted_finds(finds)),
    '*seeq-leads* - 2 new\n' +
      '9 · <https://b.com|B &amp; &lt;C&gt; - Data>\n' +
      '7 · <https://a.com|A - Ops>'
  )
})

it('nothing waiting means no post', () => {
  assert.equal(slack_text('seeq-leads', []), '')
})

it('a refused webhook throws what Slack said', async () => {
  const fetcher = async () => new Response('no_service', { status: 404 })
  await assert.rejects(
    post_slack('https://hook', 'hi', fetcher),
    /404: no_service/
  )
})
