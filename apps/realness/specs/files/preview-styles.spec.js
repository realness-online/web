/**
 * A synced HTML file opens styled from disk.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  mkdir,
  readFile as read_file,
  rm,
  writeFile as write_file
} from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID as random_uuid } from 'node:crypto'
import {
  PREVIEW_STYLES,
  is_vault_html,
  style_local,
  with_preview_styles,
  without_top_block
} from '#root/src/files/preview-styles.js'
import { out_path } from '#root/lib/output.js'

const ITEM = '<article itemscope itemtype="/grants/grant"></article>\n'
const SESSION = '<article itemscope itemtype="/sessions/session"></article>\n'

it('links the palette, colour roles, and site styles, in that order', () => {
  const styled = with_preview_styles(ITEM)
  assert.deepEqual(
    [...styled.matchAll(/href="([^"]+)"/g)].map(([, href]) => href),
    PREVIEW_STYLES
  )
  assert.ok(styled.endsWith(ITEM))
})

it('adds only what is missing, and leaves a styled file unchanged', () => {
  const styled = with_preview_styles(ITEM)
  assert.equal(with_preview_styles(styled), styled)
  const partial = `<link rel="stylesheet" href="${PREVIEW_STYLES[2]}">\n${ITEM}`
  const filled = with_preview_styles(partial)
  assert.equal(filled.match(/style\.css/g)?.length, 1)
  assert.match(filled, /palette\.css/)
})

it('puts the links inside the head of a whole page, after its charset', () => {
  const page =
    '<!doctype html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <title>x</title>\n  </head>\n</html>\n'
  const styled = with_preview_styles(page)
  assert.ok(styled.startsWith('<!doctype html>'))
  assert.ok(styled.indexOf('palette.css') > styled.indexOf('charset'))
  assert.ok(styled.indexOf('style.css') < styled.indexOf('<title>'))
  assert.equal(with_preview_styles(styled), styled)
})

it('moves a block an earlier sync put above the doctype into the head', () => {
  const block = PREVIEW_STYLES.map(
    href => `<link rel="stylesheet" href="${href}">`
  ).join('\n')
  const page = `${block}\n<!doctype html>\n<html><head><meta charset="utf-8" /></head></html>\n`
  const styled = with_preview_styles(page)
  assert.ok(styled.startsWith('<!doctype html>'))
  assert.equal(styled.match(/style\.css/g)?.length, 1)
  assert.equal(
    without_top_block(page),
    '<!doctype html>\n<html><head><meta charset="utf-8" /></head></html>\n'
  )
})

it('keeps the doctype first in a page with no head, as the scout pages are', () => {
  const block = PREVIEW_STYLES.map(
    href => `<link rel="stylesheet" href="${href}">`
  ).join('\n')
  const page = `${block}\n<!doctype html>\n<title>SMS scout</title>\n<article itemscope></article>\n`
  const styled = with_preview_styles(page)
  assert.ok(styled.startsWith('<!doctype html>\n<link'))
  assert.equal(styled.match(/style\.css/g)?.length, 1)
  assert.equal(with_preview_styles(styled), styled)
})

it("styles vault HTML and a synced folder's own HTML, never project code", () => {
  assert.equal(is_vault_html('vault/Projects/seeq-leads/scout.html'), true)
  assert.equal(is_vault_html('members.html'), true)
  assert.equal(
    is_vault_html('work/realness-flex/screentones/zipatone-30.svg.html'),
    false
  )
  assert.equal(is_vault_html('apps/realness/index.html'), false)
  assert.equal(is_vault_html('vault/Projects/a.md'), false)
})

it('styles a plain HTML file on disk once, and leaves other files alone', async () => {
  const dir = out_path(`preview-styles-${random_uuid()}/`)
  await mkdir(dir, { recursive: true })
  try {
    const html = join(dir, 'rights.html')
    const code = join(dir, 'index.html')
    await write_file(code, ITEM)
    assert.equal(
      await style_local('work/mpc-moded/scripts/index.html', code),
      false
    )
    const note = join(dir, 'note.md')
    await write_file(html, ITEM)
    await write_file(note, '# Note\n')
    assert.equal(await style_local('rights.html', html), true)
    assert.equal(await style_local('rights.html', html), false)
    assert.match(await read_file(html, 'utf8'), /realness\.online\/style\.css/)
    assert.equal(await style_local('note.md', note), false)
    assert.equal(await read_file(note, 'utf8'), '# Note\n')
    assert.equal(await style_local('Sessions/x.html.gz', html), false)
    const packed = join(dir, 'packed.html.gz')
    await write_file(packed, ITEM)
    assert.equal(await style_local('packed.html', packed), false)
    const session = join(dir, 'session.html')
    await write_file(session, SESSION)
    assert.equal(await style_local('session.html', session), false)
    assert.equal(await read_file(session, 'utf8'), SESSION)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
