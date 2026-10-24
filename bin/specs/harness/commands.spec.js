import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile as read_file, access, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { collect_commands } from '../../harness/commands/catalog.js'
import { update_commands } from '../../harness/commands.js'
import { cli_families } from '../../harness/commands/cli.js'
import { parse_html } from '../../lib/harness-dependencies.js'
import { setImmediate as next_turn } from 'node:timers/promises'
import { wire_page } from '../../harness/commands/page.js'

const root = resolve(import.meta.dirname, '../../..')
const catalog = await update_commands(root)

const load_page = async () => {
  const html = await read_file(join(root, 'artifacts/commands/index.html'), 'utf8')
  const { document, window } = parse_html(html)
  let copied = null
  globalThis.document = document
  globalThis.window = window
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        async writeText(text) {
          copied = text
        }
      }
    }
  })
  globalThis.setTimeout = () => {}
  wire_page(document)
  return {
    document,
    copied: () => copied,
    click(button) { button.dispatchEvent(new window.Event('click', { bubbles: true })) },
    search(text) {
      const input = document.querySelector('input[type="search"]')
      input.value = text
      input.dispatchEvent(new window.Event('input'))
    },
  }
}

it('every package script has exactly one full copy command and a source', async () => {
  for (const source of catalog.packages) {
    const { scripts = {} } = JSON.parse(await read_file(join(root, source), 'utf8'))
    for (const name of Object.keys(scripts)) {
      const matches = catalog.entries.filter(entry => entry.id === `${source}#scripts.${name}`)
      assert.equal(matches.length, 1, `${source}: ${name}`)
      assert.equal(matches[0].definition, scripts[name])
      if (source !== 'package.json') assert.match(matches[0].command, /--prefix/)
    }
  }
  assert.deepEqual(catalog.packages, [
    'package.json',
    'apps/realness/functions/package.json',
    'apps/realness/package.json',
    'apps/realness/packages/itemid/package.json',
    'apps/realness/packages/store/package.json',
    'apps/realness/packages/thoughts/package.json',
    '.pi/examples/static/package.json',
  ])
  assert.equal(new Set(catalog.entries.map(entry => entry.id)).size, catalog.entries.length)
})

it('audit recommendations are visible on command cards', async () => {
  const { document } = await load_page()
  for (const entry of catalog.entries) {
    const button = [...document.querySelectorAll('button[value]')].find(button => button.getAttribute('value') === entry.command)
    assert.ok(button, entry.id)
    const card = button.closest('li')
    assert.equal(card.querySelector('strong').textContent, entry.review)
    assert.ok(card.textContent.includes(entry.review_reason))
  }
  assert.ok(!catalog.entries.some(entry => entry.review_reason.startsWith('Missing script target')), 'no false missing-target findings')
  for (const id of ['apps/realness/package.json#scripts.certs', 'apps/realness/package.json#scripts.test:risk:report', 'apps/realness/package.json#scripts.test:coverage:summary']) {
    assert.equal(catalog.entries.find(entry => entry.id === id).review, 'Keep', id)
  }
  for (const id of ['apps/realness/package.json#scripts.build:frontend', 'apps/realness/package.json#scripts.deploy:frontend:dev']) {
    assert.ok(!catalog.entries.some(entry => entry.id === id), `${id} is folded into the CLI`)
  }
  assert.ok(!catalog.entries.some(entry => entry.id === 'bin/harness/commands/catalog.js'), 'imported modules are not listed')
  assert.ok(!catalog.entries.some(entry => entry.id.includes('/renderer/static/')), 'browser scripts are not listed')
  const generator = catalog.entries.find(entry => entry.id === 'bin/harness/commands.js')
  assert.equal(generator.review, 'Keep')
  assert.match(generator.review_reason, /package.json/)
  for (const entry of catalog.entries) assert.ok(['Keep', 'Remove', 'Unknown'].includes(entry.review), entry.id)
})

it('watch is a first-class monitor command; local follows the current manifest', async () => {
  const watch = catalog.entries.find(entry => entry.display === 'realness watch')
  assert.ok(watch)
  assert.equal(watch.group, 'Monitor')
  assert.equal(watch.command, 'node apps/realness/tools/cli/bin/realness.js watch')
  const { scripts } = JSON.parse(await read_file(join(root, 'package.json'), 'utf8'))
  assert.equal(catalog.entries.some(entry => entry.command === 'npm run local'), Boolean(scripts.local))
})

it('CLI entries and package binaries all resolve to source files', async () => {
  for (const family of cli_families) {
    await access(join(root, family.entry))
    await access(join(root, family.source))
  }
  for (const bin of catalog.bins) await access(join(root, bin.entry))
})

it('all direct desktop Realness dispatch commands have reviewed routes', async () => {
  const text = await read_file(join(root, 'apps/realness/src/command/command.js'), 'utf8')
  const routes = cli_families.find(family => family.name === 'Realness').routes.map(([route]) => route.split(' ')[0])
  const direct = [...text.matchAll(/args\[0\] === '([^']+)'/g)].map(match => match[1])
  const lists = [...text.matchAll(/\[([^\]\n]+)\]\.includes\(args\[0\]\)/g)].flatMap(match => [...match[1].matchAll(/'([^']+)'/g)].map(word => word[1]))
  for (const command of [...direct, ...lists]) assert.ok(routes.includes(command), `Missing CLI route: ${command}`)
  assert.ok(routes.includes('files'))
})

it('every authored shell file is either a helper or a sourced library', async () => {
  const scan = async directory => {
    const files = []
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist', 'target', 'vendor', '.vite-hooks', 'test', 'tests', 'specs', 'references', 'fixtures', 'capture'].includes(entry.name)) continue
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) files.push(...await scan(path))
      else if (entry.isFile() && entry.name.endsWith('.sh')) files.push(path)
    }
    return files
  }
  const shells = (await Promise.all(['bin', 'apps', '.pi/skills'].map(scan))).flat()
  for (const path of shells) assert.ok(catalog.candidates.includes(path) || catalog.shell_libraries.includes(path), `Missing shell file: ${path}`)
  assert.ok(catalog.shell_libraries.includes('apps/realness/lib/output.sh'))
  assert.ok(catalog.candidates.includes('apps/realness/tools/control/scripts/dev-stack.sh'))
})

it('generated page preserves identity, escapes placeholders, and copies full paths', async () => {
  const html = await read_file(join(root, 'artifacts/commands/index.html'), 'utf8')
  assert.match(html, /itemid="\/\+\d{7,15}\/pages\/1791752490821"/)
  assert.match(html, /value="node apps\/realness\/tools\/cli\/bin\/realness.js watch"/)
  assert.match(html, /&lt;environment&gt;/)
  assert.match(html, /Run from the Realness root\./)
  assert.ok(!html.includes('{{'))
  assert.equal((html.match(/aria-label="Copy /g) ?? []).length, catalog.entries.length)
  assert.match(html, /id="command-filters"/)
  assert.match(html, /value="all" aria-pressed="true"/)
  assert.match(html, /value="Monitor" aria-pressed="false"/)
  assert.match(html, /value="Internal helpers" aria-pressed="false"/)
})

it('review filters combine with task and search filters', async () => {
  const page = await load_page()
  const visible_rows = () => [...page.document.querySelectorAll('#command-list li')].filter(row => !row.hidden)
  for (const review of ['Keep', 'Remove', 'Unknown']) {
    page.click(page.document.querySelector(`#review-filters button[value="${review}"]`))
    assert.equal(visible_rows().length, catalog.entries.filter(entry => entry.review === review).length, review)
    assert.ok(visible_rows().every(row => row.querySelector('strong').textContent === review), review)
  }
  assert.equal(page.copied(), null)
  page.click(page.document.querySelector('#review-filters button[value="all"]'))
  page.search('fold')
  assert.ok(visible_rows().length >= 1)
  page.click(page.document.querySelector('#command-filters button[value="Tools"]'))
  assert.ok(visible_rows().length >= 1)
  assert.ok(visible_rows().every(row => row.closest('section').querySelector('h2').textContent === 'Tools'))
  page.search('no-such-command-xyz')
  assert.equal(visible_rows().length, 0)
  assert.equal(page.document.querySelector('output').textContent, 'No commands found')
})

it('task buttons filter rows and expose exactly one selected task', async () => {
  const page = await load_page()
  page.click(page.document.querySelector('#command-filters button[value="Monitor"]'))
  const visible = [...page.document.querySelectorAll('#command-list section')].filter(section => !section.hidden)
  assert.deepEqual(visible.map(section => section.querySelector('h2').textContent), ['Monitor'])
  assert.equal(page.document.querySelectorAll('#command-filters [aria-pressed="true"]').length, 1)
  assert.equal(page.copied(), null)
  page.click(page.document.querySelector('#command-filters button[value="all"]'))
  assert.ok([...page.document.querySelectorAll('#command-list section')].every(section => !section.hidden))
})

it('search narrows the selected task and internal helpers remain reachable', async () => {
  const page = await load_page()
  page.click(page.document.querySelector('#command-filters button[value="Monitor"]'))
  page.search('watch')
  assert.equal(page.document.querySelector('output').textContent, '1 command')
  page.search('dev-stack')
  assert.equal(page.document.querySelector('output').textContent, 'No commands found')
  page.click(page.document.querySelector('#command-filters button[value="Internal helpers"]'))
  assert.equal(page.document.querySelector('output').textContent, '1 command')
})

it('copy still uses the full command after filtering; filter buttons never copy', async () => {
  const page = await load_page()
  page.click(page.document.querySelector('#command-filters button[value="Monitor"]'))
  page.search('watch')
  const row = [...page.document.querySelectorAll('#command-list li')].find(row => !row.hidden)
  const button = row.querySelector('button')
  page.click(button)
  await next_turn()
  assert.equal(page.copied(), 'node apps/realness/tools/cli/bin/realness.js watch')
  assert.equal(button.textContent, 'Copied')
  page.click(page.document.querySelector('#command-filters button[value="Build"]'))
  assert.equal(page.copied(), 'node apps/realness/tools/cli/bin/realness.js watch')
})
