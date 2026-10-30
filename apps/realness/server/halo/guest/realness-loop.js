#!/usr/bin/env node
/**
 * realness loop - hand long work to a loop in its own actor.
 *
 *     realness loop "<goal>"        start a loop; prints its id
 *     realness loop report <id>     its status, runs, stop reason, log tail
 *
 * Asks the halo through the door. The halo bounds depth, fan-out, runs, and
 * time; see vault/Projects/realness.md.
 */
import { ask_ok, exit } from './realness-door.js'

const USAGE = 'usage: realness loop "<goal>" | realness loop report <id>'
const args = process.argv.slice(2)

if (args.length === 2 && args[0] === 'report') {
  const reply = await ask_ok(
    'realness loop',
    { op: 'loop-report', id: args[1] },
    { timeout_ms: 30_000 }
  )
  process.stdout.write(`${JSON.stringify(reply.loop, null, 2)}\n`)
} else if (args.length === 1 && !['-h', '--help', 'report'].includes(args[0])) {
  const reply = await ask_ok(
    'realness loop',
    { op: 'loop', goal: args[0] },
    { timeout_ms: 300_000 }
  )
  process.stdout.write(`loop ${reply.id} started\n`)
  process.stdout.write(`realness loop report ${reply.id}\n`)
} else exit(USAGE)
