/**
 * hs-mem: the measurement says what a halo must hold and what an actor uses.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { MemoryError, measure, memory_text } from '../../src/control/memory.js'

const stages = [
  { name: 'created', run: '' },
  { name: 'pi running', run: 'true' }
]

const fixture = readings => {
  const ran = []
  let index = 0
  return {
    ran,
    actor: 'a-111111111111',
    stages,
    run: async argv => ran.push(argv.join(' ')),
    sample: async actor => {
      ran.push(`sample ${actor}`)
      return readings[Math.min(index++, readings.length - 1)]
    }
  }
}

test('each stage is run and then measured', async () => {
  const one = fixture([
    { halo_mib: 140, guest_used_mib: 50, top: ['36M MainThread'] },
    { halo_mib: 233, guest_used_mib: 104, top: ['106M pi'] }
  ])
  const result = await measure(one)
  assert.deepEqual(
    result.rows.map(row => row.stage),
    ['created', 'pi running']
  )
  assert.equal(result.peak, 233, 'the halo must hold the largest it gave up')
  assert.equal(
    result.floor_mib,
    128,
    'the guest used 104, rounded up to a step'
  )
  assert.deepEqual(one.ran, [
    'sample a-111111111111',
    'true',
    'sample a-111111111111'
  ])
})

test('a stage that needs no command is still measured', async () => {
  const one = fixture([{ halo_mib: 100, guest_used_mib: 10, top: [] }])
  await measure({ ...one, stages: [{ name: 'created', run: '' }] })
  assert.deepEqual(one.ran, ['sample a-111111111111'])
})

test('the floor rounds up in whole steps, and never below what was used', async () => {
  const one = fixture([
    { halo_mib: 400, guest_used_mib: 65, top: [] },
    { halo_mib: 500, guest_used_mib: 96, top: [] }
  ])
  const result = await measure(one)
  assert.equal(result.floor_mib, 128)
  assert.ok(result.floor_mib >= 96)
  assert.equal(result.peak, 500)
})

test('the summary names the peak, the floor, and the biggest process', async () => {
  const one = fixture([
    {
      halo_mib: 140,
      guest_used_mib: 50,
      top: ['36M MainThread', '11M systemd']
    }
  ])
  const text = memory_text(await measure(one))
  assert.match(text, /peak halo 140 MiB, floor 64 MiB/)
  assert.match(
    text,
    /created: halo 140 MiB, guest 50 MiB \(36M MainThread, 11M systemd\)/
  )
})

test(
  'sampling captures transient peaks while an explicit workload is running',
  { timeout: 2000 },
  async () => {
    let release
    const sampled = new Promise(resolve => {
      release = resolve
    })
    let running = false
    const result = await measure({
      actor: 'a-111111111111',
      stages: [{ name: 'page conversion', argv: ['node', 'page.js'] }],
      sample_ms: 1,
      run: async argv => {
        assert.deepEqual(argv, ['node', 'page.js'])
        running = true
        const deadline = setTimeout(release, 1000)
        try {
          await sampled
        } finally {
          clearTimeout(deadline)
          running = false
        }
      },
      sample: async () => {
        const reading = running
          ? { halo_mib: 500, guest_used_mib: 300, top: ['280M node'] }
          : { halo_mib: 200, guest_used_mib: 100, top: [] }
        release()
        return reading
      }
    })
    assert.equal(result.peak, 500)
    assert.equal(result.floor_mib, 320)
    assert.ok(result.rows[0].samples >= 2)
    assert.deepEqual(result.rows[0].top, ['280M node'])
  }
)

test('memory forwards full capacity stages without splitting argv or losing timeouts', async () => {
  const stage = {
    name: 'pi',
    argv: ['node', '-', 'a value with spaces'],
    timeout_s: 150,
    cwd: '/realness',
    stdin_b64: 'cmVhZHk='
  }
  const one = fixture([{ halo_mib: 200, guest_used_mib: 100, top: [] }])
  let received
  await measure({
    ...one,
    stages: [stage],
    run: async (argv, input) => {
      received = { argv, input }
    }
  })
  assert.deepEqual(received, { argv: stage.argv, input: stage })
  await assert.rejects(
    measure({ ...one, stages: [{ ...stage, timeout_s: 1801 }] }),
    /workload timeout/
  )
})

test('unknown memory and failed workloads cannot produce a sizing report', async () => {
  const one = fixture([{ halo_mib: NaN, guest_used_mib: 10, top: [] }])
  await assert.rejects(measure(one), /unknown memory/)
  await assert.rejects(
    measure({
      ...one,
      stages: [{ name: 'failed', argv: ['false'] }],
      run: async () => {
        throw new Error('workload failed')
      }
    }),
    /workload failed/
  )
  for (const sample_ms of [0, -1, Infinity, 0.5, 2147483648])
    await assert.rejects(measure({ ...one, sample_ms }), /sample interval/)
})

test('public memory command refuses missing explicit workloads before contacting a halo', async () => {
  const command = file_url_to_path(
    new URL('../../tools/cli/bin/realness.js', import.meta.url)
  )
  await assert.rejects(
    promisify(exec_file)(process.execPath, [
      command,
      'development',
      'halo',
      'memory',
      'a-111111111111',
      '--json'
    ]),
    error => {
      assert.match(JSON.parse(error.stdout).error, /memory needs --stages/)
      return true
    }
  )
})

test('a missing actor or no stages is refused', async () => {
  const one = fixture([{ halo_mib: 1, guest_used_mib: 1, top: [] }])
  await assert.rejects(measure({ ...one, actor: '' }), MemoryError)
  await assert.rejects(
    measure({ ...one, stages: [] }),
    /needs at least one stage/
  )
  assert.deepEqual(one.ran, [])
})
