import assert from 'node:assert/strict'
import { it } from 'node:test'
import { execFile as exec_file } from 'node:child_process'
import { mkdir, mkdtemp, readFile as read_file, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { disk } from '../../src/can/disk.js'
import { read_admins } from '../../src/sync/admins.js'
import {
  manage_admins,
  parse_admins,
  plan_admins,
  render_admins
} from '../../src/control/admins.js'

const SCOTT = '+14156667777'
const ADA = '+14155550123'
const webspace = resolve(import.meta.dirname, '../../tools/cli/bin/realness.js')

const scratch = async t => {
  const dir = await mkdtemp(join(tmpdir(), 'admins-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

it('rendered pages round-trip through the reader sync uses, names escaped', () => {
  const list = [
    { phone: SCOTT, name: 'Scott <ops> & "co"' },
    { phone: ADA, name: '' }
  ]
  const html = render_admins(list)
  assert.deepEqual([...read_admins(html)], [SCOTT, ADA])
  assert.deepEqual(parse_admins(html), [
    { phone: SCOTT, name: 'Scott <ops> & "co"' },
    { phone: ADA, name: ADA }
  ])
  assert.ok(!html.includes('<ops>'))
})

it('parse reads hand-written pages and keeps the first entry for a phone', () => {
  const html = `<a href="tel:${SCOTT}">Scott</a> <a class="x" href="tel:${SCOTT}">Dup</a> <a href="tel:123">bad</a>`
  assert.deepEqual(parse_admins(html), [{ phone: SCOTT, name: 'Scott' }])
})

it('plans: add is idempotent, phones are validated, the last admin stays', () => {
  const one = [{ phone: SCOTT, name: 'Scott' }]
  assert.equal(plan_admins(one, { verb: 'add', phone: SCOTT }).changed, false)
  assert.deepEqual(
    plan_admins(one, { verb: 'add', phone: ADA, name: ' Ada ' }).list.at(-1),
    { phone: ADA, name: 'Ada' }
  )
  assert.throws(
    () => plan_admins(one, { verb: 'add', phone: '4155550123' }),
    /must look like/
  )
  assert.throws(
    () => plan_admins(one, { verb: 'remove', phone: SCOTT }),
    /last admin/
  )
  assert.equal(plan_admins(one, { verb: 'remove', phone: ADA }).changed, false)
  assert.throws(() => plan_admins(one, { verb: 'grant', phone: ADA }), /usage/)
})

it('without yes nothing is written; with yes the page is created then edited', async t => {
  const storage = disk(await scratch(t))
  const dry = await manage_admins(storage, {
    verb: 'add',
    phone: SCOTT,
    name: 'Scott'
  })
  assert.equal(dry.changed, true)
  assert.equal(dry.written, false)
  assert.equal(await storage.get('admins.html'), null)

  assert.equal(
    (
      await manage_admins(storage, {
        verb: 'add',
        phone: SCOTT,
        name: 'Scott',
        yes: true
      })
    ).written,
    true
  )
  await manage_admins(storage, {
    verb: 'add',
    phone: ADA,
    name: 'Ada',
    yes: true
  })
  await manage_admins(storage, { verb: 'remove', phone: SCOTT, yes: true })
  const page = (await storage.get('admins.html')).body.toString('utf8')
  assert.deepEqual([...read_admins(page)], [ADA])
  await assert.rejects(
    manage_admins(storage, { verb: 'remove', phone: ADA, yes: true }),
    /last admin/
  )
})

it('a write loses to a concurrent edit instead of overwriting it', async t => {
  const storage = disk(await scratch(t))
  await storage.put(
    'admins.html',
    render_admins([{ phone: SCOTT, name: 'Scott' }])
  )
  const racing = {
    ...storage,
    get: async key => {
      const seen = await storage.get(key)
      await storage.put(
        key,
        render_admins([
          { phone: SCOTT, name: 'Scott' },
          { phone: '+14155550999', name: 'Other' }
        ])
      )
      return seen
    }
  }
  await assert.rejects(
    manage_admins(racing, { verb: 'add', phone: ADA, yes: true }),
    error => error.code === 'conflict'
  )
  assert.equal(
    read_admins((await storage.get('admins.html')).body.toString('utf8')).has(
      ADA
    ),
    false
  )
})

it('realness local admins: dry-run, --yes, list (phones masked)', async t => {
  const dir = await scratch(t)
  const run = (...args) =>
    promisify(exec_file)(process.execPath, [
      webspace,
      'local',
      'admins',
      ...args,
      `--dir=${dir}`
    ])
  const dry = await run('add', SCOTT, 'Scott')
  assert.match(dry.stdout, /would write \(rerun with --yes\)/)
  await assert.rejects(read_file(join(dir, 'admins.html')))
  await run('add', SCOTT, 'Scott', '--yes')
  assert.deepEqual(
    [...read_admins(await read_file(join(dir, 'admins.html'), 'utf8'))],
    [SCOTT]
  )
  const listed = await run('list')
  assert.match(listed.stdout, /\+1\*\*\*77 {2}Scott/)
  assert.ok(!listed.stdout.includes(SCOTT))
  await assert.rejects(run('grant', ADA), /usage: realness <env> admins/)
})

const person_page = (phone, name) =>
  `<p itemscope itemtype="https://schema.org/Person"><a itemprop="telephone" href="tel:${phone}">${name}</a></p>\n`

it('init gives a new environment its first admin and never edits an existing list', async t => {
  const { ensure_admins } = await import('../../src/control/admins.js')
  const storage = disk(await scratch(t))
  await assert.rejects(
    ensure_admins(storage, [null], { create_only: true }),
    /no first admin: add person\.local\.html/
  )
  assert.equal(
    (
      await ensure_admins(storage, [{ phone: SCOTT, name: 'Scott' }], {
        create_only: true
      })
    ).written,
    true
  )
  const again = await ensure_admins(storage, [{ phone: ADA, name: 'Ada' }], {
    create_only: true
  })
  assert.equal(again.written, false)
  assert.deepEqual(
    [...read_admins((await storage.get('admins.html')).body.toString('utf8'))],
    [SCOTT]
  )
})

it('realness local admins init reads person.local.html from the harness', async t => {
  const dir = await scratch(t)
  const harness = await scratch(t)
  const { writeFile: write_file } = await import('node:fs/promises')
  await mkdir(join(harness, '.pi'), { recursive: true })
  await write_file(join(harness, '.pi/person.local.html'), person_page(ADA, 'Ada'))
  const run = (...args) =>
    promisify(exec_file)(process.execPath, [
      webspace,
      'local',
      'admins',
      ...args,
      `--dir=${dir}`,
      `--harness=${harness}`
    ])
  assert.match(
    (await run('init')).stdout,
    /first admin:\n {2}\+1\*\*\*23 {2}Ada/
  )
  assert.match((await run('init')).stdout, /admins\.html exists; left as is/)
})

it("local seeding keeps the test operator and adds the checkout's person once", async t => {
  const { seed_local_admins, DEV_OPERATOR } =
    await import('../../src/control/halo-lima.js')
  const storage = disk(await scratch(t))
  const harness = await scratch(t)
  await seed_local_admins({ storage, harness })
  assert.deepEqual(
    [...read_admins((await storage.get('admins.html')).body.toString('utf8'))],
    [DEV_OPERATOR.phone]
  )
  const { writeFile: write_file } = await import('node:fs/promises')
  await mkdir(join(harness, '.pi'), { recursive: true })
  await write_file(join(harness, '.pi/person.local.html'), person_page(ADA, 'Ada'))
  await seed_local_admins({ storage, harness })
  assert.equal((await seed_local_admins({ storage, harness })).written, false)
  assert.deepEqual(
    [...read_admins((await storage.get('admins.html')).body.toString('utf8'))],
    [DEV_OPERATOR.phone, ADA]
  )
})

it('a signed-in non-admin is told who can add them', async () => {
  const { not_admin_hint } = await import('../../src/control/admins.js')
  assert.equal(
    not_admin_hint('development', ADA),
    `${ADA} is signed in but is not an admin in development. An admin can run: realness development admins add ${ADA} --yes`
  )
})

it('the phone shows as text; who is admin still comes from href alone', () => {
  const html = render_admins([{ phone: SCOTT, name: 'Scott' }])
  assert.ok(html.replace(/<[^>]*>/g, ' ').includes(SCOTT))
  assert.deepEqual(parse_admins(html), [{ phone: SCOTT, name: 'Scott' }])
  const lying = html.replace(`>${SCOTT}</a>`, `>${ADA}</a>`)
  assert.deepEqual([...read_admins(lying)], [SCOTT])
})
