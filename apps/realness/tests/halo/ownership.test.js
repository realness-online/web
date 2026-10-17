import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'
import { makeServer } from '../../src/halo/server.js'

const secret = 'ownership-test-secret-at-least-thirty-two-bytes'
process.env.HALO_PASS_SECRET = secret

function pass(phone) {
  const body = Buffer.from(
    JSON.stringify({
      aud: 'realness-halo',
      phone,
      exp: Math.floor(Date.now() / 1000) + 240
    })
  ).toString('base64url')
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}

test('create and restore use only a verified owner', async () => {
  const calls = []
  const server = makeServer({
    create: async owner => {
      calls.push(['create', owner])
      return { id: 'a-one', owner }
    },
    restore: async (id, owner) => {
      calls.push(['restore', id, owner])
      return { id: 'a-two', owner }
    }
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const url = `http://127.0.0.1:${server.address().port}/v1/actors`
  const post = (authorization, body = {}) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authorization ? { authorization } : {})
      },
      body: JSON.stringify(body)
    })
  try {
    assert.equal((await post(null)).status, 401)
    assert.equal((await post('Bearer forged')).status, 401)
    assert.deepEqual(calls, [])
    assert.equal(
      (await post(`Bearer ${pass('+14155550123')}`, { owner: '+14155559999' }))
        .status,
      201
    )
    assert.equal(
      (
        await post(`Bearer ${pass('+14155550123')}`, {
          restore_from: 'a-one',
          owner: '+14155559999'
        })
      ).status,
      201
    )
    assert.deepEqual(calls, [
      ['create', '+14155550123'],
      ['restore', 'a-one', '+14155550123']
    ])
  } finally {
    server.closeAllConnections()
    await new Promise(done => server.close(done))
  }
})
