#!/usr/bin/env node
/**
 * Run one autoresearch loop headless, as the realness user.
 *
 *     realness-loop-run <goal>
 *     realness-loop-run --once <goal>   one plain prompt; pi exits once it settles
 *     realness-loop-run --sessions <dir> write pi's session to <dir>, not the loop
 *
 * The halo starts this in a loop actor under systemd-run. Pi runs in RPC mode:
 * print mode drops the autoresearch tools (vault/Projects/realness.md). Nobody
 * answers dialogs here, so each one is cancelled. The halo, not this script,
 * decides when the loop stops; closing stdin is Pi's orderly shutdown.
 *
 *     /realness/work/loop/goal.md        the goal, as given
 *     /realness/work/loop/sessions/      pi's session, unless --sessions names a dir
 *     /realness/work/loop/events.jsonl   Pi's RPC events
 *     /realness/work/loop/stderr.log     Pi's errors
 *     /realness/work/loop/status.json    {"state": "running" | "exited", "tokens": N, ...}
 */
import { spawn } from 'node:child_process'
import {
  appendFileSync as append_file_sync,
  mkdirSync as mkdir_sync,
  writeFileSync as write_file_sync,
  renameSync as rename_sync,
  existsSync as exists_sync,
  openSync as open_sync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { createInterface as create_interface } from 'node:readline'

const LOOP = '/realness/work/loop'
const STAGES_PAGE = 'stages.html.gz'
const DIALOGS = new Set(['select', 'confirm', 'input', 'editor'])
const LIB = process.env.REALNESS_LIB ?? '/usr/local/lib/realness'
/** One gzip HTML member per record, the same page a run reads back. */
const { append_item } = await import(`${LIB}/src/files/item-log.js`)

/** The status file the halo reads: written whole, then moved into place. */
const status = fields => {
  const at = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const tmp = join(LOOP, 'status.json.tmp')
  write_file_sync(tmp, JSON.stringify({ ...fields, at }))
  rename_sync(tmp, join(LOOP, 'status.json'))
}

const argv = process.argv.slice(2)
const once = argv[0] === '--once'
const flags = once ? argv.slice(1) : argv
let session_dir = join(LOOP, 'sessions')
let goal
if (flags[0] === '--sessions') {
  session_dir = flags[1] ?? session_dir
  goal = flags.slice(2).join(' ')
} else goal = flags.join(' ')
if (!goal.trim()) {
  process.stderr.write(
    'usage: realness-loop-run [--once] [--sessions <dir>] <goal>\n'
  )
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
mkdir_sync(session_dir, { recursive: true })

const pi = spawn(
  '/usr/local/bin/realness',
  ['--mode', 'rpc', '--session-dir', session_dir],
  {
    stdio: ['pipe', 'pipe', open_sync('stderr.log', 'a')]
  }
)
const { stdin, stdout } = pi
if (!stdin || !stdout) throw new Error('Pi has no pipes')
const send = value => {
  try {
    stdin.write(`${JSON.stringify(value)}\n`)
  } catch {}
}
process.on('SIGTERM', () => stdin.end())
let tokens = 0
status({ state: 'running', pid: pi.pid, tokens })
send({
  id: 'loop',
  type: 'prompt',
  message: once
    ? `${goal}\n\nNobody is watching: never ask questions.`
    : `/autoresearch ${goal}\n\nNobody is watching: never ask questions; start the loop now.`
})

const events = create_interface({ input: stdout, crlfDelay: Infinity })
for await (const line of events) {
  append_file_sync('events.jsonl', `${line}\n`)
  let event
  try {
    event = JSON.parse(line)
  } catch {
    continue
  }
  if (
    event.type === 'tool_execution_start' ||
    (event.type === 'message_end' && event.message?.role === 'assistant')
  )
    await append_item(join(dirname(session_dir), STAGES_PAGE), 'stage', {
      at: Date.now(),
      tool:
        event.type === 'message_end'
          ? ''
          : String(
              event.args?.command ?? event.args?.path ?? event.toolName ?? ''
            )
    })
  const usage = event.type === 'message_end' ? event.message?.usage : null
  if (usage && typeof usage === 'object') {
    tokens += Number(usage.input ?? 0) + Number(usage.output ?? 0)
    status({ state: 'running', pid: pi.pid, tokens })
  }
  if (once && event.type === 'agent_settled') stdin.end()
  if (event.type === 'extension_ui_request' && DIALOGS.has(event.method))
    send({ type: 'extension_ui_response', id: event.id, cancelled: true })
}
const code = await new Promise(done => {
  pi.on('close', done)
})
status({ state: 'exited', code, tokens })
