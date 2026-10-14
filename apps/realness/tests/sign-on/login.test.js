/**
 * `brayness login` with a fake browser, a fake keychain, and a fake Google
 * token endpoint. The real keychain is never touched here.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { login, refresh, token_source } from '#root/src/sign-on/node/login.js'

const memory = () => {
  let value = null
  return {
    read: async () => value,
    write: async v => (value = v),
    remove: async () => (value = null),
    peek: () => value
  }
}

const google =
  (calls = []) =>
  async (url, init) => {
    calls.push({ url, body: String(init.body) })
    const sent = new URLSearchParams(String(init.body))
    if (sent.get('refresh_token') === 'revoked')
      return new Response('', { status: 400 })
    return Response.json({
      id_token: `id-for-${sent.get('refresh_token')}`,
      refresh_token: 'rotated',
      expires_in: '3600'
    })
  }

/** A browser that follows the link and posts the given form to the callback. */
const browser =
  (form = state => ({ state, refresh_token: 'r1', api_key: 'k1' })) =>
  async url => {
    const link = new URL(url)
    const port = link.searchParams.get('cli')
    const state = link.searchParams.get('state')
    const response = await fetch(`http://127.0.0.1:${port}/callback`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form(state))
    })
    return response.status
  }

test('the link carries a loopback port and a long one-time state', async () => {
  let seen
  const store = memory()
  await login({
    sign_on: 'https://sign-on.local',
    store,
    fetcher: google(),
    open: async url => {
      seen = new URL(url)
      await browser()(url)
    }
  })
  assert.equal(seen.origin + seen.pathname, 'https://sign-on.local/sign-on')
  assert.match(seen.searchParams.get('cli'), /^\d{2,5}$/)
  assert.ok(seen.searchParams.get('state').length >= 32)
})

test('a matching sign-in lands in the keychain, refreshed once', async () => {
  const store = memory()
  const calls = []
  const result = await login({
    sign_on: 'https://sign-on.local',
    store,
    fetcher: google(calls),
    open: browser()
  })
  assert.equal(result.id_token, 'id-for-r1')
  assert.deepEqual(store.peek(), { refresh_token: 'rotated', api_key: 'k1' })
  assert.equal(calls.length, 1)
})

test('a sign-in with the wrong state is refused and never saved', async () => {
  const store = memory()
  let status
  const attempt = login({
    sign_on: 'https://sign-on.local',
    store,
    fetcher: google(),
    wait: 300,
    open: async url => {
      status = await browser(() => ({
        state: 'guessed',
        refresh_token: 'stolen',
        api_key: 'k'
      }))(url)
    }
  })
  await assert.rejects(attempt, /no sign-in within/)
  assert.equal(status, 400)
  assert.equal(store.peek(), null)
})

test('only POST /callback answers', async () => {
  await login({
    sign_on: 'https://sign-on.local',
    store: memory(),
    fetcher: google(),
    open: async url => {
      const port = new URL(url).searchParams.get('cli')
      assert.equal(
        (await fetch(`http://127.0.0.1:${port}/callback`)).status,
        404
      )
      assert.equal(
        (await fetch(`http://127.0.0.1:${port}/other`, { method: 'POST' }))
          .status,
        404
      )
      await browser()(url)
    }
  })
})

test('TOKEN wins; otherwise the keychain mints and caches a token', async () => {
  assert.equal(
    await token_source({ env: { TOKEN: 't' }, store: memory() })(),
    't'
  )

  const store = memory()
  await store.write({ refresh_token: 'r1', api_key: 'k1' })
  const calls = []
  const next = token_source({ env: {}, store, fetcher: google(calls) })
  assert.equal(await next(), 'id-for-r1')
  assert.equal(await next(), 'id-for-r1')
  assert.equal(calls.length, 1)
  assert.equal(store.peek().refresh_token, 'rotated')
})

test('no keychain entry means not signed in; a revoked one says to log in', async () => {
  assert.equal(await token_source({ env: {}, store: memory() })(), null)
  await assert.rejects(
    refresh({ refresh_token: 'revoked', api_key: 'k' }, google()),
    /brayness login/
  )
})
