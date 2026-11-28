/**
 * z7: the stylesheet at `realness.online/style.css` is the renderer's four
 * sheets as one, in cascade order, and carries the vault page block.
 */
import assert from 'node:assert/strict'
import { readFileSync as read_file_sync } from 'node:fs'
import { join } from 'node:path'
import { it } from 'node:test'
import { VAULT_SHEETS, vault_style } from '#root/src/publish/vault-style.js'
import { project_root } from '#root/src/settings/layout.js'

const folder = join(project_root, 'tools/publish/renderer/static')

it('the vault stylesheet holds the four sheets in cascade order', () => {
  const css = vault_style(folder)
  const at = VAULT_SHEETS.map(name =>
    css.indexOf(read_file_sync(join(folder, name), 'utf8'))
  )
  assert.ok(at.every(index => index >= 0))
  assert.deepEqual(
    [...at].sort((a, b) => a - b),
    at
  )
})

it('a vault page gets the palette, the fonts, and its own frame', () => {
  const css = vault_style(folder)
  assert.match(css, /--chalk:/)
  assert.match(css, /@font-face/)
  assert.match(css, /&:not\(:has\(> header\)\)/)
  assert.match(css, /@media \(prefers-color-scheme: dark\)/)
})
