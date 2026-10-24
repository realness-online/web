import assert from 'node:assert/strict'
import { createSign, generateKeyPairSync } from 'node:crypto'
import { it } from 'node:test'
import { phone_identity } from '../../src/proxy/identity.js'

const project = 'realness-test'
const phone = '+14155550123'
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048
})
const certs = async () => ({
  test: publicKey.export({ type: 'spki', format: 'pem' })
})
const json = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const sign = uid => {
  const now = Math.floor(Date.now() / 1000)
  const body = `${json({ alg: 'RS256', kid: 'test' })}.${json({ aud: project, iss: `https://securetoken.google.com/${project}`, sub: uid, phone_number: phone, iat: now, auth_time: now, exp: now + 3600 })}`
  const signature = createSign('RSA-SHA256')
    .update(body)
    .sign(privateKey)
    .toString('base64url')
  return `${body}.${signature}`
}

it('phone identity shares the sync pin; recycled number is refused', async () => {
  let pinned
  const token = async () => 'storage-token'
  const original = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    assert.match(url, /storage.googleapis.com/)
    assert.equal(options.headers.authorization, 'Bearer storage-token')
    if (options.method === 'POST') {
      if (pinned) return new Response('', { status: 412 })
      pinned = Buffer.from(options.body).toString()
      return Response.json({ generation: '1' })
    }
    return new Response(pinned)
  }
  try {
    const identify = phone_identity({
      project,
      bucket: 'test-pins',
      token,
      certs
    })
    assert.deepEqual(await identify(sign('first')), { phone })
    assert.deepEqual(await identify(sign('first')), { phone })
    await assert.rejects(identify(sign('second')), /another uid/)
    await assert.rejects(identify('shared-pass'), /not a JWT/)
  } finally {
    globalThis.fetch = original
  }
})
