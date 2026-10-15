import assert from 'node:assert/strict'
import { test } from 'node:test'
import { skipped } from '#root/src/files/skip.js'

test('dependencies, builds, auth, secrets, and git never sync', () => {
  for (const path of [
    'app/node_modules/x/index.js',
    'app/dist/a.js',
    '.git/HEAD',
    'work/app/.env',
    '.env.local',
    'keys/server.pem',
    '.ssh/id_ed25519',
    '.pi/agent/auth.json',
    'a/.npmrc'
  ])
    assert.ok(skipped(path), path)
})

test('artifacts never sync, at the root or inside a project', () => {
  assert.ok(skipped('artifacts/starter-harness/package.json'))
  assert.ok(skipped('work/project/artifacts/result.svg'))
  assert.ok(!skipped('notes/artifacts.md'))
})

test('local vault metadata never syncs at any depth', () => {
  for (const folder of ['.obsidian', '.smart-env']) {
    assert.ok(skipped(`${folder}/config.json`))
    assert.ok(skipped(`vault/nested/${folder}/index.bin`))
    assert.ok(!skipped(`vault/${folder}.md`))
  }
})

test('session locks, writer markers, repair files, and backups never sync', () => {
  for (const suffix of [
    '.lock',
    '.writer-123',
    '.tail-abc',
    '.before-rewrite-abc',
    '.before-compaction-abc',
    '.writing-abc',
    '.compacting-abc'
  ]) {
    assert.ok(
      skipped(`.pi/agent/sessions/project/session.html.gz${suffix}`),
      suffix
    )
  }
  assert.ok(!skipped('.pi/agent/sessions/project/session.html.gz'))
  assert.ok(!skipped('notes/session.writer-123.md'))
})

test('ordinary files sync', () => {
  for (const path of [
    'vault/note.md',
    'plans/realness.md',
    'posters/1.html.gz',
    'src/environment.js',
    'keyboard.md'
  ])
    assert.ok(!skipped(path), path)
})
