import { it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer as create_server } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { disk } from '../../src/can/disk.js'
import { out_path } from '../../src/settings/output.js'
import { verify_token } from '../../src/can/identity.js'
import { phone_identity } from '../../src/proxy/identity.js'
import {
  sign_in_issuer,
  issuer_for,
  uid_for
} from '../../src/sign-in/issuer.js'
import { sign_in_handler } from '../../src/sign-in/server.js'

const project = 'demo-realness'
const phone = '+16282281824'

/** A running sign-in service on a free port, its storage on disk. */
const service = async t => {
  const dir = await mkdtemp(out_path('sign-in-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const storage = disk(dir)
  const issuer = await sign_in_issuer(storage, { project })
  const sent = []
  const server = create_server(
    sign_in_handler({
      issuer,
      storage,
      deliver: (to, code) => void sent.push({ to, code })
    })
  )
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  t.after(() => new Promise(done => server.close(done)))
  const url = `http://127.0.0.1:${server.address().port}`
  const post = (path, body) =>
    fetch(`${url}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  return { url, post, sent, storage, issuer, dir }
}

it('a texted code signs in, and every service accepts the token', async t => {
  const { url, post, sent } = await service(t)
  assert.equal((await post('/code', { phone })).status, 202)
  assert.equal(sent.length, 1)
  assert.match(sent[0].code, /^\d{6}$/)

  const reply = await post('/token', { phone, code: sent[0].code })
  assert.equal(reply.status, 200)
  const { id_token, refresh_token } = await reply.json()

  const certs = async () => (await fetch(`${url}/certs`)).json()
  const who = await verify_token(id_token, {
    project,
    certs,
    issuer: issuer_for(project)
  })
  assert.deepEqual(who, { uid: uid_for(phone), phone })

  const pin_dir = await mkdtemp(out_path('sign-in-pins-'))
  t.after(() => rm(pin_dir, { recursive: true, force: true }))
  const identify = phone_identity({
    project,
    storage: disk(pin_dir),
    certs,
    issuer: issuer_for(project)
  })
  assert.deepEqual(await identify(id_token), { phone })

  const renewed = await post('/refresh', { refresh_token })
  assert.equal(renewed.status, 200)
  assert.equal((await renewed.json()).phone, phone)
})

it('Firebase-issued tokens fail against Realness sign-in', async t => {
  const { post, sent, issuer } = await service(t)
  await post('/code', { phone })
  const { id_token } = await (
    await post('/token', { phone, code: sent[0].code })
  ).json()
  await assert.rejects(
    verify_token(id_token, { project, certs: issuer.certs }),
    /wrong issuer/
  )
})

it('wrong codes fail, and five misses burn the code', async t => {
  const { post, sent } = await service(t)
  await post('/code', { phone })
  const { code } = sent[0]
  const wrong = code === '000000' ? '000001' : '000000'
  for (let i = 0; i < 5; i++)
    assert.equal((await post('/token', { phone, code: wrong })).status, 401)
  assert.equal((await post('/token', { phone, code })).status, 401)
})

it('a code works once', async t => {
  const { post, sent } = await service(t)
  await post('/code', { phone })
  assert.equal(
    (await post('/token', { phone, code: sent[0].code })).status,
    200
  )
  assert.equal(
    (await post('/token', { phone, code: sent[0].code })).status,
    401
  )
})

it('signing out ends the session', async t => {
  const { post, sent } = await service(t)
  await post('/code', { phone })
  const { refresh_token } = await (
    await post('/token', { phone, code: sent[0].code })
  ).json()
  assert.equal((await post('/sign-out', { refresh_token })).status, 204)
  assert.equal((await post('/refresh', { refresh_token })).status, 401)
})

it('the signing key survives a restart', async t => {
  const { storage, issuer } = await service(t)
  const again = await sign_in_issuer(storage, { project })
  assert.deepEqual(await again.certs(), await issuer.certs())
})

it('bad numbers get no code', async t => {
  const { post, sent } = await service(t)
  assert.equal((await post('/code', { phone: '555' })).status, 400)
  assert.equal(sent.length, 0)
})
