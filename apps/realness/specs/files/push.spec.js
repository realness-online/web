import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { it } from 'node:test'
import { push, push_args, push_destination } from '#root/src/files/push.js'

it('the Mac pushes into its own harness lane', () => {
  assert.equal(
    push_destination({ phone: '+15555550100', bucket: 'bucket.example' }),
    'gs://bucket.example/people/+15555550100/harness/'
  )
})

it('a push never carries a delete flag', () => {
  const args = push_args({ source: '/vault', destination: 'gs://b/people/a' })
  assert.deepEqual(args, ['rsync', '-r', '/vault', 'gs://b/people/a'])
  assert.ok(!args.some(arg => arg === '-d' || arg.startsWith('--delete')))
})

it('a dry run adds -n', () => {
  assert.deepEqual(
    push_args({ source: 'vault', destination: 'gs://b/x', dry_run: true }),
    ['rsync', '-r', '-n', 'vault', 'gs://b/x']
  )
})

/** A gsutil stand-in that reports its lines and exits with `code`. */
const fake_gsutil = code => {
  const runs = []
  const run = (command, args) => {
    runs.push([command, ...args])
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    setImmediate(() => {
      child.stdout.emit('data', Buffer.from('Copying file://vault\n'))
      child.emit('close', code)
    })
    return child
  }
  return { runs, run }
}

it('a push reports gsutil output and its exit', async () => {
  const lines = []
  const ok = fake_gsutil(0)
  await push({
    args: ['rsync', '-r', 'vault', 'gs://b/x'],
    on_line: l => lines.push(l),
    run: ok.run
  })
  assert.equal(ok.runs[0][0], 'gsutil')
  assert.deepEqual(lines, ['Copying file://vault'])

  const failed = fake_gsutil(1)
  await assert.rejects(
    push({ args: ['rsync'], run: failed.run }),
    /gsutil failed: 1/
  )
})
