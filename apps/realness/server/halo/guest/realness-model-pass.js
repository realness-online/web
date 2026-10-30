#!/usr/bin/env node
/**
 * Print a fresh person-bound model pass from the halo door.
 *
 * Pi's models.json runs this per request (`!realness-model-pass`). The halo
 * verifies this VM, names its owner, and signs a sixty-second pass. Nothing is
 * stored on disk, so seeds and exports carry no model credential.
 */
import { ask_ok, exit } from './realness-door.js'

try {
  const reply = await ask_ok(
    'realness-model-pass',
    { op: 'model-pass' },
    {
      timeout_ms: 10_000,
      timeout_error: 'the halo door did not issue a model pass'
    }
  )
  if (typeof reply.pass !== 'string')
    exit('realness-model-pass: no pass in the reply')
  process.stdout.write(`${reply.pass}\n`)
} catch (error) {
  exit(`realness-model-pass: ${error.message}`)
}
