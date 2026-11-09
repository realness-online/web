import assert from 'node:assert/strict'
import { test } from 'node:test'
import scout_mail, { DIGEST, send_owed } from './index.js'

/** A stand-in Pi that records the handlers an extension registers. */
const fake_pi = () => {
  const handlers = {}
  return { handlers, on: (name, handler) => (handlers[name] = handler) }
}

test('a halo session sends nothing: no Apple Mail on linux', async () => {
  const calls = []
  const mailed = await send_owed({
    platform: 'linux',
    exec: async (file, args) => calls.push({ file, args })
  })
  assert.equal(mailed, 0)
  assert.deepEqual(calls, [])
})

test('a Mac session hands the digest to the sender and counts what went', async () => {
  const calls = []
  const mailed = await send_owed({
    platform: 'darwin',
    exec: async (file, args) => {
      calls.push({ file, args })
      return { stdout: 'mailed 2\n' }
    }
  })
  assert.equal(mailed, 2)
  assert.deepEqual(calls, [{ file: process.execPath, args: [DIGEST, '--send'] }])
})

test('a sender that prints nothing is no run mailed, not a failure', async () => {
  assert.equal(await send_owed({ platform: 'darwin', exec: async () => ({ stdout: '' }) }), 0)
})

test('opening a session mails what is owed and says so', async () => {
  const pi = fake_pi()
  const said = []
  scout_mail(pi, { send: async () => 2 })
  assert.equal(typeof pi.handlers.session_start, 'function')
  await pi.handlers.session_start({}, { ui: { notify: line => said.push(line) } })
  assert.deepEqual(said, ['scout mail: mailed 2'])
})

test('a session that owes nothing says nothing', async () => {
  const pi = fake_pi()
  const said = []
  scout_mail(pi, { send: async () => 0 })
  await pi.handlers.session_start({}, { ui: { notify: line => said.push(line) } })
  assert.deepEqual(said, [])
})

test('a send that fails is one line, and the session opens anyway', async () => {
  const pi = fake_pi()
  const said = []
  scout_mail(pi, {
    send: async () => {
      throw new Error('Mail is not running')
    }
  })
  await pi.handlers.session_start({}, { ui: { notify: line => said.push(line) } })
  assert.deepEqual(said, ['scout mail: Mail is not running'])
})
