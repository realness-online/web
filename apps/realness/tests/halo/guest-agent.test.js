import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { python_command } from '#root/lib/python.js'

const agent = file_url_to_path(
  new URL('../../server/halo/guest/realness-agent.py', import.meta.url)
)
const has_python = spawnSync(python_command(), ['--version']).status === 0

/** Runs the agent with stdin held open until the frames end. */
const frames = (t, request, { close_stdin = false } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(python_command(), [agent], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`agent did not finish: ${err}`))
    }, 10_000)
    t.after(() => {
      clearTimeout(timer)
      child.kill()
    })
    child.stdout.on('data', chunk => {
      out += chunk
    })
    child.stderr.on('data', chunk => {
      err += chunk
    })
    child.on('close', () => {
      clearTimeout(timer)
      resolve(
        out
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line))
      )
    })
    child.stdin.write(`${JSON.stringify(request)}\n`)
    if (close_stdin) child.stdin.end()
  })

const text = frame => Buffer.from(frame.data_b64, 'base64').toString()

test(
  'a plain request still answers one line',
  { skip: !has_python },
  async t => {
    const result = await frames(
      t,
      { argv: ['sh', '-c', 'printf ok'], cwd: process.cwd() },
      { close_stdin: true }
    )
    assert.equal(result.length, 1)
    assert.equal(result[0].exit_code, 0)
    assert.equal(text({ data_b64: result[0].stdout_b64 }), 'ok')
  }
)

test(
  'a streamed request reports output as frames, then the exit',
  { skip: !has_python },
  async t => {
    const result = await frames(t, {
      argv: ['sh', '-c', 'printf one; printf bad >&2; sleep 0.1; printf two'],
      cwd: process.cwd(),
      stream: true
    })
    assert.deepEqual(result.at(-1), { type: 'exit', exit_code: 0 })
    const stdout = result
      .filter(frame => frame.type === 'stdout')
      .map(text)
      .join('')
    const stderr = result
      .filter(frame => frame.type === 'stderr')
      .map(text)
      .join('')
    assert.equal(stdout, 'onetwo')
    assert.equal(stderr, 'bad')
  }
)

test(
  'a timeout stops the command and reports 124',
  { skip: !has_python },
  async t => {
    const started = Date.now()
    const result = await frames(t, {
      argv: ['sh', '-c', 'printf early; sleep 5; printf late'],
      cwd: process.cwd(),
      stream: true,
      timeout: 0.3
    })
    assert.deepEqual(result.at(-1), { type: 'exit', exit_code: 124 })
    assert.ok(
      Date.now() - started < 3000,
      'the wait is the command, not the sleep'
    )
  }
)

test(
  'closing the channel stops the command',
  { skip: !has_python },
  async t => {
    const child = spawn(python_command(), [agent], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let out = ''
    t.after(() => child.kill())
    child.stdout.on('data', chunk => {
      out += chunk
    })
    child.stdin.write(
      `${JSON.stringify({ argv: ['sh', '-c', 'sleep 5; printf late'], cwd: process.cwd(), stream: true })}\n`
    )
    await new Promise(done => setTimeout(done, 200))
    const ended = new Promise(done => child.on('close', done))
    child.stdin.end()
    await ended
    assert.equal(out.includes('late'), false)
  }
)
