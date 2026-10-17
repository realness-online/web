import { randomUUID as random_uuid } from 'node:crypto'
import { can } from '#root/src/can/can.js'
import { BadRequest, Busy, NotFound } from './errors.js'

const HTTP_OK = 200
const RETAIN_MS = 60_000
const OPERATION_LIMIT = 128
const EVENT_LIMIT = 64
const WATCHER_LIMIT = 16
const NDJSON = {
  'content-type': 'application/x-ndjson; charset=utf-8',
  'cache-control': 'no-store',
  'x-accel-buffering': 'no'
}

/** Bound slow observers without interrupting the shared startup. */
const send = (response, event) => {
  if (response.destroyed || response.writableEnded) return
  if (!response.write(`${JSON.stringify(event)}\n`)) response.destroy()
}

/** Owner-scoped startup jobs; reconnect replays real events, never wakes an actor again. */
export const startup_handlers = ({
  store,
  clock = () => performance.now()
}) => {
  const operations = new Map()
  const pending = new Map()
  const key = (owner, actor) => `${owner}:${actor ?? 'new'}`
  const remove_pending = operation => {
    for (const [target, current] of pending)
      if (current === operation) pending.delete(target)
  }
  const prune = () => {
    for (const [id, operation] of operations)
      if (
        operation.ended_at !== null &&
        clock() - operation.ended_at >= RETAIN_MS
      )
        operations.delete(id)

    if (operations.size < OPERATION_LIMIT) return
    const oldest = [...operations.values()].find(
      operation => operation.ended_at !== null
    )
    if (oldest) operations.delete(oldest.id)
    else throw new Busy('too many startups')
  }
  const publish = (operation, fields) => {
    const event = {
      ...fields,
      startup_id: operation.id,
      sequence: operation.sequence++
    }
    if (operation.events.length === EVENT_LIMIT) operation.events.shift()
    operation.events.push(event)
    for (const response of operation.watchers) send(response, event)
  }
  const finish = operation => {
    operation.ended_at = clock()
    remove_pending(operation)
    for (const response of operation.watchers) response.end()
    operation.watchers.clear()
  }
  const run = async operation => {
    const startup = {
      id: operation.id,
      started_at: operation.started_at,
      report: event => {
        operation.actor_id = event.actor_id
        pending.set(key(operation.owner, event.actor_id), operation)
        publish(operation, { type: 'startup-stage', ...event })
      }
    }
    try {
      const created = operation.actor_id === null
      const record = created
        ? await store.create(operation.owner, { startup })
        : await store.ensureRunning(operation.actor_id, { startup })
      publish(operation, {
        type: 'actor-ready',
        actor_id: record.id,
        created,
        elapsed_ms: clock() - operation.started_at
      })
    } catch {
      publish(operation, {
        type: 'error',
        text: 'Actor startup failed',
        elapsed_ms: clock() - operation.started_at
      })
    } finally {
      finish(operation)
    }
  }
  const observe = (operation, response) => {
    if (operation.watchers.size >= WATCHER_LIMIT)
      throw new Busy('too many startup observers')
    response.writeHead(HTTP_OK, NDJSON)
    response.once('close', () => operation.watchers.delete(response))
    for (const event of operation.events) send(response, event)
    if (operation.ended_at !== null) return response.end()
    if (!response.destroyed) operation.watchers.add(response)
  }

  return {
    start(owner, payload, response) {
      const { actor: requested, startup_id } = payload
      if (
        requested !== undefined &&
        (typeof requested !== 'string' || !requested)
      )
        throw new BadRequest('actor must be an actor id')
      if (
        startup_id !== undefined &&
        (typeof startup_id !== 'string' || !startup_id)
      )
        throw new BadRequest('startup_id must be a startup id')
      if (startup_id !== undefined) {
        const operation = operations.get(startup_id)
        if (
          !operation ||
          operation.owner !== owner ||
          (operation.ended_at !== null &&
            clock() - operation.ended_at >= RETAIN_MS)
        )
          throw new NotFound('startup')
        if (requested !== undefined && requested !== operation.actor_id)
          throw new NotFound('startup')
        const path = `people/${owner}/harnesses${operation.actor_id ? `/${operation.actor_id}` : ''}`
        if (!can({ phone: owner }, 'write', path)) throw new NotFound('startup')
        return observe(operation, response)
      }
      const owned = store
        .list()
        .filter(
          record =>
            record.owner === owner &&
            can(
              { phone: owner },
              'get',
              `people/${owner}/harnesses/${record.id}`
            )
        )
      const when = record =>
        String(record.last_activity || record.created || '')
      const record =
        requested === undefined
          ? owned.sort((a, b) => when(b).localeCompare(when(a)))[0]
          : owned.find(record => record.id === requested)
      if (requested !== undefined && !record) throw new NotFound('actor')
      const target = record?.id ?? null
      if (
        !can(
          { phone: owner },
          'write',
          `people/${owner}/harnesses${target ? `/${target}` : ''}`
        )
      )
        throw new NotFound('actor')
      const existing = pending.get(key(owner, target))
      if (existing) return observe(existing, response)
      prune()
      const operation = {
        id: random_uuid(),
        owner,
        actor_id: target,
        started_at: clock(),
        ended_at: null,
        sequence: 0,
        events: [],
        watchers: new Set()
      }
      operations.set(operation.id, operation)
      pending.set(key(owner, target), operation)
      publish(operation, { type: 'startup', actor_id: target, elapsed_ms: 0 })
      observe(operation, response)
      void run(operation)
    }
  }
}
