/**
 * hs-f3: a drained bundle is put back on a halo before a restore reads it.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BundleError, place_bundle } from '../../src/control/bundle.js'
import { out_path } from '#root/lib/output.js'

const config = { zone: 'us-central1-a', bucket: 'realness-online-realness' }

const fixture = ({
  pull = true,
  unpack = 'artifacts.tar.gz\nmanifest.json\n'
} = {}) => {
  const asked = []
  const cloud = {
    sshArgs: (name, command) => ['compute', 'ssh', name, `--command=${command}`]
  }
  return {
    asked,
    cloud,
    config,
    run: async argv => {
      asked.push(argv.join(' '))
      if (argv[0] === 'storage' && argv[1] === 'cp' && !pull)
        return { ok: false, out: '', err: 'BucketNotFoundError' }
      if (argv.join(' ').includes('sudo tar -xzf /tmp'))
        return { ok: true, out: unpack, err: '' }
      return { ok: true, out: '', err: '' }
    }
  }
}

test('the bundle comes down, goes up, and is unpacked as an export', async () => {
  const one = fixture()
  const result = await place_bundle(
    one.cloud,
    config,
    'realness-2',
    'a-111111111111',
    {
      scratch: out_path('moves-test'),
      run: one.run
    }
  )
  assert.equal(result.export_dir, '/opt/fc/actors/mnt/exports/a-111111111111')
  const pulled = one.asked.find(line => line.startsWith('storage cp'))
  assert.match(
    pulled,
    /gs:\/\/realness-online-realness\/actors\/a-111111111111\/bundle\.tar\.gz/
  )
  assert.ok(
    one.asked.some(
      line =>
        line.includes('compute scp') &&
        line.includes('realness-2:/tmp/a-111111111111-bundle.tar.gz')
    )
  )
  assert.ok(
    one.asked.some(line =>
      line.includes(
        `tar -xzf /tmp/a-111111111111-bundle.tar.gz -C /opt/fc/actors/mnt/exports/a-111111111111`
      )
    )
  )
})

test('a missing bundle names the actor and does not touch the halo', async () => {
  const one = fixture({ pull: false })
  await assert.rejects(
    place_bundle(one.cloud, config, 'realness-2', 'a-111111111111', {
      scratch: out_path('moves-test'),
      run: one.run
    }),
    error => {
      assert.ok(error instanceof BundleError)
      assert.match(error.message, /no bundle for a-111111111111/)
      return true
    }
  )
  assert.ok(one.asked.every(line => line.startsWith('storage cp')))
})

test('an incomplete unpack is refused, naming the missing part', async () => {
  const one = fixture({ unpack: 'manifest.json\n' })
  await assert.rejects(
    place_bundle(one.cloud, config, 'realness-2', 'a-111111111111', {
      scratch: out_path('moves-test'),
      run: one.run
    }),
    /missing artifacts\.tar\.gz/
  )
})
