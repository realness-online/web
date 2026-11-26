import assert from 'node:assert/strict'
import { mkdirSync as mkdir, mkdtempSync, readFileSync, writeFileSync as write } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { gunzipSync as gunzip, gzipSync as gzip } from 'node:zlib'
import session_clean from './index.js'

const SECRET = 'plain-looking-value-1234'

/** A harness root with one secret in an env file, and one session that holds it. */
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'session-clean-'))
  mkdir(join(root, 'apps/realness'), { recursive: true })
  write(join(root, 'apps/realness/.env.local'), `OPENAI_API_KEY=${SECRET}\n`)
  const file = join(root, 'vault/Sessions/one.html.gz')
  mkdir(join(root, 'vault/Sessions'), { recursive: true })
  write(file, gzip(`<p>key ${SECRET}</p>\n`))
  return { root, file }
}

const fake_pi = () => {
  const handlers = {}
  return { handlers, on: (name, fn) => (handlers[name] = fn) }
}

const context = file => ({ sessionManager: { getSessionFile: () => file } })

test('a turn that wrote a secret leaves it cleaned, and one copy', async () => {
  const { root, file } = fixture()
  const pi = fake_pi()
  session_clean(pi, { root })
  await pi.handlers.session_start(undefined, context(file))
  await pi.handlers.turn_end(undefined, context(file))
  assert.equal(gunzip(readFileSync(file)).toString('utf8'), '<p>key [secret]</p>\n')
})

test('a turn that wrote nothing new does not touch the file', async () => {
  const { root, file } = fixture()
  const pi = fake_pi()
  session_clean(pi, { root })
  await pi.handlers.session_start(undefined, context(file))
  await pi.handlers.turn_end(undefined, context(file))
  const bytes = readFileSync(file)
  await pi.handlers.turn_end(undefined, context(file))
  assert.deepEqual(readFileSync(file), bytes)
})

test('an appended secret is cleaned on the next turn', async () => {
  const { root, file } = fixture()
  const pi = fake_pi()
  session_clean(pi, { root })
  await pi.handlers.session_start(undefined, context(file))
  await pi.handlers.turn_end(undefined, context(file))
  write(file, Buffer.concat([readFileSync(file), gzip(`<p>${SECRET}</p>\n`)]))
  await pi.handlers.session_shutdown(undefined, context(file))
  assert.equal(gunzip(readFileSync(file)).toString('utf8'), '<p>key [secret]</p>\n<p>[secret]</p>\n')
})
