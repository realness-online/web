import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, rm, writeFile, copyFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { plans_path, plans_ignore } from './harness-settings.js'

const root = new URL(`../../artifacts/brayness/settings-${randomUUID()}/`, import.meta.url).pathname
after(() => rm(root, { recursive: true, force: true }))

test('v8: plans default to vault/plans and accept an explicit folder', async () => {
  await mkdir(root, { recursive: true })
  assert.equal(plans_path(root), 'vault/plans')
  await writeFile(`${root}/package.json`, '{}')
  assert.equal(plans_path(root), 'vault/plans')
  await writeFile(`${root}/package.json`, JSON.stringify({ brayness: { plans: 'custom/plans' } }))
  assert.equal(plans_path(root), 'custom/plans')
})

test('the plan checker reads either configured folder', async () => {
  const fixture = `${root}/checker`
  await mkdir(`${fixture}/bin/lib`, { recursive: true })
  await copyFile(new URL('../plan-shape.js', import.meta.url), `${fixture}/bin/plan-shape.js`)
  await copyFile(new URL('./harness-settings.js', import.meta.url), `${fixture}/bin/lib/harness-settings.js`)
  await copyFile(new URL('./product.js', import.meta.url), `${fixture}/bin/lib/product.js`)
  await copyFile(new URL('./palette.js', import.meta.url), `${fixture}/bin/lib/palette.js`)
  await mkdir(`${fixture}/apps/realness/themes/realness`, { recursive: true })
  await copyFile(new URL('../../apps/realness/themes/realness/palette.css', import.meta.url), `${fixture}/apps/realness/themes/realness/palette.css`)
  for (const plans of ['plans', 'vault/plans']) {
    await mkdir(`${fixture}/${plans}`, { recursive: true })
    await writeFile(`${fixture}/package.json`, JSON.stringify({ type: 'module', brayness: { plans } }))
    await writeFile(`${fixture}/${plans}/p.md`, '# P\n\n```mermaid\nflowchart TD\n a["a test"]\n```\n\n## Nodes\n\n## Notes\n')
    const { stdout } = await promisify(execFile)(process.execPath, [`${fixture}/bin/plan-shape.js`], {
      env: { ...process.env, BRAYNESS_PRODUCT: new URL('../../apps/realness/package.json', import.meta.url).pathname }
    })
    assert.match(stdout, /1 plans, 0 failed/)
  }
})

test('v8: non-plan files in the plans folder are listed, or none', async () => {
  await mkdir(root, { recursive: true })
  assert.deepEqual(plans_ignore(root), [])
  await writeFile(`${root}/package.json`, '{}')
  assert.deepEqual(plans_ignore(root), [])
  await writeFile(`${root}/package.json`, JSON.stringify({ brayness: { plansIgnore: ["Todo's.md"] } }))
  assert.deepEqual(plans_ignore(root), ["Todo's.md"])
  for (const plansIgnore of ['Todo', [''], ['a/b'], ['a\\b'], [42]]) {
    await writeFile(`${root}/package.json`, JSON.stringify({ brayness: { plansIgnore } }))
    assert.throws(() => plans_ignore(root), /brayness.plansIgnore/)
  }
})

test('invalid settings and broken JSON stay visible', async () => {
  for (const plans of ['', '/elsewhere', '../elsewhere', 'vault/../plans', 'vault\\plans', 42]) {
    await writeFile(`${root}/package.json`, JSON.stringify({ brayness: { plans } }))
    assert.throws(() => plans_path(root), /brayness.plans/)
  }
  await writeFile(`${root}/package.json`, '{')
  assert.throws(() => plans_path(root), SyntaxError)
})

test('p1: person.local.html names the person; package.json is only a fallback', async () => {
  const { person, local_person } = await import('./harness-settings.js')
  const dir = `${root}/identity`
  await mkdir(dir, { recursive: true })
  assert.equal(person(dir), null)
  await writeFile(`${dir}/package.json`, JSON.stringify({ brayness: { person: '+14155550123' } }))
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

test('p1: the shared checkout config carries no personal identity', async () => {
  const { readFile } = await import('node:fs/promises')
  const shared = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
  assert.equal(shared.brayness?.person, undefined)
  const ignored = await readFile(new URL('../../.gitignore', import.meta.url), 'utf8')
  assert.match(ignored, /^\/person\.local\.html$/m)
})
