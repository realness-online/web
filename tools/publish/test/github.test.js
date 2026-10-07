import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { test } from 'node:test'
import { github_remote, publish_github } from '../src/github.js'

const run = promisify(execFile)
const scratch = new URL('../../../../../artifacts/brayness/apps-github-test/', import.meta.url).pathname
const git = async (cwd, ...args) => (await run('git', ['-C', cwd, ...args])).stdout.trim()

test('owner/repo means GitHub over SSH; other remotes pass through', () => {
  assert.equal(github_remote('scott-fryxell/scott-fryxell.github.io'), 'git@github.com:scott-fryxell/scott-fryxell.github.io.git')
  assert.equal(github_remote('/tmp/x.git'), '/tmp/x.git')
})

test('a publish replaces the tree on top of history, keeps CNAME, and a dry run never pushes', async () => {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'pages-'))
  try {
    const remote = join(root, 'remote.git')
    await run('git', ['init', '--quiet', '--bare', remote])
    const dist = join(root, 'dist')
    const work = join(root, 'work')
    const options = { dist, work, repository: remote, message: 'Publish blog' }
    await mkdir(join(dist, 'blog/one'), { recursive: true })
    await writeFile(join(dist, 'index.html'), 'one\n')
    await writeFile(join(dist, 'blog/one/index.html'), 'post\n')

    assert.equal((await publish_github(options)).summary, 'first publish')
    const shown = async (file) => git(root, '--git-dir', remote, 'show', `gh-pages:${file}`)
    assert.equal(await shown('blog/one/index.html'), 'post')
    assert.equal(await shown('.nojekyll'), '')

    // A custom domain set on the branch outlives a republish.
    const other = join(root, 'other')
    await run('git', ['clone', '--quiet', '--branch', 'gh-pages', remote, other])
    await writeFile(join(other, 'CNAME'), 'example.com\n')
    await git(other, 'add', 'CNAME')
    await git(other, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '-m', 'domain')
    await git(other, 'push', '--quiet', 'origin', 'gh-pages')

    await rm(join(dist, 'blog/one'), { recursive: true })
    await writeFile(join(dist, 'index.html'), 'two\n')
    const second = await publish_github(options)
    assert.equal(second.pushed, true)
    assert.equal(await shown('index.html'), 'two')
    assert.equal(await shown('CNAME'), 'example.com')
    await assert.rejects(shown('blog/one/index.html'))
    assert.equal((await git(root, '--git-dir', remote, 'log', '--format=%s', 'gh-pages')).split('\n').length, 3)

    assert.equal((await publish_github(options)).changed, false)

    await writeFile(join(dist, 'index.html'), 'three\n')
    const dry = await publish_github({ ...options, push: false })
    assert.deepEqual([dry.changed, dry.pushed], [true, false])
    assert.equal(await shown('index.html'), 'two')
  } finally { await rm(root, { recursive: true, force: true }) }
})
