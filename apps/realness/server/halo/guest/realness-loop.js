#!/usr/bin/env node
/**
 * realness loop - hand long work to a loop in its own actor.
 *
 *     realness loop "<goal>"        start a loop; prints its id
 *     realness loop report <id>     its status, runs, stop reason, log tail
 *     realness loop scout <name>    run a plan's scout once, in a loop actor
 *     realness loop scout <name> --source <key>
 *                                   run one source of it, and nothing else
 *     realness loop scout <name> --probe
 *                                   check the gates and one YC read, run nothing
 *     realness loop scouts          run every active scout, each in its own loop
 *
 * Asks the halo through the door. The halo bounds depth, fan-out, runs, and
 * time; see vault/Projects/realness.md.
 */
import { ask_ok, exit } from './realness-door.js'

const SOURCE_ARGS = 4
const PROBE_MS = 300_000
const REPLY_MS = 30_000
const KIB = 1024
const GIB = KIB * KIB * KIB

const USAGE =
  'usage: realness loop "<goal>" | realness loop report <id> | realness loop scout <name> [--probe] [--source <key>] | realness loop scouts'
const args = process.argv.slice(2)

if (args.length === 2 && args[0] === 'report') {
  const reply = await ask_ok(
    'realness loop',
    { op: 'loop-report', id: args[1] },
    { timeout_ms: 30_000 }
  )
  process.stdout.write(`${JSON.stringify(reply.loop, null, 2)}\n`)
} else if (
  args[0] === 'scout' &&
  (args.length === 2 ||
    (args.length === SOURCE_ARGS && args[2] === '--source') ||
    (args.length === 3 && args[2] === '--probe'))
) {
  const probe = args[2] === '--probe'
  const source = args[2] === '--source' ? args[3] : ''
  const reply = await ask_ok(
    'realness loop',
    probe
      ? { op: 'scout', scout: args[1], probe }
      : { op: 'scout', scout: args[1], source },
    { timeout_ms: probe ? PROBE_MS : REPLY_MS }
  )
  process.stdout.write(
    probe
      ? `probe ok: ${Math.floor(reply.probe.free / GIB)} GiB free, ${reply.probe.cookies} yc cookies\n`
      : `scout ${reply.scout} ${reply.source ?? ''} started; its finds land in Finds/\n`
  )
} else if (args.length === 1 && args[0] === 'scouts') {
  const reply = await ask_ok(
    'realness loop',
    { op: 'scouts' },
    { timeout_ms: 30_000 }
  )
  process.stdout.write(
    reply.scouts.length
      ? `scouts started: ${reply.scouts.join(', ')}\n`
      : 'no active scouts\n'
  )
} else if (
  args.length === 1 &&
  !['-h', '--help', 'report', 'scout', 'scouts'].includes(args[0])
) {
  const reply = await ask_ok(
    'realness loop',
    { op: 'loop', goal: args[0] },
    { timeout_ms: 300_000 }
  )
  process.stdout.write(`loop ${reply.id} started\n`)
  process.stdout.write(`realness loop report ${reply.id}\n`)
} else exit(USAGE)
