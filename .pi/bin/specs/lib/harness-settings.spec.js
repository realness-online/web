import { it, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, rm, writeFile, copyFile, symlink } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { plans_path, plans_ignore } from '../../lib/harness-settings.js'

const root = new URL(`../../../../artifacts/realness/settings-${randomUUID()}/`, import.meta.url).pathname
after(() => rm(root, { recursive: true, force: true }))

it('v8: plans default to vault/plans and accept an explicit folder', async () => {
  await mkdir(root, { recursive: true })
  assert.equal(plans_path(root), 'vault/plans')
  await writeFile(`${root}/package.json`, '{}')
  assert.equal(plans_path(root), 'vault/plans')
  await writeFile(`${root}/package.json`, JSON.stringify({ realness: { plans: 'custom/plans' } }))
  assert.equal(plans_path(root), 'custom/plans')
})

it('the plan checker reads either configured folder', async () => {
  const fixture = `${root}/checker`
  await mkdir(`${fixture}/.pi/bin/lib`, { recursive: true })
  await mkdir(`${fixture}/.pi/bin/plans`, { recursive: true })
  await copyFile(new URL('../../plans/plan-shape.js', import.meta.url), `${fixture}/.pi/bin/plans/plan-shape.js`)
  await copyFile(new URL('../../lib/harness-settings.js', import.meta.url), `${fixture}/.pi/bin/lib/harness-settings.js`)
  await copyFile(new URL('../../lib/product.js', import.meta.url), `${fixture}/.pi/bin/lib/product.js`)
  await copyFile(new URL('../../lib/palette.js', import.meta.url), `${fixture}/.pi/bin/lib/palette.js`)
  await mkdir(`${fixture}/apps`, { recursive: true })
  await symlink(new URL('../../../../apps/realness', import.meta.url), `${fixture}/apps/realness`)
  for (const plans of ['plans', 'vault/plans']) {
    await mkdir(`${fixture}/${plans}`, { recursive: true })
    await writeFile(`${fixture}/package.json`, JSON.stringify({ type: 'module', realness: { plans } }))
    await writeFile(`${fixture}/${plans}/p.md`, '# P\n\n```mermaid\nflowchart TD\n a["a test"]\n```\n\n## Nodes\n\n## Notes\n')
    const { stdout } = await promisify(execFile)(process.execPath, [`${fixture}/.pi/bin/plans/plan-shape.js`])
    assert.match(stdout, /1 plans, 0 failed/)
  }
})

it('v8: non-plan files in the plans folder are listed, or none', async () => {
  await mkdir(root, { recursive: true })
  assert.deepEqual(plans_ignore(root), [])
  await writeFile(`${root}/package.json`, '{}')
  assert.deepEqual(plans_ignore(root), [])
  await writeFile(`${root}/package.json`, JSON.stringify({ realness: { plansIgnore: ["Todo's.md"] } }))
  assert.deepEqual(plans_ignore(root), ["Todo's.md"])
  for (const plansIgnore of ['Todo', [''], ['a/b'], ['a\\b'], [42]]) {
    await writeFile(`${root}/package.json`, JSON.stringify({ realness: { plansIgnore } }))
    assert.throws(() => plans_ignore(root), /realness.plansIgnore/)
  }
})

it('invalid settings and broken JSON stay visible', async () => {
  for (const plans of ['', '/elsewhere', '../elsewhere', 'vault/../plans', 'vault\\plans', 42]) {
    await writeFile(`${root}/package.json`, JSON.stringify({ realness: { plans } }))
    assert.throws(() => plans_path(root), /realness.plans/)
  }
  await writeFile(`${root}/package.json`, '{')
  assert.throws(() => plans_path(root), SyntaxError)
})

it('p1: person.local.html names the person; package.json is only a fallback', async () => {
  const { person, local_person } = await import('../../lib/harness-settings.js')
  const dir = `${root}/identity`
  await mkdir(dir, { recursive: true })
  assert.equal(person(dir), null)
  await writeFile(`${dir}/package.json`, JSON.stringify({ realness: { person: '+14155550123' } }))
  assert.equal(person(dir), '/+14155550123')
  await writeFile(`${dir}/person.local.html`, '<p itemscope itemtype="https://schema.org/Person"><a itemprop="telephone" href="tel:+14156667777">Ada <b>L</b></a></p>')
  assert.equal(person(dir), '/+14156667777')
  assert.deepEqual(local_person(dir), { phone: '+14156667777', name: 'Ada L' })
  await writeFile(`${dir}/person.local.html`, '<a href="tel:+14155550999">Plain</a>')
  assert.equal(person(dir), '/+14155550999')
  await writeFile(`${dir}/person.local.html`, '<a itemprop="telephone" href="tel:4155550123">Bad</a>')
  assert.throws(() => person(dir), /phone number/)
  await writeFile(`${dir}/person.local.html`, '<p>nobody</p>')
  assert.throws(() => person(dir), /needs a link like/)
})

it('p1: the shared checkout config carries no personal identity', async () => {
  const { readFile } = await import('node:fs/promises')
  const shared = JSON.parse(await readFile(new URL('../../../../package.json', import.meta.url), 'utf8'))
  assert.equal(shared.realness?.person, undefined)
  const ignored = await readFile(new URL('../../../../.gitignore', import.meta.url), 'utf8')
  assert.match(ignored, /^\/person\.local\.html$/m)
})
