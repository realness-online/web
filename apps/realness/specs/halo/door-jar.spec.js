import assert from 'node:assert/strict'
import { mkdirSync as mkdir_sync, mkdtempSync, rmSync } from 'node:fs'
import { connect } from 'node:net'
import { join } from 'node:path'
import { it } from 'node:test'
import { out_path } from '#root/lib/output.js'
import { Door } from '../../src/halo/door.js'

mkdir_sync(out_path(), { recursive: true })

const COOKIE = {
  name: 'yc',
  value: 'abc',
  domain: '.workatastartup.com',
  path: '/'
}

/** A door for one box, holding that box's owner's jars, if it has any. */
const door_of = jar => {
  const root = mkdtempSync(out_path('door-jar-'))
  const record = {
    id: 'a-abcdef123456',
    owner: '+14155550123',
    vsock_path: join(root, 'vsock.sock')
  }
  const store = {
    live_actors: () => [record],
    get: () => record
  }
  const wrote = []
  const jars = jar && {
    load: async (who, site) => {
      wrote.push(['load', who, site])
      return jar
    },
    save: async (who, site, cookies) => wrote.push(['save', who, site, cookies])
  }
  const door = new Door(store, '/s/{id}/', null, jars)
  return { door, record, wrote, root }
}

/** One request to the door, answered as the box sees it. */
const open = async (door, record) => {
  door.reconcile()
  const { path, server } = door.listeners.get(record.id)
  await new Promise(done =>
    server.listening ? done() : server.once('listening', done)
  )
  return {
    send: value =>
      new Promise((done, fail) => {
        const socket = connect(path)
        socket.once('error', fail)
        socket.once('connect', () => socket.write(`${JSON.stringify(value)}\n`))
        let answer = ''
        socket.on('data', data => {
          answer += data.toString()
        })
        socket.once('end', () => done(JSON.parse(answer)))
      }),
    close: () => new Promise(done => server.close(done))
  }
}

it('a box takes its saved login and gives it back', async t => {
  const { door, record, wrote, root } = door_of([COOKIE])
  const { send, close } = await open(door, record)
  t.after(async () => {
    await close()
    rmSync(root, { recursive: true, force: true })
  })
  assert.deepEqual(await send({ op: 'site-cookies', site: 'yc' }), {
    ok: true,
    cookies: [COOKIE]
  })
  const back = await send({ op: 'site-cookies', site: 'yc', save: [COOKIE] })
  assert.deepEqual(back, { ok: true, saved: 1 })
  assert.deepEqual(wrote, [
    ['load', '+14155550123', 'yc'],
    ['save', '+14155550123', 'yc', [COOKIE]]
  ])
})

it('a site that is not a slug is refused', async t => {
  const { door, record, root } = door_of([COOKIE])
  const { send, close } = await open(door, record)
  t.after(async () => {
    await close()
    rmSync(root, { recursive: true, force: true })
  })
  const got = await send({ op: 'site-cookies', site: '../etc/passwd' })
  assert.equal(got.ok, false)
  assert.match(got.error, /site must be a short slug/)
})

it('a halo with no jars refuses the read', async t => {
  const { door, record, root } = door_of(null)
  const { send, close } = await open(door, record)
  t.after(async () => {
    await close()
    rmSync(root, { recursive: true, force: true })
  })
  const got = await send({ op: 'site-cookies', site: 'yc' })
  assert.equal(got.ok, false)
  assert.match(got.error, /no cookie jars/)
})

it('the halo reads no pages; a box reads its own', async t => {
  const { door, record, root } = door_of(null)
  const { send, close } = await open(door, record)
  t.after(async () => {
    await close()
    rmSync(root, { recursive: true, force: true })
  })
  const got = await send({ op: 'read', url: 'https://example.com/' })
  assert.equal(got.ok, false)
  assert.match(got.error, /unknown op 'read'/)
})
