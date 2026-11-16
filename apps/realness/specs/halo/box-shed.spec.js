import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { shed_caches } from '../../src/halo/box.js'

const DAY = 24 * 60 * 60 * 1000

it('shed_caches drops caches and old artifacts, keeps the person', t => {
  const realness = mkdtempSync(join(tmpdir(), 'box-shed-'))
  t.after(() => rmSync(realness, { recursive: true, force: true }))
  const put = (path, text = 'x') => {
    mkdirSync(join(realness, path, '..'), { recursive: true })
    writeFileSync(join(realness, path), text)
  }
  put('.npm/_cacache/blob')
  put('.cache/ms-playwright/x')
  put('artifacts/old/shot.png')
  put('artifacts/new/shot.png')
  put('vault/Areas/garden.md')
  put('.pi/agent/sessions/s.jsonl')
  put('AGENTS.md')
  const now = Date.now()
  const old = new Date(now - 40 * DAY)
  utimesSync(join(realness, 'artifacts', 'old'), old, old)

  shed_caches(realness, now)

  for (const gone of ['.npm', '.cache', 'artifacts/old'])
    assert.equal(existsSync(join(realness, gone)), false, gone)
  for (const kept of [
    'artifacts/new/shot.png',
    'vault/Areas/garden.md',
    '.pi/agent/sessions/s.jsonl',
    'AGENTS.md'
  ])
    assert.ok(existsSync(join(realness, kept)), kept)
})
