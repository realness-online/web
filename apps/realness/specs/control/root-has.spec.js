import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const APP = join(import.meta.dirname, '../../src/app')

test('no page-wide :has() rule: each one repainted every poster on any DOM change', () => {
  const found = readdirSync(APP, { recursive: true, encoding: 'utf8' })
    .filter(path => /\.(vue|styl|css)$/.test(path))
    .filter(path =>
      /(:root|\bhtml|\bbody)[^{,]*:has\(/.test(
        readFileSync(join(APP, path), 'utf8')
      )
    )
  assert.deepEqual(found, [])
})
