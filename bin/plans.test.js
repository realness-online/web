import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

import { size_diagrams } from '../apps/realness/tools/publish/renderer/static/scripts/plan-diagrams.js'

const css = readFileSync(new URL('../apps/realness/tools/publish/renderer/static/plans.css', import.meta.url), 'utf8')
const covers = readFileSync(new URL('../apps/realness/tools/publish/renderer/static/scripts/plan-covers.js', import.meta.url), 'utf8')

test('plan diagrams keep their native size instead of shrinking to the viewport', () => {
  const section = css.slice(css.indexOf('section {\n  pre.mermaid {'))
  const svg = section.match(/& svg \{([^}]+)\}/)[1]
  assert.match(svg, /width: auto/)
  assert.match(svg, /max-height: none/)
  assert.match(css, /section \{\s*> article > figure > pre\.mermaid \{\s*max-height: 24rem;/)
})

test('fitted diagrams shrink to fit without enlarging small plans', () => {
  const fitted = css.match(/&\[aria-pressed="false"\] svg \{([^}]+)\}/)[1]
  assert.match(fitted, /width: auto/)
  assert.match(fitted, /max-width: 100% !important/)
})

test('diagrams load fitted; click and keyboard expand, then restore scroll position', () => {
  const attributes = new Map()
  const handlers = new Map()
  const svg = {
    viewBox: { baseVal: { width: 5000, height: 3000 } },
    setAttribute: () => {},
    querySelector: () => ({ getBoundingClientRect: () => ({ left: 2500, width: 400 }) })
  }
  const diagram = {
    closest: () => true,
    querySelector: () => svg,
    setAttribute: (name, value) => attributes.set(name, value),
    getAttribute: name => attributes.get(name),
    addEventListener: (name, handler) => handlers.set(name, handler),
    getBoundingClientRect: () => ({ left: 0 }),
    clientWidth: 1200,
    scrollLeft: 0,
    scrollTop: 0
  }
  size_diagrams([diagram])
  assert.equal(attributes.get('role'), 'button')
  assert.equal(attributes.get('tabindex'), '0')
  assert.equal(attributes.get('aria-pressed'), 'false')
  handlers.get('click')()
  assert.equal(attributes.get('aria-pressed'), 'true')
  assert.equal(diagram.scrollLeft, 2100)
  assert.equal(diagram.scrollTop, 0)
  diagram.scrollLeft = 900
  diagram.scrollTop = 600
  handlers.get('click')()
  assert.equal(attributes.get('aria-pressed'), 'false')
  assert.equal(diagram.scrollLeft, 0)
  assert.equal(diagram.scrollTop, 0)
  let prevented = false
  handlers.get('keydown')({ key: 'Enter', preventDefault: () => { prevented = true } })
  assert.ok(prevented)
  assert.equal(attributes.get('aria-pressed'), 'true')
  assert.equal(diagram.scrollLeft, 900)
  assert.equal(diagram.scrollTop, 600)
  handlers.get('keydown')({ key: ' ', preventDefault: () => {} })
  assert.equal(attributes.get('aria-pressed'), 'false')
  handlers.get('keydown')({ key: 'ArrowRight' })
  assert.equal(attributes.get('aria-pressed'), 'false')
})

function plan(slug, copies) {
  const diagrams = [1, 2].map(id => ({ cloneNode: deep => ({ slug, id, deep }) }))
  const figure = { querySelector: () => null, prepend: (...nodes) => copies.push(...nodes) }
  const parts = {
    'figure a[href^="/blog/"]': { getAttribute: () => `/blog/${slug}` },
    ':scope > figure': figure,
    ':scope > template': { content: { querySelectorAll: () => diagrams } }
  }
  return { slug, querySelector: selector => parts[selector] }
}

test('plan list copies every DAG onto its cover', () => {
  const order = []
  const copies = []
  const parentElement = { append: article => order.push(article.slug) }
  const articles = ['old', 'recent'].map(slug => Object.assign(plan(slug, copies), { parentElement }))
  const document = {
    documentElement: { dataset: { diagrams: 'pending' } },
    querySelectorAll: selector => selector === 'section > article:has(> template)' ? articles : []
  }
  runInNewContext(covers, { document })
  assert.deepEqual(order, [])
  assert.equal(copies.length, 4)
  assert.ok(copies.every(node => node.deep))
  assert.equal(document.documentElement.dataset.diagrams, 'ready')
})

test('the plans app follows the plans folder and keeps chosen slugs', async () => {
  const { mkdir, mkdtemp, rename, rm, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const { select_plans } = await import('./plans.js')
  const { read_app } = await import('../apps/realness/src/publish/sources.js')
  const scratch = new URL('../artifacts/brayness/plans-test/', import.meta.url).pathname
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'root-'))
  try {
    await mkdir(join(root, 'vault/Projects'), { recursive: true })
    await mkdir(join(root, 'vault/Areas'), { recursive: true })
    await mkdir(join(root, 'apps/plans'), { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({ brayness: { person: '+15550001111', plans: 'vault/Projects', plansIgnore: ['Todo.md'] } }))
    await writeFile(join(root, 'apps/plans/app.json'), JSON.stringify({ id: 'a-0123456789ab', type: 'plans', vault: '../../vault', sources: [] }))
    for (const name of ['one.md', 'two.md', 'Todo.md']) await writeFile(join(root, 'vault/Projects', name), `# ${name}\n`)
    const first = await select_plans(root)
    assert.deepEqual(first.map(source => source.slug), ['one', 'two'])
    const app = await read_app(join(root, 'apps/plans'))
    await writeFile(join(root, 'apps/plans/app.json'), JSON.stringify({ ...app, sources: app.sources.map(source => source.slug === 'one' ? { ...source, slug: 'renamed' } : source) }))
    await rename(join(root, 'vault/Projects/two.md'), join(root, 'vault/Areas/two.md'))
    await writeFile(join(root, 'vault/Projects/three.md'), '# three\n')
    const second = await select_plans(root)
    assert.deepEqual(second.map(source => source.slug), ['renamed', 'three'])
    assert.equal(second[0].id, first[0].id)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('h5: a plan keeps its chosen slug and itemid with no catalog file', async () => {
  const { mkdir, mkdtemp, rm, stat, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const { select_plans } = await import('./plans.js')
  const scratch = new URL('../artifacts/brayness/plans-test/', import.meta.url).pathname
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'vault-catalog-'))
  try {
    await mkdir(join(root, 'vault/Projects'), { recursive: true })
    await mkdir(join(root, 'apps/plans'), { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({ brayness: { person: '+15550001111', plans: 'vault/Projects' } }))
    const itemid = '/+15550001111/plans/1791571682897'
    await writeFile(join(root, 'vault/Projects/one.md'), `---\nitemid: "${itemid}"\n---\n# one\n`)
    await writeFile(join(root, 'apps/plans/app.json'), JSON.stringify({ id: 'a-0123456789ab', type: 'plans', vault: '../../vault', sources: [{ id: itemid, slug: 'chosen' }] }))
    assert.deepEqual(await select_plans(root), [{ id: itemid, slug: 'chosen' }])
    await assert.rejects(stat(join(root, 'vault/catalog.json')), { code: 'ENOENT' })
  } finally { await rm(root, { recursive: true, force: true }) }
})
