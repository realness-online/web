import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { describe_repos, find_repos } from '#root/src/harness/repos.js'
import { out_path } from '#root/lib/output.js'

const root = out_path(`repos-${randomUUID()}`)
after(() => rm(root, { recursive: true, force: true }))

const repo = async (path, remote) => {
  await mkdir(join(root, path), { recursive: true })
  execFileSync('git', ['init', '-q', '-b', 'main', join(root, path)])
  if (remote)
    execFileSync('git', [
      '-C',
      join(root, path),
      'remote',
      'add',
      'origin',
      remote
    ])
}

it('gz2d: a note beside each repo names its remote and branch', async () => {
  await repo('work/site', 'git@github.com:me/site.git')
  await repo('work/clients/local')
  await mkdir(join(root, 'work/site/inner/.git'), { recursive: true })
  await mkdir(join(root, 'work/node_modules/dep/.git'), { recursive: true })
  assert.deepEqual((await find_repos(root, 'work')).sort(), [
    'work/clients/local',
    'work/site'
  ])
  const written = await describe_repos(root, ['work'])
  assert.deepEqual(written.sort(), ['work/clients/local.md', 'work/site.md'])
  const note = await readFile(join(root, 'work/site.md'), 'utf8')
  assert.match(note, /^---\ngenerated: realness sync\n---\n\n# site\n/)
  assert.match(note, /- Remote: git@github.com:me\/site.git/)
  assert.match(note, /- Branch: main/)
  assert.match(
    await readFile(join(root, 'work/clients/local.md'), 'utf8'),
    /- Remote: local only/
  )
  assert.deepEqual(
    await describe_repos(root, ['work']),
    [],
    'idle when unchanged'
  )
})

it('gz2d: a hand-written note of that name is left alone', async () => {
  await repo('work/mine')
  await writeFile(join(root, 'work/mine.md'), '# my notes\n')
  assert.deepEqual(await describe_repos(root, ['work']), [])
  assert.equal(
    await readFile(join(root, 'work/mine.md'), 'utf8'),
    '# my notes\n'
  )
})
