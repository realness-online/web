import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer as create_server } from 'node:http'
import { createHmac as create_hmac } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  writeFile as write_file,
  readFile as read_file
} from 'node:fs/promises'
import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { join } from 'node:path'
import { run_capacity, validate_capacity } from '#root/src/control/capacity.js'

const secret = 'local-only-test-secret-'.repeat(3)
const resources = { memory_bytes: 4e9, disk_bytes: 20e9, cpu_fraction: 0.1 }
const configuration = api => ({
  api,
  owner: '+14155550000',
  levels: [2],
  concurrency: 2,
  duration_ms: 5000,
  request_ms: 500,
  sample_ms: 10,
  min_memory_bytes: 2e9,
  min_disk_bytes: 5e9,
  max_cpu_fraction: 0.9,
  hourly_cost: 1,
  budget: 1,
  workloads: [
    { name: 'cpu', argv: ['node', 'workload.js'], timeout_s: 0.1, max_ms: 500 }
  ]
})

const host = async (t, options = {}) => {
  const state = {
    created: [],
    deleted: [],
    active: 0,
    maximum: 0,
    execs: [],
    authorizations: []
  }
  const pending = []
  const server = create_server(async (request, response) => {
    state.authorizations.push(request.headers.authorization)
    response.setHeader('content-type', 'application/json')
    if (request.url === '/v1/health')
      return response.end(JSON.stringify({ ok: true, seed: { matches: true } }))
    if (request.method === 'DELETE') {
      const id = request.url.split('/').at(-1)
      state.deleted.push(id)
      response.statusCode =
        options.cleanup_failure && id === 'actor-2' ? 500 : 204
      return response.end()
    }
    if (request.url === '/v1/actors') {
      if (options.create_failure && state.created.length === 1) {
        response.statusCode = 500
        return response.end('{}')
      }
      const id = `actor-${state.created.length + 1}`
      state.created.push(id)
      return response.end(JSON.stringify({ id }))
    }
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    state.execs.push(JSON.parse(Buffer.concat(chunks).toString()))
    state.active += 1
    state.maximum = Math.max(state.maximum, state.active)
    const finish = () => {
      state.active -= 1
      response.end(
        JSON.stringify({
          exit_code: options.guest_failure ? 2 : 0,
          stdout_b64: Buffer.from(options.output ?? '').toString('base64')
        })
      )
    }
    if (options.hang) return
    if (options.barrier) {
      pending.push(finish)
      if (pending.length === 2) pending.splice(0).forEach(done => done())
    } else if (options.slow) setTimeout(finish, 20)
    else finish()
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    server.closeAllConnections()
    return new Promise(resolve => server.close(resolve))
  })
  return { api: `http://127.0.0.1:${server.address().port}`, state }
}

const execute = async (config, options = {}) => {
  const events = []
  const report = await run_capacity(config, {
    secret,
    sample: async () => resources,
    journal: async event => events.push(event),
    ...options
  })
  return { report, events }
}

test('capacity uses authenticated HTTP, overlapping work and reverse owned cleanup', async t => {
  const { api, state } = await host(t, { barrier: true })
  const { report, events } = await execute(configuration(api))
  assert.equal(report.complete, true)
  assert.equal(state.maximum, 2)
  assert.deepEqual(state.deleted, ['actor-2', 'actor-1'])
  assert.equal(report.levels[0].workloads[0].samples, 2)
  assert.equal(report.safe_count, null)
  assert.equal(events.filter(event => event.type === 'created').length, 2)
  assert.deepEqual(state.execs[0].argv, ['node', 'workload.js'])
  const [body, signature] = state.authorizations[0].slice(7).split('.')
  assert.equal(
    signature,
    create_hmac('sha256', secret).update(body).digest('base64url')
  )
  assert.equal(JSON.parse(Buffer.from(body, 'base64url')).phone, '+14155550000')
})

test('multiple levels reuse actors and never exceed configured concurrency', async t => {
  const { api, state } = await host(t, { slow: true })
  const config = configuration(api)
  config.levels = [2, 3]
  const { report } = await execute(config)
  assert.equal(report.complete, true)
  assert.equal(state.maximum, 2)
  assert.equal(state.created.length, 3)
  assert.deepEqual(
    report.levels.map(level => level.workloads[0].samples),
    [2, 3]
  )
})

test('slow successful guest responses still fail the latency limit', async t => {
  const { api, state } = await host(t, { slow: true })
  const config = configuration(api)
  config.workloads[0].max_ms = 1
  const { report } = await execute(config)
  assert.match(report.stop, /response limit exceeded/)
  assert.equal(state.deleted.length, 2)
})

test('capacity stops below the memory reserve without creating actors', async t => {
  const { api, state } = await host(t)
  const { report } = await execute(configuration(api), {
    sample: async () => ({ ...resources, memory_bytes: 1 })
  })
  assert.match(report.stop, /memory reserve/)
  assert.deepEqual(state.created, [])
})

for (const [name, metrics, expected] of [
  ['disk', { ...resources, disk_bytes: 1 }, /disk reserve/],
  ['CPU', { ...resources, cpu_fraction: 1 }, /CPU ceiling/],
  ['unknown', { ...resources, memory_bytes: null }, /unknown resource/]
])
  test(`capacity stops on ${name} resources`, async t => {
    const { api, state } = await host(t)
    const { report } = await execute(configuration(api), {
      sample: async () => metrics
    })
    assert.match(report.stop, expected)
    assert.equal(state.created.length, 0)
  })

test('failed create remains uncertain and only known actors are cleaned', async t => {
  const { api, state } = await host(t, { create_failure: true })
  const { report } = await execute(configuration(api))
  assert.equal(report.complete, false)
  assert.equal(report.uncertain_create, true)
  assert.deepEqual(state.deleted, ['actor-1'])
})

test('guest failure cleans every created actor and reports failed deletion', async t => {
  const { api, state } = await host(t, {
    guest_failure: true,
    cleanup_failure: true
  })
  const { report } = await execute(configuration(api))
  assert.match(report.stop, /guest exit 2/)
  assert.deepEqual(state.deleted, ['actor-2', 'actor-1'])
  assert.equal(report.cleanup_failures[0].id, 'actor-2')
})

test('request timeout still allows independent cleanup', async t => {
  const { api, state } = await host(t, { hang: true })
  const { report } = await execute(configuration(api))
  assert.equal(report.complete, false)
  assert.match(report.stop, /timeout|aborted/i)
  assert.equal(state.deleted.length, 2)
})

test('sampling during hung work aborts it before its request timeout', async t => {
  const { api, state } = await host(t, { hang: true })
  let samples = 0
  const { report } = await execute(configuration(api), {
    sample: async () => {
      samples += 1
      return {
        ...resources,
        memory_bytes: samples > 3 ? 1 : resources.memory_bytes
      }
    }
  })
  assert.match(report.stop, /memory reserve/)
  assert.equal(state.deleted.length, 2)
})

test('duration and interruption stop work but still clean known actors', async t => {
  for (const interrupted of [false, true]) {
    const { api, state } = await host(t, { hang: true })
    const config = configuration(api)
    config.duration_ms = 100
    const controller = new AbortController()
    let samples = 0
    const { report } = await execute(config, {
      signal: controller.signal,
      sample: async () => {
        if (++samples === 4 && interrupted)
          controller.abort(new Error('operator stop'))
        return resources
      }
    })
    assert.equal(report.complete, false)
    assert.equal(state.deleted.length, 2)
    if (interrupted) assert.match(report.stop, /operator stop/)
  }
})

test('public capacity command defaults to offline validation and journals a local run', async t => {
  const { api, state } = await host(t)
  const root = file_url_to_path(
    new URL('../../../../artifacts/realness/quality/', import.meta.url)
  )
  await mkdir(root, { recursive: true })
  const directory = await mkdtemp(join(root, 'capacity-cli-'))
  const config = configuration(api)
  config.sample_argv = [
    process.execPath,
    '-p',
    `JSON.stringify(${JSON.stringify(resources)})`
  ]
  const config_path = join(directory, 'config.json')
  const secret_path = join(directory, 'secret')
  const journal_path = join(directory, 'journal.jsonl')
  await write_file(config_path, JSON.stringify(config))
  await write_file(secret_path, secret, { mode: 0o600 })
  const command = file_url_to_path(
    new URL('../../tools/control/bin/capacity.js', import.meta.url)
  )
  const execute = promisify(exec_file)
  const preview = await execute(process.execPath, [
    command,
    '--config',
    config_path
  ])
  assert.equal(JSON.parse(preview.stdout).execution, false)
  assert.equal(state.authorizations.length, 0)
  const result = await execute(process.execPath, [
    command,
    '--config',
    config_path,
    '--run',
    '--secret-file',
    secret_path,
    '--journal',
    journal_path
  ])
  assert.equal(JSON.parse(result.stdout).complete, true)
  const journal = await read_file(journal_path, 'utf8')
  assert.equal(journal.includes(secret), false)
  assert.equal(JSON.parse(journal.trim().split('\n').at(-1)).type, 'report')
  await assert.rejects(
    execute(process.execPath, [
      command,
      '--config',
      config_path,
      '--run',
      '--secret-file',
      secret_path,
      '--journal',
      journal_path
    ]),
    /EEXIST/
  )
  assert.equal(state.created.length, 2)
})

test('Pi workload requires a completed reply and settled agent through HTTP', async t => {
  const reply = {
    type: 'message_end',
    message: {
      role: 'assistant',
      stopReason: 'stop',
      content: [{ type: 'text', text: 'ready' }]
    }
  }
  for (const settled of [false, true]) {
    const events = settled ? [reply, { type: 'agent_settled' }] : [reply]
    const { api } = await host(t, {
      output: events.map(event => JSON.stringify(event)).join('\n')
    })
    const config = configuration(api)
    config.workloads[0].pi_reply = 'ready'
    const { report } = await execute(config)
    assert.equal(report.complete, settled)
    if (!settled) assert.match(report.stop, /Pi did not settle/)
  }
})

test('memory and CPU workload commands run locally and reject unsafe arguments', async () => {
  const script = file_url_to_path(
    new URL('../../tools/control/bin/capacity-workload.js', import.meta.url)
  )
  const execute = promisify(exec_file)
  for (const kind of ['memory', 'cpu']) {
    const result = await execute(process.execPath, [script, kind, '1', '20'])
    assert.equal(JSON.parse(result.stdout).kind, kind)
  }
  await assert.rejects(
    execute(process.execPath, [script, 'memory', '2048', '20']),
    /max 1024/
  )
})

test('invalid and over-budget configurations fail before requests', () => {
  const config = configuration('http://127.0.0.1:1')
  for (const change of [
    { levels: [2, 1] },
    { concurrency: 0 },
    { duration_ms: 0.5 },
    { sample_ms: 2147483648 },
    { budget: 0.000001 },
    { request_ms: 50 },
    { max_cpu_fraction: 2 }
  ])
    assert.throws(() => validate_capacity({ ...config, ...change }))
})
