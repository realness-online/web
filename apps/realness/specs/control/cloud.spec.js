import assert from 'node:assert/strict'
import { it } from 'node:test'
import { gcloud } from '../../src/control/cloud.js'

const config = { project: 'realness-development', zone: 'us-central1-a' }

/** A client whose two shell seams answer from a queue instead of gcloud. */
const fake = (answers = {}) => {
  const client = gcloud(config)
  const asked = []
  client.call = async args => {
    asked.push(['call', args])
    return answers.call ?? 'ready'
  }
  client.try = async args => {
    asked.push(['try', args])
    return answers.try ?? { ok: true, out: 'realness-1', err: '', code: 0 }
  }
  return { client, asked }
}

it('the project and zone travel in the environment, not as flags', () => {
  const { client } = fake()
  assert.equal(client.env.CLOUDSDK_CORE_PROJECT, 'realness-development')
  assert.equal(client.env.CLOUDSDK_COMPUTE_ZONE, 'us-central1-a')
})

it('args prefixes compute for the modules that build ssh calls', () => {
  const { client } = fake()
  assert.deepEqual(client.args(['instances', 'list']), [
    'compute',
    'instances',
    'list'
  ])
})

it('sshArgs carries the zone, quiet, and one command', () => {
  const { client } = fake()
  assert.deepEqual(client.sshArgs('realness-1', 'uptime'), [
    'compute',
    'ssh',
    'realness-1',
    '--zone=us-central1-a',
    '--quiet',
    '--command=uptime'
  ])
})

it('sshArgs leaves the zone out for a zone-less config', () => {
  const client = gcloud({ project: 'p' })
  assert.deepEqual(client.sshArgs('realness-1', 'uptime'), [
    'compute',
    'ssh',
    'realness-1',
    '--quiet',
    '--command=uptime'
  ])
})

it('scpArgs only recurses when asked', () => {
  const { client } = fake()
  assert.deepEqual(client.scpArgs('a', 'b'), [
    'compute',
    'scp',
    '--zone=us-central1-a',
    '--quiet',
    'a',
    'b'
  ])
  assert.deepEqual(client.scpArgs('a', 'b', { recurse: true }), [
    'compute',
    'scp',
    '--zone=us-central1-a',
    '--quiet',
    '--recurse',
    'a',
    'b'
  ])
})

it('value asks for one field by default and trims it', async () => {
  const { client, asked } = fake({ call: '  RUNNING \n' })
  assert.equal(
    await client.value(['instances', 'describe', 'realness-1']),
    'RUNNING'
  )
  assert.deepEqual(asked[0][1], [
    'instances',
    'describe',
    'realness-1',
    '--format=value(status)'
  ])
})

it('value takes the format the caller names', async () => {
  const { client, asked } = fake({ call: '1.2.3.4' })
  await client.value(
    ['instances', 'describe', 'realness-1'],
    'value(networkInterfaces[0])'
  )
  assert.equal(asked[0][1].at(-1), '--format=value(networkInterfaces[0])')
})

it('json parses the output, and empty output reads as an empty list', async () => {
  const listed = fake({ call: '[{"name":"realness-1"}]' })
  assert.deepEqual(await listed.client.json(['instances', 'list']), [
    { name: 'realness-1' }
  ])
  assert.equal(listed.asked[0][1].at(-1), '--format=json')

  const empty = fake({ call: '' })
  assert.deepEqual(await empty.client.json(['instances', 'list']), [])
})

it('exists is true only when describe names something', async () => {
  const found = fake({
    try: { ok: true, out: 'realness-1\n', err: '', code: 0 }
  })
  assert.equal(await found.client.exists(['disks', 'describe', 'data']), true)
  assert.equal(found.asked[0][1].at(-1), '--format=value(name)')

  const missing = fake({
    try: { ok: false, out: '', err: 'not found', code: 1 }
  })
  assert.equal(
    await missing.client.exists(['disks', 'describe', 'data']),
    false
  )

  const blank = fake({ try: { ok: true, out: '   \n', err: '', code: 0 } })
  assert.equal(await blank.client.exists(['disks', 'describe', 'data']), false)
})

it('exists refuses a bare prefix, which gcloud would read as absent', async () => {
  const { client } = fake()
  await assert.rejects(
    client.exists(['disks']),
    /exists\(\) needs a command and a name/
  )
  await assert.rejects(
    client.exists([]),
    /exists\(\) needs a command and a name/
  )
})

it('ip returns the address, and nothing when the halo has none', async () => {
  const ready = fake({
    try: { ok: true, out: ' 34.1.2.3 \n', err: '', code: 0 }
  })
  assert.equal(await ready.client.ip('realness-1'), '34.1.2.3')
  assert.match(ready.asked[0][1].at(-1), /value\(networkInterfaces\[0\]/)

  const down = fake({
    try: { ok: false, out: '', err: 'no instance', code: 1 }
  })
  assert.equal(await down.client.ip('realness-1'), '')
})
