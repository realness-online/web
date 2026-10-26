import { zipped_storage } from '../harness/zipped-storage.js'
import assert from 'node:assert/strict'
import {
  mkdir,
  mkdtemp,
  readFile as read_file,
  rm,
  writeFile as write_file
} from 'node:fs/promises'
import { join } from 'node:path'
import { it } from 'node:test'
import { run } from '../../src/command/command.js'
import { disk } from '#root/src/can/disk.js'
import { issue_harness_pass } from '#root/src/sign-on/node/recovery-pass.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'

const artifacts = new URL(
  '../../../../artifacts/realness/entry-tests/',
  import.meta.url
).pathname

it('the public entry brackets a harness turn without credentials or network', async t => {
  await mkdir(artifacts, { recursive: true })
  const root = await mkdtemp(join(artifacts, 'run-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await write_file(join(root, '.ignore'), 'state/\n')
  await write_file(join(root, 'note.md'), 'one\n')
  let output = ''
  const options = {
    root,
    state: join(root, 'state'),
    stdout: {
      write: text => {
        output += text
      }
    },
    stderr: {
      write: text => {
        output += text
      }
    },
    get_token: () => {
      throw Error('turn-start must not sign in')
    }
  }
  assert.equal(
    await run(['turn-start', '--session', 'test-session'], options),
    0,
    output
  )
  assert.equal(await read_file(join(root, 'note.md'), 'utf8'), 'one\n')
  output = ''
  assert.equal(
    await run(['turn-start', '--session', 'json-session', '--json'], options),
    0
  )
  assert.deepEqual(JSON.parse(output), {
    ok: true,
    command: 'turn-start',
    result: null
  })
  output = ''
  assert.equal(await run(['turn-start', '--json'], options), 2)
  assert.equal(JSON.parse(output).error.code, 'usage')
})

it('one product command advertises both harness and file operations', async () => {
  let output = ''
  assert.equal(
    await run(['--help'], {
      stdout: {
        write: text => {
          output += text
        }
      }
    }),
    0
  )
  assert.match(output, /turn-start/)
  assert.match(output, /files sync/)
})

it('the same file command renews an actor pass and respects its path limit', async t => {
  await mkdir(artifacts, { recursive: true })
  const root = await mkdtemp(join(artifacts, 'actor-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const storage = zipped_storage(disk(join(root, 'storage')))
  const phone = '+15555550123'
  const secret = 'actor-entry-test-secret-with-thirty-two-bytes'
  await storage.put(`people/${phone}/harness/vault/note.md`, 'saved note')
  await storage.put(`people/${phone}/harness/private/note.md`, 'private note')
  const server = sync_service({
    storage,
    rights: rights(storage),
    halo_pass_secret: secret,
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  t.after(
    () =>
      new Promise(done => {
        server.closeAllConnections()
        server.close(done)
      })
  )
  let issued = 0
  let output = ''
  const options = {
    actor: true,
    root,
    state: join(root, '.pi/agent/state'),
    service_url: `http://127.0.0.1:${server.address().port}`,
    issue: () =>
      issue_harness_pass(
        { phone, id: 'a-abcdef123456', paths: ['vault'] },
        secret,
        issued++ ? Date.now() : Date.now() - 600_000
      ),
    get_token: () => {
      throw Error('actors must not use desktop credentials')
    },
    stdout: {
      write: text => {
        output += text
      }
    }
  }
  assert.equal(
    await run(
      ['files', 'cat', 'can://~/harness/vault/note.md', '--json'],
      options
    ),
    0
  )
  assert.equal(JSON.parse(output).result.content, 'saved note')
  assert.equal(issued, 2)
  output = ''
  assert.equal(
    await run(
      ['files', 'cat', 'can://~/harness/private/note.md', '--json'],
      options
    ),
    1
  )
  assert.equal(JSON.parse(output).error.status, 403)
})
