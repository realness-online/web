/**
 * Restore-fresh: mark a hosted Pi so a seed clone can prove it is fresh.
 *
 * Hosted actors are clones of one seed snapshot with Pi already running, and a
 * clone's Pi repeats the seed's random state. `realness-actor-init` replaces
 * that Pi after each restore (s1). This writes the pid, and what Pi's own
 * generators draw at startup; `control/test/random.check.js` compares clones.
 * Inert outside a hosted guest.
 */
import { randomBytes, randomUUID } from "node:crypto"
import { existsSync, rmSync, writeFileSync } from "node:fs"

const GUEST = "/run/realness"
const PID_FILE = "/run/realness/pi.pid"
const RANDOM_FILE = "/run/realness/pi-random"

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} _pi */
export default function (_pi) {
  if (!existsSync(GUEST)) return
  const draws = { math: Math.random(), uuid: randomUUID(), bytes: randomBytes(16).toString("hex") }
  writeFileSync(RANDOM_FILE, `${JSON.stringify(draws)}\n`)
  writeFileSync(PID_FILE, `${process.pid}\n`)
  process.on("exit", () => rmSync(PID_FILE, { force: true }))
}
