import {
  existsSync as exists_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import { writeFileDurable as write_file_durable } from './durable.js'
import { join } from 'node:path'
import { hostname } from 'node:os'
import { BadRequest } from './errors.js'
import { MS_PER_MINUTE } from '#root/lib/units.js'
import { escape, item_html } from '#root/lib/items.js'
/* eslint-disable no-await-in-loop -- each loop run finishes before the next starts */

const MAX_RUNS = 20

const GOAL_LIMIT = 4000
export const launch_argv = goal => [
  'systemd-run',
  '--unit=realness-loop',
  '--uid=realness',
  '--gid=realness',
  '--collect',
  '/usr/local/bin/realness-loop-run',
  goal
]
const LIVE = new Set(['starting', 'running'])
export const STOP_ARGV = ['systemctl', 'stop', 'realness-loop']

export const PROBE_ARGV = [
  'python3',
  '-c',
  `
import json
d = "/realness/work/loop"
def read(path, tail=0):
    try:
        with open(path, "rb") as f:
            if tail:
                f.seek(0, 2); f.seek(max(0, f.tell() - tail))
            return f.read().decode("utf8", "replace")
    except OSError:
        return ""
status = json.loads(read(d + "/status.json") or "{}")
runs = sum(1 for line in read(d + "/.auto/log.jsonl").splitlines() if '"run":' in line)
quota = "quota exceeded" in read(d + "/events.jsonl", 65536)
tail = read(d + "/.auto/log.jsonl", 16384).splitlines()[-20:]
print(json.dumps({"state": status.get("state"), "tokens": status.get("tokens", 0), "runs": runs, "quota": quota, "tail": tail}))
`
]

/** Why a running loop should stop now, or null. */
export const stop_reason = (
  probe,
  loop,
  { max_runs, deadline_ms, now = Date.now() }
) => {
  if (probe.state === 'exited') return 'exited'
  if (probe.quota) return 'quota'
  if (probe.runs >= max_runs) return 'runs'
  if (now - Date.parse(loop.started) >= deadline_ms) return 'deadline'
  return null
}

/**
 * One tracked loop, as saved in the loops file.
 * @typedef {object} LoopRecord
 * @property {string} [parent] absent on the record `report` returns
 * @property {number} depth
 * @property {string} [goal] absent on the record `report` returns
 * @property {string} status
 * @property {string} started
 * @property {string} [reason]
 * @property {number} [runs]
 * @property {number} [tokens]
 * @property {string[]} [tail] the last lines of the loop's own log
 * @property {string} [ended]
 * @property {string} [checked]
 * @property {string} [error]
 */

export class Loops {
  /** @type {import('./actors.js').ActorStore} */
  store
  /** @type {string} */
  file
  /** @type {number} */
  max_depth
  /** @type {number} */
  max_children
  /** @type {number} */
  max_runs
  /** @type {number} */
  deadline_ms
  /** @type {{ put: (path: string, body: string) => Promise<unknown>, get: (path: string) => Promise<unknown> } | null} */
  mirror
  /** @type {string} */
  halo
  /** @type {Record<string, LoopRecord>} */
  loops = {}
  /** @type {Promise<unknown>} */
  tail = Promise.resolve()

  /**
   * @param {import('./actors.js').ActorStore} store
   * @param {object} [options]
   * @param {string} [options.file]
   * @param {number} [options.max_depth]
   * @param {number} [options.max_children]
   * @param {number} [options.max_runs]
   * @param {number} [options.deadline_ms]
   * @param {{ put: (path: string, body: string) => Promise<unknown>, get: (path: string) => Promise<unknown> } | null} [options.mirror]
   * @param {string} [options.halo]
   */
  constructor(
    store,
    {
      file = join(store.volume, 'loops.json'),
      max_depth = Number(process.env.LOOP_MAX_DEPTH ?? 1),
      max_children = Number(process.env.LOOP_MAX_CHILDREN ?? 3),
      max_runs = Number(process.env.LOOP_MAX_RUNS ?? MAX_RUNS),
      deadline_ms = Number(process.env.LOOP_DEADLINE_MIN ?? 60) * MS_PER_MINUTE,
      mirror = null,
      halo = hostname()
    } = {}
  ) {
    Object.assign(this, {
      store,
      file,
      max_depth,
      max_children,
      max_runs,
      deadline_ms,
      mirror,
      halo
    })
    this.loops = exists_sync(file)
      ? JSON.parse(read_file_sync(file, 'utf8'))
      : {}
    this.tail = Promise.resolve()
  }

  depth(id) {
    return this.loops[id]?.depth ?? 0
  }

  children(id) {
    return Object.entries(this.loops).filter(
      ([, loop]) => loop.parent === id && LIVE.has(loop.status)
    )
  }

  /** One start at a time, so two requests cannot both pass the limits. */
  start(parent_id, goal) {
    const result = this.tail.then(() => this.#start(parent_id, goal))
    this.tail = result.catch(() => {})
    return result
  }

  async #start(parent_id, goal) {
    const parent = this.store.get(parent_id)
    if (!parent?.owner) throw new BadRequest('loop needs an owned actor')
    if (typeof goal !== 'string' || !goal.trim() || goal.length > GOAL_LIMIT)
      throw new BadRequest(`goal must be 1 to ${GOAL_LIMIT} characters`)
    const depth = this.depth(parent_id) + 1
    if (depth > this.max_depth)
      throw new BadRequest(`loops may nest ${this.max_depth} deep`)
    if (this.children(parent_id).length >= this.max_children)
      throw new BadRequest(`at most ${this.max_children} loops at once`)
    const record = await this.store.create(parent.owner)
    this.loops[record.id] = {
      parent: parent_id,
      depth,
      goal,
      status: 'starting',
      started: new Date().toISOString()
    }
    this.#save()
    const loop = this.loops[record.id]
    try {
      const { exit_code, stderr_b64 } = await this.store.exec(
        record.id,
        launch_argv(goal),
        { cwd: '/' }
      )
      if (exit_code !== 0)
        throw new Error(
          Buffer.from(stderr_b64 ?? '', 'base64')
            .toString()
            .trim() || `exit ${exit_code}`
        )
      loop.status = 'running'
      this.store.beginWork(record.id, 'loop')
    } catch (error) {
      Object.assign(loop, { status: 'failed', error: error.message })
      throw error
    } finally {
      this.#save()
      await this.#publish(record.id)
    }
    return { id: record.id, depth }
  }

  /**
   * What a parent may read of its loop: the halo's record and the last
   * probe's log tail. Never execs, so reading never wakes an idle loop.
   */
  report(parent_id, loop_id) {
    const loop = this.loops[loop_id]
    if (!loop || loop.parent !== parent_id) throw new BadRequest('no such loop')
    const report = { id: loop_id, ...loop }
    delete report.parent
    delete report.goal
    return report
  }

  /** One loop as an HTML item for the global admin view. */
  #record_html(id) {
    const loop = {
      id,
      halo: this.halo,
      owner: this.store.get(id)?.owner ?? '',
      ...this.loops[id]
    }
    const fields = [
      'id',
      'halo',
      'owner',
      'parent',
      'depth',
      'status',
      'reason',
      'runs',
      'tokens',
      'started',
      'ended',
      'checked',
      'error'
    ]
    return item_html(
      'loop',
      Object.fromEntries(fields.map(name => [name, loop[name] ?? ''])),
      { extra: `<p itemprop="goal">${escape(loop.goal)}</p>` }
    )
  }

  /** Mirror a loop to Storage; a failed write waits for the next change. */
  async #publish(id) {
    if (!this.mirror) return
    try {
      await this.mirror.put(`loops/${id}/record.html`, this.#record_html(id))
    } catch (error) {
      this.loops[id].error = `mirror: ${error.message}`
    }
  }

  async #stop_requested(id) {
    if (!this.mirror) return false
    try {
      return Boolean(await this.mirror.get(`loops/${id}/stop.html`))
    } catch {
      return false
    }
  }

  /** Every loop whose actor this owner holds, newest first. */
  of_owner(owner) {
    return this.all().filter(loop => loop.owner === owner)
  }

  /** Every loop on this halo with its owner; the admin view. */
  all() {
    return Object.entries(this.loops)
      .map(([id, { tail, ...loop }]) => ({
        id,
        owner: this.store.get(id)?.owner ?? null,
        ...loop
      }))
      .sort((a, b) => b.started.localeCompare(a.started))
  }

  /** One pass over running loops; each failure is its own. */
  async watch(now = Date.now()) {
    const stopped = []
    for (const [id, loop] of Object.entries(this.loops)) {
      if (loop.status !== 'running') continue
      this.store.beginWork(id, 'loop')
      try {
        if (await this.#stop_requested(id)) {
          await this.stop(id, 'admin')
          stopped.push({ id, reason: 'admin' })
          continue
        }
        const { exit_code, stdout_b64 } = await this.store.exec(
          id,
          PROBE_ARGV,
          { cwd: '/' }
        )
        if (exit_code !== 0) throw new Error(`probe exit ${exit_code}`)
        const probe = JSON.parse(Buffer.from(stdout_b64, 'base64').toString())
        Object.assign(loop, {
          runs: probe.runs,
          tokens: probe.tokens ?? 0,
          tail: Array.isArray(probe.tail) ? probe.tail : [],
          checked: new Date(now).toISOString()
        })
        const reason = stop_reason(probe, loop, {
          max_runs: this.max_runs,
          deadline_ms: this.deadline_ms,
          now
        })
        if (reason) {
          await this.stop(id, reason)
          stopped.push({ id, reason })
        }
      } catch (error) {
        loop.error = error.message
      }
      if (loop.status === 'running') await this.#publish(id)
    }
    this.#save()
    return stopped
  }

  async stop(id, reason) {
    const loop = this.loops[id]
    if (reason !== 'exited') await this.store.exec(id, STOP_ARGV, { cwd: '/' })
    Object.assign(loop, {
      status: 'stopped',
      reason,
      ended: new Date().toISOString()
    })
    this.#save()
    await this.#publish(id)
    this.store.endWork(id, 'loop')
    await this.store.idle(id)
  }

  #save() {
    write_file_durable(this.file, `${JSON.stringify(this.loops, null, 2)}\n`)
  }
}
