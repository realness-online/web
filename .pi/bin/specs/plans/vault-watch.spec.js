import assert from 'node:assert/strict'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { it } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { failure_line, ignored, watch_builds } from '../../plans/plans-serve.js'

const root = resolve(import.meta.dirname, '../../../..')

const folder = t => {
  mkdir_sync(join(root, 'artifacts/vault-serve'), { recursive: true })
  const dir = mkdtemp_sync(join(root, 'artifacts/vault-serve/watch-'))
  t.after(() => rm_sync(dir, { recursive: true, force: true }))
  return dir
}

it('a burst of edits starts one build, and edits during a build start exactly one more', async t => {
  const dir = folder(t)
  const lines = []
  const handed = []
  let builds = 0
  let running = 0
  let most = 0
  const watcher = watch_builds({
    folder: dir,
    wait: 50,
    log: line => lines.push(line),
    build: async changed => {
      builds++
      handed.push(changed.sort())
      most = Math.max(most, ++running)
      await sleep(150)
      running--
    }
  })
  t.after(watcher.close)
  await sleep(300)
  builds = 0
  lines.length = 0
  for (const n of [1, 2, 3]) write_file_sync(join(dir, `plan-${n}.md`), `${n}`)
  await sleep(120)
  assert.equal(builds, 1)
  for (const n of [4, 5]) write_file_sync(join(dir, `plan-${n}.md`), `${n}`)
  await sleep(500)
  assert.equal(builds, 2)
  assert.equal(most, 1)
  assert.equal(lines.length, 2)
  assert.deepEqual(handed.slice(-2), [
    ['plan-1.md', 'plan-2.md', 'plan-3.md'],
    ['plan-4.md', 'plan-5.md']
  ])
})

it('hidden files, session transcripts, and the commands page never start a build', async t => {
  const dir = folder(t)
  mkdir_sync(join(dir, '.obsidian'))
  mkdir_sync(join(dir, 'Sessions'))
  mkdir_sync(join(dir, 'Areas/Realness/pages'), { recursive: true })
  let builds = 0
  const watcher = watch_builds({ folder: dir, wait: 50, ignore: ignored, log: () => {}, build: async () => builds++ })
  t.after(watcher.close)
  await sleep(300)
  builds = 0
  write_file_sync(join(dir, '.obsidian/workspace.json'), '{}')
  write_file_sync(join(dir, 'Areas/Realness/pages/commands.html'), '<p>')
  write_file_sync(join(dir, 'Areas/Realness/pages/commands.js'), '')
  write_file_sync(join(dir, 'Sessions/a.html.gz'), '')
  write_file_sync(join(dir, 'Sessions/a.html.gz.lock'), '')
  await sleep(200)
  assert.equal(builds, 0)
})

it('a failed build reports one line', () => {
  const error = Object.assign(new Error('Command failed: node plans.js\nnoise'), {
    stderr: "node:fs:2787\n   at x\nError: ENOENT: no such file or directory, lstat '/x'\n    at y\n"
  })
  assert.equal(failure_line(error), "Error: ENOENT: no such file or directory, lstat '/x'")
})
