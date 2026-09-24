import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const dist = new URL('../dist/', import.meta.url)

// Read only build output: source paths can work in Vite and fail when published.
test('built assets resolve inside each published mount', async () => {
  const html = await readFile(new URL('index.html', dist), 'utf8')
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1])
  assert.ok(assets.some(path => path.endsWith('.js')), 'missing script')
  assert.ok(assets.some(path => path.endsWith('.css')), 'missing stylesheet')

  for (const mount of ['/s/first/', '/s/second/']) {
    const base = new URL(mount, 'https://example.test')
    for (const asset of assets) {
      const url = new URL(asset, base)
      assert.equal(url.origin, base.origin)
      assert.ok(url.pathname.startsWith(mount), `${asset} escapes ${mount}`)
      const file = new URL(url.pathname.slice(mount.length), dist)
      assert.ok((await readFile(file)).length, `${asset} is empty`)
    }
  }
})
