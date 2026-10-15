import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import {
  chmod,
  mkdir,
  readFile,
  readlink,
  rm,
  stat,
  symlink,
  writeFile
} from 'node:fs/promises'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { disk } from '#root/src/can/disk.js'
import { client } from '#root/src/files/client.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'
import { starter_choice } from '#root/src/files/starter.js'

const root = new URL(
  `../../../../artifacts/realness/starter-${randomUUID()}/`,
  import.meta.url
).pathname
const issuer = dev_issuer()
let server, store
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const manifest = entries => {
  const files = Object.fromEntries(
    Object.entries(entries).map(([name, bytes]) => [name, hash(bytes)])
  )
  return { version: hash(JSON.stringify(files)), files }
}
const write = async (directory, entries) => {
  for (const [name, bytes] of Object.entries(entries)) {
    await mkdir(join(directory, name, '..'), { recursive: true })
    await writeFile(join(directory, name), bytes)
  }
}

before(async () => {
  const storage = disk(join(root, 'bucket'))
  server = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  store = client({
    url: `http://127.0.0.1:${server.address().port}`,
    token: issuer.token('+15555550200')
  })
})
after(async () => {
  server.closeAllConnections()
  await new Promise(done => server.close(done))
  await rm(root, { recursive: true, force: true })
})

const prepare = async name => {
  const old = {
    'skill.md': 'old skill',
    'edited.md': 'old edit',
    'gone.md': 'old gone',
    'removed.md': 'old removed',
    'removed-edited.md': 'old removed edit'
  }
  const latest = {
    'skill.md': 'new skill',
    'edited.md': 'new edit',
    'gone.md': 'new gone',
    'added.md': 'new file'
  }
  const directory = join(root, name, 'distribution')
  const local = join(root, name, 'local')
  const remote = `can://~/${name}/`
  const next_manifest = JSON.stringify(manifest(latest))
  await write(directory, { ...latest, 'starter.json': next_manifest })
  await write(local, {
    ...latest,
    'starter.json': next_manifest,
    'note.md': 'local note'
  })
  for (const [path, bytes] of Object.entries({
    ...old,
    'starter.json': JSON.stringify(manifest(old))
  }))
    await store.put(`${remote}${path}`, bytes)
  await store.put(`${remote}edited.md`, 'personal edit')
  await store.put(`${remote}removed-edited.md`, 'personal removed-file edit')
  await store.rm(`${remote}gone.md`)
  return { directory, local, remote, latest }
}

const verify_local = async local => {
  assert.equal(await readFile(join(local, 'skill.md'), 'utf8'), 'new skill')
  assert.equal(
    await readFile(join(local, 'edited.md'), 'utf8'),
    'personal edit'
  )
  assert.equal(
    await readFile(join(local, 'removed-edited.md'), 'utf8'),
    'personal removed-file edit'
  )
  assert.equal(await readFile(join(local, 'added.md'), 'utf8'), 'new file')
  assert.equal(await readFile(join(local, 'note.md'), 'utf8'), 'local note')
  for (const name of ['gone.md', 'removed.md'])
    await assert.rejects(readFile(join(local, name)), { code: 'ENOENT' })
}

test('recovery takes unchanged starter updates and keeps personal edits and deletions', async () => {
  const { directory, local, remote, latest } = await prepare('recovery')
  await store.sync(local, remote, {
    starter: directory,
    pull_only: true,
    trash: join(root, 'trash')
  })
  await verify_local(local)
  assert.equal(
    (await store.cat(`${remote}skill.md`)).toString(),
    'old skill',
    'recovery is read-only'
  )
  assert.deepEqual(
    JSON.parse(await readFile(join(local, 'starter.json'), 'utf8')),
    manifest(latest)
  )
})

test('normal sync publishes starter updates through its existing file transport', async () => {
  const { directory, local, remote, latest } = await prepare('writable')
  const options = {
    starter: directory,
    state: join(root, 'state'),
    trash: join(root, 'trash')
  }
  const report = await store.sync(local, remote, options)
  assert.deepEqual(
    report.kept_both,
    [],
    'stock upgrades do not make conflict copies'
  )
  await verify_local(local)
  assert.equal((await store.cat(`${remote}skill.md`)).toString(), 'new skill')
  assert.equal(
    (await store.cat(`${remote}edited.md`)).toString(),
    'personal edit'
  )
  await assert.rejects(store.cat(`${remote}removed.md`), { status: 404 })
  await assert.rejects(store.cat(`${remote}gone.md`), { status: 404 })
  assert.deepEqual(
    JSON.parse((await store.cat(`${remote}starter.json`)).toString()),
    manifest(latest)
  )
  const second = await store.sync(local, remote, options)
  assert.deepEqual(second.pushed, [])
  assert.deepEqual(second.pulled, [])
  assert.deepEqual(second.kept_both, [])
  const fresh = join(root, 'writable', 'fresh')
  await write(fresh, {
    ...latest,
    'starter.json': JSON.stringify(manifest(latest)),
    'note.md': 'local note'
  })
  await store.sync(fresh, remote, { ...options, pull_only: true })
  await verify_local(fresh)
})

test('a local edit or deletion is never replaced by a starter update', async () => {
  const { directory, local, remote } = await prepare('personal')
  await writeFile(join(local, 'skill.md'), 'my local skill')
  await rm(join(local, 'edited.md'))
  const report = await store.sync(local, remote, {
    starter: directory,
    pull_only: true,
    trash: join(root, 'trash')
  })
  assert.equal(
    await readFile(join(local, 'skill.md'), 'utf8'),
    'my local skill'
  )
  await assert.rejects(readFile(join(local, 'edited.md')), { code: 'ENOENT' })
  assert.ok(report.held.includes('skill.md'))
  assert.ok(report.held.includes('edited.md'))
})

test('new executable starter files retain their distributed permissions', async () => {
  const directory = join(root, 'executable', 'distribution')
  const local = join(root, 'executable', 'local')
  const entries = { 'bin/run': '#!/bin/sh\necho ready\n' }
  await write(directory, {
    ...entries,
    'starter.json': JSON.stringify(manifest(entries))
  })
  await chmod(join(directory, 'bin/run'), 0o755)
  await mkdir(local, { recursive: true })
  await store.sync(local, 'can://~/executable/', {
    starter: directory,
    state: join(root, 'executable-state')
  })
  assert.equal((await stat(join(local, 'bin/run'))).mode & 0o777, 0o755)
  assert.equal(
    await readFile(join(local, 'bin/run'), 'utf8'),
    entries['bin/run']
  )
})

test('an older VM cannot downgrade a newer saved starter', async () => {
  const directory = join(root, 'outdated', 'distribution')
  const local = join(root, 'outdated', 'local')
  const remote = 'can://~/outdated/'
  const old = {
    ...manifest({ 'skill.md': 'old' }),
    built_at: '2026-10-01T00:00:00.000Z'
  }
  const newer = {
    ...manifest({ 'skill.md': 'new' }),
    built_at: '2026-10-04T00:00:00.000Z'
  }
  await write(directory, {
    'skill.md': 'old',
    'starter.json': JSON.stringify(old)
  })
  await write(local, { 'skill.md': 'old', 'starter.json': JSON.stringify(old) })
  await store.put(`${remote}skill.md`, 'new')
  await store.put(`${remote}starter.json`, JSON.stringify(newer))
  await store.sync(local, remote, {
    starter: directory,
    state: join(root, 'outdated-state')
  })
  assert.equal(await readFile(join(local, 'skill.md'), 'utf8'), 'new')
  assert.equal((await store.cat(`${remote}skill.md`)).toString(), 'new')
  assert.deepEqual(
    JSON.parse(await readFile(join(local, 'starter.json'), 'utf8')),
    newer
  )
})

test('a raced starter checkpoint keeps the old base until a safe retry', async () => {
  const { directory, local, remote, latest } = await prepare('race')
  const options = {
    starter: directory,
    state: join(root, 'race-state'),
    trash: join(root, 'trash')
  }
  const racing = client({
    url: `http://127.0.0.1:${server.address().port}`,
    token: issuer.token('+15555550200'),
    fetcher: (url, options) => {
      if (url.endsWith('/starter.json') && options.method === 'PUT')
        return Promise.resolve(new Response('', { status: 412 }))
      return fetch(url, options)
    }
  })
  const first = await racing.sync(local, remote, options)
  assert.deepEqual(first.conflicts, ['starter.json'])
  assert.notEqual(
    JSON.parse((await store.cat(`${remote}starter.json`)).toString()).version,
    manifest(latest).version
  )
  const retry = await store.sync(local, remote, options)
  assert.deepEqual(retry.conflicts, [])
  assert.deepEqual(retry.held, [])
  assert.deepEqual(
    JSON.parse((await store.cat(`${remote}starter.json`)).toString()),
    manifest(latest)
  )
  await verify_local(local)
})

test('starter bytes must match their hashes and local links remain links', async () => {
  const { directory, local, remote, latest } = await prepare('integrity')
  const next = manifest(latest)
  next.files['linked'] = 'link:skill.md'
  await writeFile(join(directory, 'starter.json'), JSON.stringify(next))
  await symlink('skill.md', join(local, 'linked'))
  await writeFile(join(directory, 'skill.md'), 'corrupt distribution')
  await assert.rejects(
    store.sync(local, remote, {
      starter: directory,
      pull_only: true,
      trash: join(root, 'trash')
    }),
    /starter hash mismatch/
  )
  assert.equal(await readlink(join(local, 'linked')), 'skill.md')
  assert.equal((await store.cat(`${remote}skill.md`)).toString(), 'old skill')
})

test('unknown existing files and new-name collisions stay personal', () => {
  const next = manifest({ 'skill.md': 'new' })
  assert.equal(
    starter_choice(
      { latest: next },
      'skill.md',
      Buffer.from('new'),
      Buffer.from('mine')
    ),
    'remote'
  )
  assert.equal(
    starter_choice({ latest: next }, 'skill.md', Buffer.from('mine'), null),
    'personal'
  )
  assert.equal(
    starter_choice({ latest: next }, 'note.md', Buffer.from('note'), null),
    'normal'
  )
})
