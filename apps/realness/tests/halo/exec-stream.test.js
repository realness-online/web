import assert from 'node:assert/strict'
import { test } from 'node:test'
import { issue_halo_pass } from '#root/src/sign-on/node/halo-pass.js'
import { makeServer } from '../../src/halo/server.js'

const secret = 'exec-stream-test-secret-at-least-thirty-two-bytes'
process.env.HALO_PASS_SECRET = secret
const alice = '+14155550123'
const id = 'a-alice0000000'
const auth = {
  authorization: `Bearer ${issue_halo_pass({ phone: alice }, secret)}`,
  'content-type': 'application/json'
}

const start = async (result = {}) => {
  const seen = { exec: [], stream: [] }
  const record = { id, owner: alice }
  const store = {
    get: () => record,
    list: () => [record],
    exec: async (actor, argv, options) => {
      seen.exec.push({ actor, argv, options })
      return {
        exit_code: 0,
        stdout_b64: Buffer.from('whole').toString('base64'),
        stderr_b64: ''
      }
    },
    execStream: async (actor, argv, options) => {
      seen.stream.push({ actor, argv, options })
      options.on_output({ stream: 'stdout', data: Buffer.from('one\n') })
      options.on_output({ stream: 'stderr', data: Buffer.from('bad\n') })
      options.on_output({ stream: 'stdout', data: Buffer.from('two\n') })
      return { exit_code: 4, stdout_bytes: 8, stderr_bytes: 4, ...result }
    }
  }
  const server = makeServer(store, null, undefined, null, {})
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  return {
    seen,
    at: `http://127.0.0.1:${server.address().port}/v1/actors/${id}/exec`,
    close: () => {
      server.closeAllConnections()
      server.close()
    }
  }
}

test('a streamed exec answers output frames and then the exit', async () => {
  const { at, seen, close } = await start()
  try {
    const response = await fetch(at, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ argv: ['sh', '-c', 'two'], stream: true })
    })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /ndjson/)
    const frames = (await response.text())
      .trim()
      .split('\n')
      .map(line => JSON.parse(line))
    assert.deepEqual(frames, [
      {
        type: 'output',
        stream: 'stdout',
        data_b64: Buffer.from('one\n').toString('base64')
      },
      {
        type: 'output',
        stream: 'stderr',
        data_b64: Buffer.from('bad\n').toString('base64')
      },
      {
        type: 'output',
        stream: 'stdout',
        data_b64: Buffer.from('two\n').toString('base64')
      },
      { type: 'exit', exit_code: 4 }
    ])
    assert.deepEqual(seen.stream[0].argv, ['sh', '-c', 'two'])
    assert.equal(seen.exec.length, 0)
  } finally {
    close()
  }
})

test('the stream carries shell options, timeout errors and spill paths', async () => {
  const { at, seen, close } = await start({
    exit_code: 124,
    error: 'timeout',
    spill_path: '/realness/artifacts/realness/exec.log'
  })
  try {
    const response = await fetch(at, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        argv: ['/bin/sh', '-c', 'echo "$VALUE"'],
        stream: true,
        timeout: 0,
        env: { VALUE: 'a b' },
        inherit_env: false,
        spill: { afterBytes: 5, afterLines: 2, directory: '/must-not-pass' }
      })
    })
    assert.equal(response.status, 200)
    const frames = (await response.text())
      .trim()
      .split('\n')
      .map(line => JSON.parse(line))
    assert.deepEqual(frames.at(-1), {
      type: 'exit',
      exit_code: 124,
      error: 'timeout',
      spill_path: '/realness/artifacts/realness/exec.log'
    })
    const options = seen.stream[0].options
    assert.equal(options.timeout, 0)
    assert.deepEqual(options.env, { VALUE: 'a b' })
    assert.equal(options.inherit_env, false)
    assert.deepEqual(options.spill, { afterBytes: 5, afterLines: 2 })
  } finally {
    close()
  }
})

test('invalid streamed shell options never reach the actor', async () => {
  const { at, seen, close } = await start()
  try {
    for (const options of [
      { env: null },
      { env: [] },
      { env: { VALUE: 5 } },
      { env: { 'A=B': 'value' } },
      { inherit_env: 'yes' },
      { spill: {} },
      { spill: { afterBytes: -1, afterLines: 1 } },
      { timeout: -1 }
    ]) {
      const response = await fetch(at, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ argv: ['true'], stream: true, ...options })
      })
      assert.equal(response.status, 400, JSON.stringify(options))
    }
    assert.equal(seen.stream.length, 0)
  } finally {
    close()
  }
})

test('without stream the reply is one JSON body, as before', async () => {
  const { at, seen, close } = await start()
  try {
    const response = await fetch(at, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ argv: ['true'] })
    })
    assert.deepEqual(await response.json(), {
      exit_code: 0,
      stdout_b64: Buffer.from('whole').toString('base64'),
      stderr_b64: ''
    })
    assert.equal(seen.stream.length, 0)
  } finally {
    close()
  }
})

test('a non-boolean stream is refused before any work starts', async () => {
  const { at, seen, close } = await start()
  try {
    const response = await fetch(at, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ argv: ['true'], stream: 'yes' })
    })
    assert.equal(response.status, 400)
    assert.equal(seen.exec.length + seen.stream.length, 0)
  } finally {
    close()
  }
})
