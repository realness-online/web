import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdirSync as mkdir_sync, rmSync as rm_sync } from 'node:fs'
import { createServer as create_server } from 'node:net'
import { after, it } from 'node:test'
import { door_pass } from '#root/src/harness/recover.js'

const dir = new URL(
  `../../../../artifacts/realness/door-pass-${randomUUID().slice(0, 8)}/`,
  import.meta.url
).pathname
mkdir_sync(dir, { recursive: true })
after(() => rm_sync(dir, { recursive: true, force: true }))

/** A door that answers each request line with `reply(op)`. */
const door = reply =>
  new Promise(resolve => {
    const path = `${dir}${randomUUID().slice(0, 8)}.sock`
    const server = create_server(socket =>
      socket.on('data', chunk => {
        const { op } = JSON.parse(chunk.toString().split('\n')[0])
        socket.write(`${JSON.stringify(reply(op))}\n`)
      })
    )
    server.listen(path, () => resolve({ path, server }))
  })

const with_door = async (reply, run) => {
  const { path, server } = await door(reply)
  const before = process.env.REALNESS_DOOR
  process.env.REALNESS_DOOR = path
  try {
    return await run()
  } finally {
    if (before === undefined) delete process.env.REALNESS_DOOR
    else process.env.REALNESS_DOOR = before
    server.close()
  }
}

it('asks the unix door for the op it names, on either runtime', async () => {
  const pass = await with_door(
    op => ({ ok: true, pass: `pass-for-${op}` }),
    () => door_pass('harness-pass')
  )
  assert.equal(pass, 'pass-for-harness-pass')
})

it('a refusal from the door is the error', async () => {
  await with_door(
    () => ({ ok: false, error: 'not yours' }),
    () => assert.rejects(door_pass('harness-pass'), /not yours/)
  )
})

it('a launched recovery uses the pass it was given, not the door', async () => {
  process.env.REALNESS_RECOVERY_PASS = 'signed-at-launch'
  try {
    await with_door(
      () => assert.fail('the door was asked'),
      async () => assert.equal(await door_pass(), 'signed-at-launch')
    )
  } finally {
    delete process.env.REALNESS_RECOVERY_PASS
  }
})
