/**
 * w1: the index reads a large vault a few notes at a time, so a cloud server
 * with little memory never holds every note at once.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import { vault_notes } from '#root/src/sync/vault-notes.js'

it('reads notes a few at a time, and indexes every one', async () => {
  const listed = Object.fromEntries(
    Array.from({ length: 100 }, (_, at) => [
      `n${at}.md`,
      { version: `v${at}`, updated: '2026-11-21T00:00:00Z' }
    ])
  )
  let open = 0
  let most = 0
  const source = {
    list: async () => listed,
    read: async path => {
      open += 1
      most = Math.max(most, open)
      await new Promise(done => setTimeout(done, 1))
      open -= 1
      return `# ${path}\n`
    }
  }
  const notes = vault_notes(source)
  await notes.ready()
  assert.equal(most, 16)
  assert.equal(notes.db.prepare('SELECT count(*) AS n FROM note').get().n, 100)
})
