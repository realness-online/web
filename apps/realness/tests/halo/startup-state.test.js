import assert from 'node:assert/strict'
import { EventEmitter as event_emitter } from 'node:events'
import { test } from 'node:test'
import { startup_handlers } from '#root/src/halo/startup.js'

const owner = '+14155550123'

class Observer extends event_emitter {
  events = []
  destroyed = false
  writableEnded = false
  writable = true
  writeHead(status, headers) {
    this.status = status
    this.headers = headers
  }
  write(line) {
    this.events.push(JSON.parse(line))
    return this.writable
  }
  end() {
    this.writableEnded = true
    this.emit('close')
  }
  destroy() {
    this.destroyed = true
    this.emit('close')
  }
}

const deferred = () => {
  let resolve
  const promise = new Promise(done => {
    resolve = done
  })
  return { promise, resolve }
}

const settled = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

test('completed startup replay expires without starting new work', async () => {
  let now = 0
  let calls = 0
  const handlers = startup_handlers({
    clock: () => now,
    store: {
      list: () => [],
      create: async () => {
        calls++
        return { id: 'a-new' }
      }
    }
  })
  const observer = new Observer()
  handlers.start(owner, {}, observer)
  await settled()
  const startup_id = observer.events[0].startup_id
  now = 59_999
  const replay = new Observer()
  handlers.start(owner, { startup_id }, replay)
  assert.deepEqual(replay.events, observer.events)
  now = 60_000
  assert.throws(
    () => handlers.start(owner, { startup_id }, new Observer()),
    /startup/
  )
  assert.equal(calls, 1)
})

test('observer capacity and backpressure never cancel or duplicate startup', async () => {
  const waiting = deferred()
  let calls = 0
  const handlers = startup_handlers({
    store: {
      list: () => [],
      create: async () => {
        calls++
        return waiting.promise
      }
    }
  })
  const slow = new Observer()
  slow.writable = false
  handlers.start(owner, {}, slow)
  assert.equal(slow.destroyed, true)
  const observers = Array.from({ length: 16 }, () => new Observer())
  for (const observer of observers) handlers.start(owner, {}, observer)
  assert.throws(
    () => handlers.start(owner, {}, new Observer()),
    /too many startup observers/
  )
  observers[0].destroy()
  const replacement = new Observer()
  handlers.start(owner, {}, replacement)
  assert.equal(calls, 1)
  waiting.resolve({ id: 'a-ready' })
  await settled()
  assert.equal(replacement.events.at(-1).type, 'actor-ready')
  assert.equal(replacement.writableEnded, true)
})

test('retained operations are bounded and active operations are never evicted', async () => {
  const waiting = deferred()
  let calls = 0
  const handlers = startup_handlers({
    store: {
      list: () => [],
      create: async () => {
        calls++
        return waiting.promise
      }
    }
  })
  const observers = Array.from({ length: 128 }, () => new Observer())
  for (const [index, observer] of observers.entries())
    handlers.start(`+1415555${String(index).padStart(4, '0')}`, {}, observer)
  assert.throws(
    () => handlers.start('+14159999999', {}, new Observer()),
    /too many startups/
  )
  assert.equal(calls, 128)
  const startup_id = observers[0].events[0].startup_id
  const replay = new Observer()
  handlers.start('+14155550000', { startup_id }, replay)
  assert.deepEqual(replay.events, observers[0].events)
  waiting.resolve({ id: 'a-ready' })
  await settled()
  handlers.start('+14159999999', {}, new Observer())
  await settled()
  assert.equal(calls, 129)
  assert.throws(
    () => handlers.start('+14155550000', { startup_id }, new Observer()),
    /startup/
  )
})

test('replay retains only the latest bounded event window with stable sequence numbers', async () => {
  const handlers = startup_handlers({
    store: {
      list: () => [],
      async create(_, { startup }) {
        for (let stage_index = 0; stage_index < 80; stage_index++)
          startup.report({
            stage: 'checking_seed',
            state: 'starting',
            actor_id: 'a-new',
            stage_index,
            elapsed_ms: stage_index
          })
        return { id: 'a-new' }
      }
    }
  })
  const observer = new Observer()
  handlers.start(owner, {}, observer)
  await settled()
  const replay = new Observer()
  handlers.start(owner, { startup_id: observer.events[0].startup_id }, replay)
  assert.equal(observer.events.length, 82)
  assert.equal(replay.events.length, 64)
  assert.equal(replay.events[0].sequence, 18)
  assert.equal(replay.events.at(-1).sequence, 81)
})
