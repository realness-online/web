/**
 * The signed-in store commands, reached through their real entry point.
 *
 * `run_store` builds its own store from a token, so the network is the seam:
 * `client()` takes `fetch` from the global, so mocking it reaches `ls`, `cat`,
 * and `rm` without a sync service. What is left out is `login`, which opens a
 * browser and polls the sign-on service, and `logout`, which touches the real
 * keychain.
 */
import { it } from 'node:test'
import assert from 'node:assert/strict'
import { run_store } from '../../src/command/store-command.js'

const sink = () => {
  const chunks = []
  return {
    write: chunk => {
      chunks.push(String(chunk))
    },
    text: () => chunks.join('')
  }
}

const phone = '+15551234567'

const token_for = value =>
  `header.${Buffer.from(JSON.stringify(value)).toString('base64url')}.signature`

const signed_in = () => async () => token_for({ phone_number: phone })

const reply = (body, { status = 200 } = {}) => new Response(body, { status })

const routed_fetch = (t, handler) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    calls.push({ url: String(url), init })
    return handler(String(url), init)
  })
  return calls
}

/** Every option a non-actor command needs, with both streams captured. */
const run = (args, over = {}) => {
  const stdout = sink()
  const stderr = sink()
  return run_store(args, {
    stdout,
    stderr,
    get_token: signed_in(),
    ...over
  }).then(code => ({ code, stdout: stdout.text(), stderr: stderr.text() }))
}

it('an unknown command prints the usage and exits 2', async () => {
  const { code, stderr } = await run(['nope'])
  assert.equal(code, 2)
  assert.match(
    stderr,
    /usage: realness login\|logout\|whoami\|ls\|cat\|cp\|rm\|trash\|restore\|store sync/
  )
})

it('an actor may not log in or out; it uses halo-issued passes', async () => {
  for (const command of ['login', 'logout']) {
    const { code, stderr } = await run([command], { actor: true })
    assert.equal(code, 1)
    assert.match(stderr, /actors use halo-issued passes/)
  }
})

it('whoami names the masked phone, or says how to sign in', async () => {
  assert.equal((await run(['whoami'])).stdout, `Signed in as +1...67\n`)
  assert.equal(
    (await run(['whoami'], { get_token: async () => null })).stdout,
    'Not signed in; run realness login\n'
  )
})

it('ls lists folders before files, and defaults to the home folder', async t => {
  const calls = routed_fetch(t, () =>
    reply(JSON.stringify({ files: ['b.md'], folders: ['a'] }))
  )
  const { code, stdout } = await run(['ls'])
  assert.equal(code, 0)
  assert.equal(stdout, 'a/\nb.md\n')
  assert.match(calls[0].url, /people\/%2B15551234567\/$/)
  assert.equal(
    calls[0].init.headers.authorization,
    `Bearer ${token_for({ phone_number: phone })}`
  )
})

it('ls takes the folder it is given', async t => {
  const calls = routed_fetch(t, () =>
    reply(JSON.stringify({ files: [], folders: [] }))
  )
  await run(['ls', 'can://~/notes'])
  assert.match(calls[0].url, /people\/%2B15551234567\/notes\/$/)
})

it('cat writes the file out as it came', async t => {
  routed_fetch(t, () => reply('file contents'))
  const { code, stdout } = await run(['cat', 'can://~/a.md'])
  assert.equal(code, 0)
  assert.equal(stdout, 'file contents')
})

it('rm removes every path it was given, in order', async t => {
  const calls = routed_fetch(t, () => reply(null, { status: 204 }))
  const { code } = await run(['rm', 'can://~/a.md', 'can://~/b.md'])
  assert.equal(code, 0)
  assert.equal(calls.length, 2)
  assert.match(calls[0].url, /a\.md$/)
  assert.match(calls[1].url, /b\.md$/)
  assert.equal(calls[0].init.method, 'DELETE')
})

it('a typed failure names the status and adds its hint', async t => {
  routed_fetch(t, () => reply('', { status: 403 }))
  const { code, stderr } = await run(['rm', 'can://~/a.md'])
  assert.equal(code, 1)
  assert.match(stderr, /rm can:\/\/~\/a\.md: 403 - not yours to touch/)
})

it('a status with no hint is reported plain', async t => {
  routed_fetch(t, () => reply('', { status: 500 }))
  const { code, stderr } = await run(['cat', 'can://~/a.md'])
  assert.equal(code, 1)
  assert.equal(stderr, 'cat can://~/a.md: 500\n')
})

it('a home path needs a token that carries a phone number', async () => {
  const { code, stderr } = await run(['ls'], {
    get_token: async () => token_for({ sub: 'no-phone' })
  })
  assert.equal(code, 1)
  assert.match(stderr, /can:\/\/~ needs a token with a phone number/)
})

it('a token that cannot be decoded refuses the same way as one without a phone', async () => {
  const { code, stderr } = await run(['ls'], {
    get_token: async () => 'not-a-jwt'
  })
  assert.equal(code, 1)
  assert.match(stderr, /can:\/\/~ needs a token with a phone number/)
})
