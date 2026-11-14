import assert from 'node:assert/strict'
import { once } from 'node:events'
import { existsSync as exists_sync } from 'node:fs'
import { readdir, readFile as read_file } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { it } from 'node:test'
import { serve } from '../../plans/plans-serve.js'

const root = resolve(import.meta.dirname, '../../../..')
const dist = join(root, 'artifacts/apps/plans/dist')
const blog = join(root, 'artifacts/apps/blog/dist')

/** Site files every vault server answers, beside the pages. */
const EXTRAS = ['/manifest.webmanifest', '/sitemap.xml', '/robots.txt', '/icons.svg', '/192.png', '/512.png']

/** @param {string} file a built page @returns {string} the route that serves it */
export const route_of = file => {
  const path = `/${relative(dist, file).split(sep).join('/')}`
  return path.endsWith('/index.html') ? path.slice(0, -'index.html'.length) : path.replace(/\.html$/, '')
}

/** @param {string} html @returns {string[]} the scripts and microdata a page carries */
export const features_of = html =>
  [
    ...new Set([
      ...[...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(match => `script ${match[1]}`),
      ...[...html.matchAll(/itemprop="([^"]+)"/g)].map(match => `itemprop ${match[1]}`)
    ])
  ].sort()

const pages = async () =>
  (await readdir(dist, { recursive: true }))
    .filter(file => file.endsWith('.html') && !file.split(sep).includes('partials'))
    .map(file => join(dist, file))

const target = async t => {
  if (process.env.VAULT_URL) return process.env.VAULT_URL
  const server = serve(dist, blog).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  return `http://127.0.0.1:${server.address().port}`
}

it('the vault server answers every built page with its scripts and microdata', async t => {
  if (!exists_sync(dist)) return t.skip('no plans build; run npm run plans')
  const at = await target(t)
  const files = await pages()
  assert.ok(files.length > 50, `only ${files.length} pages built`)
  for (const file of files) {
    const route = route_of(file)
    const response = await fetch(at + route)
    assert.equal(response.status, 200, route)
    const served = features_of(await response.text())
    const missing = features_of(await read_file(file, 'utf8')).filter(feature => !served.includes(feature))
    assert.deepEqual(missing, [], route)
  }
  for (const extra of EXTRAS) assert.equal((await fetch(at + extra)).status, 200, extra)
})
