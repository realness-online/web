import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir, stat, mkdir, rm } from 'node:fs/promises'
import { after, before, it } from 'node:test'
import { provision_record_key } from '../../src/control/halo-gcp.js'
import { out_path } from '#root/lib/output.js'

const scratch = out_path(`record-key-test-${randomUUID()}`)
const key = 'a'.repeat(64)
const config = {
  root: '~/realness',
  project: 'realness-online',
  storage: 'realness-online.appspot.com'
}
const calls = []
const cloud = {
  call: async argv => {
    calls.push(argv)
    return `${key}\n`
  }
}

before(() => mkdir(scratch, { recursive: true }))
after(() => rm(scratch, { recursive: true, force: true }))

it("operator registers the halo key in sync's bucket, then removes the local copy", async () => {
  let saved
  await provision_record_key(cloud, config, 'realness-1', {
    scratch,
    upload: async (file, destination) => {
      saved = {
        file,
        destination,
        body: await readFile(file, 'utf8'),
        mode: (await stat(file)).mode & 0o777
      }
    }
  })
  assert.deepEqual(calls.at(-1), [
    'ssh',
    'realness-1',
    '--quiet',
    '--command=sudo bash ~/realness/server/halo/scripts/record-key.sh'
  ])
  assert.equal(
    saved.destination,
    'gs://realness-online.appspot.com/halo-keys/realness-1'
  )
  assert.equal(saved.body, key)
  assert.equal(saved.mode, 0o600)
  assert.deepEqual(await readdir(scratch), [])
})

it('failed registration removes the local copy; bad names never reach SSH', async () => {
  const prior = calls.length
  await assert.rejects(
    provision_record_key(cloud, config, '../other', { scratch }),
    /invalid halo name/
  )
  assert.equal(calls.length, prior)
  await assert.rejects(
    provision_record_key(cloud, config, 'realness-1', {
      scratch,
      upload: async () => {
        throw new Error('upload failed')
      }
    }),
    /upload failed/
  )
  assert.deepEqual(await readdir(scratch), [])
})

it('a bad key returned by SSH is not registered', async () => {
  const bad = { call: async () => 'not a key' }
  await assert.rejects(
    provision_record_key(bad, config, 'realness-1', { scratch }),
    /invalid/
  )
  assert.deepEqual(await readdir(scratch), [])
})

it('a config without project or storage registers nothing', async () => {
  const prior = calls.length
  await assert.rejects(
    provision_record_key(cloud, { root: '~/realness' }, 'realness-1', {
      scratch
    }),
    /needs project and storage/
  )
  assert.equal(calls.length, prior)
})

it('revoke fences the halo in sync, then drops its record key', async () => {
  const { revoke } = await import('../../src/control/halo-gcp.js')
  const asked = []
  let fence
  const result = await revoke(config, 'realness-1', {
    scratch,
    now: () => '2026-10-15T00:00:00.000Z',
    gcloud: async argv => {
      asked.push(argv.join(' '))
      if (argv[1] === 'cp') fence = JSON.parse(await readFile(argv[2], 'utf8'))
    }
  })
  assert.deepEqual(result, { halo: 'realness-1', fenced: true })
  assert.match(
    asked[0],
    /gs:\/\/realness-online\.appspot\.com\/halo-fences\/realness-1$/
  )
  assert.equal(
    asked[1],
    'storage rm --continue-on-error gs://realness-online.appspot.com/halo-keys/realness-1'
  )
  assert.deepEqual(fence, {
    halo: 'realness-1',
    revoked_at: '2026-10-15T00:00:00.000Z'
  })
  assert.deepEqual(await readdir(scratch), [])
  await assert.rejects(revoke(config, '../x', { scratch }), /invalid halo name/)
})

it('pass secrets reach the halo on stdin, root-only, never on argv', async () => {
  const { install_secrets } = await import('../../src/control/halo-gcp.js')
  const sent = []
  const host = {
    sshArgs: (name, command) => ['compute', 'ssh', name, `--command=${command}`]
  }
  await install_secrets(host, config, 'realness-1', {
    read: async secret => `${secret.toLowerCase()}-${'x'.repeat(32)}\n`,
    send: async (argv, input) => sent.push({ argv: argv.join(' '), input })
  })
  assert.equal(sent.length, 2)
  assert.match(
    sent[0].argv,
    /install -D -m 0600 -o root -g root \/dev\/stdin \/etc\/realness\/halo-pass-secret$/
  )
  assert.match(sent[1].argv, /\/etc\/realness\/model-pass-secret$/)
  assert.ok(sent.every(({ argv, input }) => !argv.includes(input)))
  assert.equal(sent[0].input, `halo_pass_secret-${'x'.repeat(32)}`)
  await assert.rejects(
    install_secrets(host, config, 'realness-1', {
      read: async () => 'short',
      send: async () => {}
    }),
    /HALO_PASS_SECRET is missing or too short/
  )
})
