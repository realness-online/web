import assert from 'node:assert/strict'
import { it } from 'node:test'
import { skipped } from '#root/src/files/skip.js'

it('dependencies, builds, auth, secrets, and git never sync', () => {
  for (const path of [
    'app/node_modules/x/index.js',
    'app/dist/a.js',
    '.npm/_cacache/CACHEDIR.TAG',
    'apps/realness/tracer/target/release/deps/x.rlib',
    '.git/HEAD',
    'work/app/.env',
    '.env.local',
    'keys/server.pem',
    '.ssh/id_ed25519',
    '.pi/agent/auth.json',
    'a/.npmrc',
    '.bash_history',
    'work/app/.zsh_history',
    '.node_repl_history'
  ])
    assert.ok(skipped(path), path)
})

it('a bare repository, named like work/realness.git, never syncs', () => {
  assert.ok(skipped('work/realness.git/HEAD'))
  assert.ok(skipped('work/realness.git/objects/ab/cdef'))
  assert.ok(!skipped('work/realness.git.md'))
  assert.ok(!skipped('vault/notes/git.md'))
})

it('artifacts never sync, at the root or inside a project', () => {
  assert.ok(skipped('artifacts/starter-harness/package.json'))
  assert.ok(skipped('work/project/artifacts/result.svg'))
  assert.ok(!skipped('notes/artifacts.md'))
})

it('local vault metadata never syncs at any depth', () => {
  for (const folder of ['.obsidian', '.smart-env']) {
    assert.ok(skipped(`${folder}/config.json`))
    assert.ok(skipped(`vault/nested/${folder}/index.bin`))
    assert.ok(!skipped(`vault/${folder}.md`))
  }
})

it('session locks, writer markers, repair files, and backups never sync', () => {
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

it('ordinary files sync', () => {
  for (const path of [
    'vault/note.md',
    'plans/realness.md',
    'posters/1.html.gz',
    'src/environment.js',
    'keyboard.md'
  ])
    assert.ok(!skipped(path), path)
})

it('lc1: a secrets folder never syncs', () => {
  assert.ok(skipped('.pi/agent/secrets/halo-pass-secret'))
  assert.ok(skipped('vault/secrets/note.md'))
})
