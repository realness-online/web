// Loops: an actor asks, through its door, for a sibling actor that works
// alone. The host keeps who started whom, so depth and fan-out stay bounded.
//
//   <volume>/loops.json   { "<loop id>": { parent, depth, goal, status, started } }
//
// Admin is global (a1j): each host mirrors its loop records to Storage,
//   loops/<id>/record.html   one /loop item, rewritten on every change
//   loops/<id>/stop.html     an admin's stop request; obeyed on the next probe
// Without sync (no SYNC_URL) the host runs loops alone.
//
// The host decides when a loop ends: the agent re-inits past autoresearch's
// own maxIterations (plans/brayness.md, a1a). watch() stops each loop at its
// run count, its deadline, or a spent quota, then idles the actor.

import { existsSync, readFileSync } from "node:fs"
import { writeFileDurable } from "./durable.js"
import { join } from "node:path"
import { hostname } from "node:os"
import { BadRequest } from "./errors.js"

const GOAL_LIMIT = 4000
// systemd-run detaches the loop from the exec channel and runs it as brayness.
export const launch_argv = (goal) => ["systemd-run", "--unit=brayness-loop", "--uid=brayness", "--gid=brayness", "--collect", "/usr/local/bin/brayness-loop-run", goal]
const LIVE = new Set(["starting", "running"])
export const STOP_ARGV = ["systemctl", "stop", "brayness-loop"]

// One exec reads the loop's state; argv only, no shell.
export const PROBE_ARGV = ["python3", "-c", `
import json
d = "/brayness/work/loop"
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
`]

/** Why a running loop should stop now, or null. */
export function stop_reason(probe, loop, { maxRuns, deadlineMs, now = Date.now() }) {
  if (probe.state === "exited") return "exited"
  if (probe.quota) return "quota"
  if (probe.runs >= maxRuns) return "runs"
  if (now - Date.parse(loop.started) >= deadlineMs) return "deadline"
  return null
}

export class Loops {
  constructor(store, { file = join(store.volume, "loops.json"), maxDepth = Number(process.env.LOOP_MAX_DEPTH ?? 1), maxChildren = Number(process.env.LOOP_MAX_CHILDREN ?? 3), maxRuns = Number(process.env.LOOP_MAX_RUNS ?? 20), deadlineMs = Number(process.env.LOOP_DEADLINE_MIN ?? 60) * 60_000, mirror = null, host = hostname() } = {}) {
    Object.assign(this, { store, file, maxDepth, maxChildren, maxRuns, deadlineMs, mirror, host })
    this.loops = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}
    this.tail = Promise.resolve()
  }

  depth(id) {
    return this.loops[id]?.depth ?? 0
  }

  children(id) {
    return Object.entries(this.loops).filter(([, loop]) => loop.parent === id && LIVE.has(loop.status))
  }

  /** One start at a time, so two requests cannot both pass the limits. */
  start(parent_id, goal) {
    const result = this.tail.then(() => this.#start(parent_id, goal))
    this.tail = result.catch(() => {})
    return result
  }

  async #start(parent_id, goal) {
    const parent = this.store.get(parent_id)
    if (!parent?.owner) throw new BadRequest("loop needs an owned actor")
    if (typeof goal !== "string" || !goal.trim() || goal.length > GOAL_LIMIT) throw new BadRequest(`goal must be 1 to ${GOAL_LIMIT} characters`)
    const depth = this.depth(parent_id) + 1
    if (depth > this.maxDepth) throw new BadRequest(`loops may nest ${this.maxDepth} deep`)
    if (this.children(parent_id).length >= this.maxChildren) throw new BadRequest(`at most ${this.maxChildren} loops at once`)
    const record = await this.store.create(parent.owner)
    this.loops[record.id] = { parent: parent_id, depth, goal, status: "starting", started: new Date().toISOString() }
    this.#save()
    const loop = this.loops[record.id]
    try {
      const { exit_code, stderr_b64 } = await this.store.exec(record.id, launch_argv(goal), { cwd: "/" })
      if (exit_code !== 0) throw new Error(Buffer.from(stderr_b64 ?? "", "base64").toString().trim() || `exit ${exit_code}`)
      loop.status = "running"
      this.store.beginWork(record.id) // the idle sweep leaves a working loop alone
    } catch (error) {
      Object.assign(loop, { status: "failed", error: error.message })
      throw error
    } finally {
      this.#save()
      await this.#publish(record.id)
    }
    return { id: record.id, depth }
  }

  /**
   * What a parent may read of its loop: the host's record and the last
   * probe's log tail. Never execs, so reading never wakes an idle loop.
   */
  report(parent_id, loop_id) {
    const loop = this.loops[loop_id]
    if (!loop || loop.parent !== parent_id) throw new BadRequest("no such loop")
    const { parent, goal, ...report } = loop
    return { id: loop_id, ...report }
  }

  /** One loop as an HTML item for the global admin view. */
  #record_html(id) {
    const loop = { id, host: this.host, owner: this.store.get(id)?.owner ?? "", ...this.loops[id] }
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
    const props = ["id", "host", "owner", "parent", "depth", "status", "reason", "runs", "tokens", "started", "ended", "checked", "error"]
      .map((name) => `<meta itemprop="${name}" content="${esc(loop[name])}">`).join("")
    return `<article itemscope itemtype="/loop">${props}<p itemprop="goal">${esc(loop.goal)}</p></article>\n`
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
    return this.all().filter((loop) => loop.owner === owner)
  }

  /** Every loop on this host with its owner; the admin view. */
  all() {
    return Object.entries(this.loops)
      .map(([id, { tail, ...loop }]) => ({ id, owner: this.store.get(id)?.owner ?? null, ...loop }))
      .sort((a, b) => b.started.localeCompare(a.started))
  }

  /** One pass over running loops; each failure is its own. */
  async watch(now = Date.now()) {
    const stopped = []
    for (const [id, loop] of Object.entries(this.loops)) {
      if (loop.status !== "running") continue
      this.store.beginWork(id) // again after a host restart
      try {
        if (await this.#stop_requested(id)) {
          await this.stop(id, "admin")
          stopped.push({ id, reason: "admin" })
          continue
        }
        const { exit_code, stdout_b64 } = await this.store.exec(id, PROBE_ARGV, { cwd: "/" })
        if (exit_code !== 0) throw new Error(`probe exit ${exit_code}`)
        const probe = JSON.parse(Buffer.from(stdout_b64, "base64").toString())
        Object.assign(loop, { runs: probe.runs, tokens: probe.tokens ?? 0, tail: Array.isArray(probe.tail) ? probe.tail : [], checked: new Date(now).toISOString() })
        const reason = stop_reason(probe, loop, { maxRuns: this.maxRuns, deadlineMs: this.deadlineMs, now })
        if (reason) {
          await this.stop(id, reason)
          stopped.push({ id, reason })
        }
      } catch (error) {
        loop.error = error.message
      }
      if (loop.status === "running") await this.#publish(id)
    }
    this.#save()
    return stopped
  }

  async stop(id, reason) {
    const loop = this.loops[id]
    if (reason !== "exited") await this.store.exec(id, STOP_ARGV, { cwd: "/" })
    Object.assign(loop, { status: "stopped", reason, ended: new Date().toISOString() })
    this.#save()
    await this.#publish(id)
    this.store.endWork(id)
    await this.store.idle(id)
  }

  #save() {
    writeFileDurable(this.file, `${JSON.stringify(this.loops, null, 2)}\n`)
  }
}
