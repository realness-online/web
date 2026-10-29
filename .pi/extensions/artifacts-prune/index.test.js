import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, rmSync, writeFileSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import extension, { read_report } from './index.js'

const harness = fileURLToPath(new URL('../../..', import.meta.url))
const root = join(harness, 'artifacts', `prune-gate-test-${process.pid}`)
const stale = join(root, 'old/node_modules/pkg/index.js')

/** A prunable file under a scratch ARTIFACTS_ROOT, older than the grace window. */
const seed = () => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(join(root, 'old/node_modules/pkg'), { recursive: true })
  writeFileSync(join(root, 'old/package.json'), '{}')
  writeFileSync(stale, 'x')
  const old = new Date(Date.now() - 2 * 3_600_000)
  for (const path of [stale, join(root, 'old/node_modules/pkg'), join(root, 'old/node_modules'), join(root, 'old/package.json'), join(root, 'old')])
    utimesSync(path, old, old)
}

/** The extension's settled handler, with a fake UI that answers `answer`. */
const settle = ({ has_ui = true, answer = false } = {}) => {
  const asked = []
  const notes = []
  let handler
  extension({ on: (_name, fn) => (handler = fn) })
  const ctx = {
    cwd: harness,
    hasUI: has_ui,
    ui: {
      confirm: async (title, message) => (asked.push({ title, message }), answer),
      notify: (text, level) => notes.push({ text, level })
    }
  }
  return { asked, notes, run: () => handler({}, ctx) }
}

process.env.ARTIFACTS_ROOT = root

test('a report reads items, bytes, and a warning', () => {
  assert.deepEqual(read_report('would prune 3 item(s), freed 2048 bytes\nwarning: artifacts exceed 2000 MB (2100.0 MB)\n'), {
    items: 3,
    bytes: 2048,
    warning: 'artifacts exceed 2000 MB (2100.0 MB)'
  })
  assert.deepEqual(read_report(''), { items: 0, bytes: 0, warning: null })
})

test('without a UI nothing is said and nothing is removed', async () => {
  seed()
  const { notes, run } = settle({ has_ui: false })
  await run()
  assert.equal(notes.length, 0)
  assert.ok(existsSync(stale))
})

test('over the cap it says the next commit prunes, once, and removes nothing', async () => {
  seed()
  const { asked, notes, run } = settle()
  await run()
  await run()
  assert.equal(asked.length, 0)
  assert.equal(notes.length, 1)
  assert.match(notes[0].text, /next commit prunes 1 file\(s\)/)
  assert.ok(existsSync(stale))
  rmSync(root, { recursive: true, force: true })
})
