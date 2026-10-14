import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, rmSync as rm_sync, writeFileSync as write_file_sync } from 'node:fs'
import { once } from 'node:events'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { kind_of, list_sources, poster_paths_for, slices_of } from './lib/sources.js'
import { chrome_path, data_url_of, frame_problem } from './lib/poster-driver.js'
import { resolve_file, serve } from './plans-serve.js'

const root = resolve(import.meta.dirname, '..')

const scratch = t => {
  mkdir_sync(join(root, 'artifacts/poster-tools'), { recursive: true })
  const path = mkdtemp_sync(join(root, 'artifacts/poster-tools/test-'))
  t.after(() => rm_sync(path, { recursive: true, force: true }))
  return path
}

const run = (script, args) =>
  spawn_sync(process.execPath, [join(root, 'bin', script), ...args], { cwd: root, encoding: 'utf8' })

test('sources sort by path, skip dotfiles, and name what each file is', t => {
  const dir = scratch(t)
  mkdir_sync(join(dir, 'b'))
  for (const name of ['b/clip.MOV', 'a.jpg', '.hidden.png', 'notes.txt']) write_file_sync(join(dir, name), 'x')
  assert.deepEqual(
    list_sources(dir).map(({ rel, kind }) => [rel, kind]),
    [['a.jpg', 'image'], ['b/clip.MOV', 'video'], ['notes.txt', 'other']]
  )
  assert.equal(kind_of('photo.webp'), 'image')
  assert.deepEqual(poster_paths_for('/out', 'a/b.jpg'), { svg: '/out/a/b.jpg.svg', record: '/out/a/b.jpg.json' })
})

test('slices split work into near-equal runs and never more slices than items', () => {
  assert.deepEqual(slices_of([1, 2, 3, 4, 5], 2), [[1, 2, 3], [4, 5]])
  assert.deepEqual(slices_of([1], 4), [[1]])
  assert.deepEqual(slices_of([], 3), [[]])
})

test('a frame without a png, an svg, or traced paths is not a poster', () => {
  assert.equal(frame_problem({ svg: '<svg/>' }), 'produced no poster png')
  assert.equal(frame_problem({ png: 'p' }), 'produced no poster svg')
  assert.equal(frame_problem({ png: 'p', svg: '<svg></svg>' }), 'traced no paths')
  assert.equal(frame_problem({ svg: '<svg><path/></svg>' }, { want_png: false }), null)
})

test('data urls carry the right image type', t => {
  const dir = scratch(t)
  write_file_sync(join(dir, 'a.jpg'), 'hi')
  write_file_sync(join(dir, 'b.svg'), 'hi')
  assert.equal(data_url_of(join(dir, 'a.jpg')), 'data:image/jpeg;base64,aGk=')
  assert.equal(data_url_of(join(dir, 'b.svg')), 'data:image/svg+xml;base64,aGk=')
})

test('plans-serve resolves pages and never leaves its root', async t => {
  const dir = scratch(t)
  mkdir_sync(join(dir, 'blog'))
  write_file_sync(join(dir, 'index.html'), '<h1>home</h1>')
  write_file_sync(join(dir, 'blog/post.html'), '<h1>post</h1>')
  assert.equal(await resolve_file(dir, '/'), join(dir, 'index.html'))
  assert.equal(await resolve_file(dir, '/blog/post?x=1'), join(dir, 'blog/post.html'))
  assert.equal(await resolve_file(dir, '/../../etc/passwd'), null)

  const server = serve(dir).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const at = `http://127.0.0.1:${server.address().port}`
  const page = await fetch(`${at}/blog/post`)
  assert.equal(page.headers.get('content-type'), 'text/html; charset=utf-8')
  assert.equal(await page.text(), '<h1>post</h1>')
  assert.equal((await fetch(`${at}/missing`)).status, 404)
})

test('make-posters and make-animation explain bad input before starting a browser', t => {
  const posters = run('make-posters.js', [])
  assert.equal(posters.status, 1)
  assert.match(posters.stderr, /usage: npm run make:posters/)
  assert.match(run('make-posters.js', [join(scratch(t), 'none')]).stderr, /folder not found/)
  assert.match(run('make-animation.js', []).stderr, /usage: npm run make:animation/)
  if (chrome_path) assert.match(run('make-animation.js', ['/no/such/video.mov']).stderr, /video not found/)
})

test('make-posters --dry-run counts files without tracing', { skip: !chrome_path && 'no browser' }, t => {
  const dir = scratch(t)
  write_file_sync(join(dir, 'a.png'), 'x')
  write_file_sync(join(dir, 'b.txt'), 'x')
  const result = run('make-posters.js', [dir, '--dry-run'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /2 files under/)
  assert.match(result.stdout, /"image":\{"files":1/)
})

test('gallery names a missing folder or posters.json before building anything', t => {
  assert.match(run('gallery.js', []).stderr, /usage: npm run gallery/)
  assert.match(run('gallery.js', [join(scratch(t), 'none')]).stderr, /not found/)
  assert.match(run('gallery.js', [scratch(t)]).stderr, /no posters\.json/)
})
