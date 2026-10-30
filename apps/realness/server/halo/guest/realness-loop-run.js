#!/usr/bin/env node
/**
 * Run one autoresearch loop headless, as the realness user.
 *
 *     realness-loop-run <goal>
 *
 * The halo starts this in a loop actor under systemd-run. Pi runs in RPC mode:
 * print mode drops the autoresearch tools (vault/Projects/realness.md). Nobody
 * answers dialogs here, so each one is cancelled. The halo, not this script,
 * decides when the loop stops; closing stdin is Pi's orderly shutdown.
 *
 *     /realness/work/loop/goal.md        the goal, as given
 *     /realness/work/loop/events.jsonl   Pi's RPC events
 *     /realness/work/loop/status.json    {"state": "running" | "exited", "tokens": N, ...}
 */
import { spawn } from 'node:child_process'
import {
  appendFileSync as append_file_sync,
  mkdirSync as mkdir_sync,
  writeFileSync as write_file_sync,
  renameSync as rename_sync,
  existsSync as exists_sync
} from 'node:fs'
import { join } from 'node:path'
import { createInterface as create_interface } from 'node:readline'

const LOOP = '/realness/work/loop'
const DIALOGS = new Set(['select', 'confirm', 'input', 'editor'])

/** The status file the halo reads: written whole, then moved into place. */
const status = fields => {
  const at = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const tmp = join(LOOP, 'status.json.tmp')
  write_file_sync(tmp, JSON.stringify({ ...fields, at }))
  rename_sync(tmp, join(LOOP, 'status.json'))
}

const goal = process.argv.slice(2).join(' ')
if (!goal.trim()) {
  process.stderr.write('usage: realness-loop-run <goal>\n')
  process.exit(1)
}
mkdir_sync(LOOP, { recursive: true })
process.chdir(LOOP)
if (!exists_sync('.git')) {
  const init = spawn('git', ['init', '-q'], { stdio: 'inherit' })
  await new Promise(done => {
    init.on('close', done)
  })
}
write_file_sync('goal.md', `${goal}\n`)

const pi = spawn(
  '/usr/local/bin/realness',
  ['--mode', 'rpc', '--session-dir', join(LOOP, 'sessions')],
  {
    stdio: ['pipe', 'pipe', 'inherit']
  }
)
const send = value => {
  try {
    pi.stdin.write(`${JSON.stringify(value)}\n`)
  } catch {}
}
process.on('SIGTERM', () => pi.stdin.end())
let tokens = 0
status({ state: 'running', pid: pi.pid, tokens })
send({
  id: 'loop',
  type: 'prompt',
  message: `/autoresearch ${goal}\n\nNobody is watching: never ask questions; start the loop now.`
})

const events = create_interface({ input: pi.stdout, crlfDelay: Infinity })
for await (const line of events) {
  append_file_sync('events.jsonl', `${line}\n`)
  let event
  try {
    event = JSON.parse(line)
  } catch {
    continue
  }
  const usage = event.type === 'message_end' ? event.message?.usage : null
  if (usage && typeof usage === 'object') {
    tokens += Number(usage.input ?? 0) + Number(usage.output ?? 0)
    status({ state: 'running', pid: pi.pid, tokens })
  }
  if (event.type === 'extension_ui_request' && DIALOGS.has(event.method))
    send({ type: 'extension_ui_response', id: event.id, cancelled: true })
}
const code = await new Promise(done => {
  pi.on('close', done)
})
status({ state: 'exited', code, tokens })
