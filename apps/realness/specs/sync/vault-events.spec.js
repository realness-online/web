/**
 * s1: a vault write reaches an open page as one streamed event.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import { EventEmitter as event_emitter } from 'node:events'
import { is_vault_note, vault_events } from '#root/src/sync/vault-events.js'

const fake_response = () => {
  const response = new event_emitter()
  response.written = []
  response.head = null
  response.writeHead = (status, headers) => {
    response.head = { status, headers }
  }
  response.write = chunk => {
    response.written.push(chunk)
    return true
  }
  return response
}

it('an open page hears the path that changed', () => {
  const events = vault_events()
  const page = fake_response()
  events.listen(page)
  assert.equal(page.head?.headers['content-type'], 'text/event-stream')
  assert.equal(events.count(), 1)
  events.send('people/+1555/vault/Projects/realness-hosting.md')
  assert.equal(
    page.written.at(-1),
    `data: <article itemscope itemtype="/change"><dl><dt>path</dt><dd><span itemprop="path">people/+1555/vault/Projects/realness-hosting.md</span></dd></dl></article>\n\n`
  )
})

it('a closed page stops hearing', () => {
  const events = vault_events()
  const page = fake_response()
  events.listen(page)
  page.emit('close')
  assert.equal(events.count(), 0)
  events.send('people/+1555/vault/a.md')
  assert.equal(page.written.length, 1)
})

it('only a note under a vault counts as a vault write', () => {
  assert.equal(is_vault_note('people/+1555/vault/Projects/a.md'), true)
  assert.equal(is_vault_note('people/+1555/vault/Runs/x/pi.log'), false)
  assert.equal(is_vault_note('orgs/+sq/plans/a.md'), false)
})
