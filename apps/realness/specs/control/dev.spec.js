/**
 * `dev setup` stands a Lima VM up and checks its boot.
 *
 * `setup` takes its lima object, so a stand-in runs the whole sequence. The
 * call is made in a child process so that `set_json_output(true)` can move the
 * step and note lines to stderr; the parent reads one JSON line from stdout,
 * which is the same pattern specs/control/output.spec.js uses.
 *
 * `dev build` is not covered: its first act is to run
 * `tools/control/scripts/harness-stage.sh` against the real tree.
 */
import { it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import { resolve } from 'node:path'

/** The package root, so the child resolves `#root` whatever launched the suite. */
const package_root = resolve(import.meta.dirname, '../..')

const run_setup = lima_body =>
  spawn_sync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
      import { set_json_output } from '#root/src/control/output.js'
      import { setup } from '#root/src/control/dev.js'
      set_json_output(true)
      const asked = []
      const lima = ${lima_body}
      const result = await setup(lima)
      process.stdout.write(JSON.stringify({ result, asked }) + '\\n')
      `
    ],
    { cwd: package_root, encoding: 'utf8' }
  )

const parse = result => {
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

it('dev setup starts the VM, sets the guest up, and checks it boots', () => {
  const { result, asked } = parse(
    run_setup(`{
      config: { vm: 'realness-dev' },
      start: async path => { asked.push(['start', path]); return 'started' },
      streamScript: async script => { asked.push(['streamScript', script]) }
    }`)
  )

  assert.deepEqual(result, { halo: 'realness-dev', ready: true })
  assert.deepEqual(
    asked.map(([kind]) => kind),
    ['start', 'streamScript', 'streamScript']
  )
  assert.match(asked[0][1], /server[\\/]lima[\\/]fc-local\.yaml$/)
  assert.deepEqual(
    asked.slice(1).map(([, script]) => script),
    [
      'tools/control/scripts/guest-setup.sh',
      'tools/control/scripts/boot-check.sh'
    ]
  )
})

it('the steps go to stderr, so stdout carries only the answer', () => {
  const child = run_setup(`{
    config: { vm: 'other-dev' },
    start: async () => 'started',
    streamScript: async () => {}
  }`)
  assert.deepEqual(parse(child).result, { halo: 'other-dev', ready: true })
  assert.equal(child.stdout.trim().split('\n').length, 1)
  assert.match(child.stderr, /==> lima: other-dev/)
  assert.match(child.stderr, /==> firecracker, kernel, rootfs/)
})

it('a VM that will not start stops setup before it touches the guest', () => {
  const failed = run_setup(`{
    config: { vm: 'realness-dev' },
    start: async () => { throw new Error('limactl: no such instance') },
    streamScript: async script => { throw new Error('should not run ' + script) }
  }`)
  assert.equal(failed.status, 1)
  assert.match(failed.stderr, /limactl: no such instance/)
  assert.doesNotMatch(failed.stderr, /should not run/)
})
