import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { it } from 'node:test'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { python_command } from '#root/lib/python.js'
import { readFile as read_file, unlink } from 'node:fs/promises'

const agent = file_url_to_path(
  new URL('../../server/halo/guest/realness-agent.py', import.meta.url)
)
const has_python = spawnSync(python_command(), ['--version']).status === 0
const root = file_url_to_path(new URL('../../../../', import.meta.url))

/** Runs the agent with stdin held open until the frames end. */
const frames = (t, request, { close_stdin = false } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(python_command(), [agent], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, REALNESS_ROOT: root }
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

it('a plain request still answers one line', { skip: !has_python }, async t => {
  const result = await frames(
    t,
    { argv: ['sh', '-c', 'printf ok'], cwd: process.cwd() },
    { close_stdin: true }
  )
  assert.equal(result.length, 1)
  assert.equal(result[0].exit_code, 0)
  assert.equal(text({ data_b64: result[0].stdout_b64 }), 'ok')
})

it(
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

it(
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
    assert.deepEqual(result.at(-1), {
      type: 'exit',
      exit_code: 124,
      error: 'timeout'
    })
    assert.ok(
      Date.now() - started < 3000,
      'the wait is the command, not the sleep'
    )
  }
)

it(
  'an explicit environment can replace inherited variables',
  { skip: !has_python },
  async t => {
    const result = await frames(t, {
      argv: ['/bin/sh', '-c', 'printf "%s:%s" "$VALUE" "${HOME-unset}"'],
      cwd: process.cwd(),
      stream: true,
      inherit_env: false,
      env: { VALUE: 'a b' }
    })
    assert.equal(
      result
        .filter(frame => frame.type === 'stdout')
        .map(text)
        .join(''),
      'a b:unset'
    )
  }
)

it(
  'exit 124 and a spawn failure are distinguishable from timeout',
  { skip: !has_python },
  async t => {
    const exited = await frames(t, {
      argv: ['/bin/sh', '-c', 'exit 124'],
      cwd: process.cwd(),
      stream: true
    })
    assert.deepEqual(exited.at(-1), { type: 'exit', exit_code: 124 })
    const failed = await frames(t, {
      argv: ['/no-such-realness-program'],
      cwd: process.cwd(),
      stream: true
    })
    assert.deepEqual(failed.at(-1), {
      type: 'exit',
      exit_code: 127,
      error: 'spawn_error'
    })
  }
)

it(
  'spilling keeps the complete output, including the prefix and stderr',
  { skip: !has_python },
  async t => {
    const result = await frames(t, {
      argv: [
        '/bin/sh',
        '-c',
        'printf prefix; sleep 0.05; printf "line1\\nline2\\n"; sleep 0.05; printf tail >&2'
      ],
      cwd: process.cwd(),
      stream: true,
      spill: { afterBytes: 5, afterLines: 100 }
    })
    const last = result.at(-1)
    assert.equal(last.exit_code, 0)
    assert.equal(typeof last.spill_path, 'string')
    assert.ok(last.spill_path.startsWith(`${root}artifacts/realness/exec-`))
    t.after(() => unlink(last.spill_path))
    assert.equal(
      await read_file(last.spill_path, 'utf8'),
      result
        .filter(frame => frame.type !== 'exit')
        .map(text)
        .join('')
    )
    assert.equal(
      await read_file(last.spill_path, 'utf8'),
      'prefixline1\nline2\ntail'
    )
  }
)

it(
  'a line threshold spills and a short command creates no file',
  { skip: !has_python },
  async t => {
    const request = {
      argv: ['/bin/sh', '-c', 'printf "one\\ntwo\\n"'],
      cwd: process.cwd(),
      stream: true
    }
    const spilled = await frames(t, {
      ...request,
      spill: { afterBytes: 10000, afterLines: 1 }
    })
    const path = spilled.at(-1).spill_path
    assert.equal(typeof path, 'string')
    t.after(() => unlink(path))
    assert.equal(await read_file(path, 'utf8'), 'one\ntwo\n')
    const short = await frames(t, {
      ...request,
      spill: { afterBytes: 10000, afterLines: 2 }
    })
    assert.equal(short.at(-1).spill_path, undefined)
  }
)

it(
  'a timed-out command retains partial-line output in its spill file',
  { skip: !has_python },
  async t => {
    const result = await frames(t, {
      argv: ['/bin/sh', '-c', 'printf partial; sleep 5'],
      cwd: process.cwd(),
      stream: true,
      timeout: 0.3,
      spill: { afterBytes: 10000, afterLines: 0 }
    })
    const last = result.at(-1)
    assert.equal(last.error, 'timeout')
    assert.equal(typeof last.spill_path, 'string')
    t.after(() => unlink(last.spill_path))
    assert.equal(await read_file(last.spill_path, 'utf8'), 'partial')
  }
)

it('closing the channel stops the command', { skip: !has_python }, async t => {
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
})
