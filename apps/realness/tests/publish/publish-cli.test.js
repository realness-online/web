/**
 * The apps command as a user runs it. Nothing here is exported, and the
 * dispatch happens at import time from `process.argv`, so each case runs the
 * real script in a child process and reads its streams and exit code.
 *
 * The root is a throwaway harness: an empty `vault` and an `apps` folder, so
 * `items list` and `app add` have somewhere real to work.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import {
  existsSync as exists_sync,
  mkdirSync,
  readFileSync as read_file_sync
} from 'node:fs'
import { mkdtempSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { out_path } from '#root/lib/output.js'

const SCRIPT = resolve(
  import.meta.dirname,
  '../../tools/publish/bin/publish.js'
)

const make_root = () => {
  mkdirSync(out_path(), { recursive: true })
  const root = mkdtempSync(out_path('publish-cli-'))
  mkdirSync(join(root, 'vault'), { recursive: true })
  mkdirSync(join(root, 'apps'), { recursive: true })
  return root
}

const publish = (root, args) => {
  const result = spawn_sync(process.execPath, [SCRIPT, ...args], {
    cwd: root,
    env: { ...process.env, BRAYNESS_ROOT: root },
    encoding: 'utf8'
  })
  return { code: result.status, out: result.stdout, err: result.stderr }
}

test('a bare run says how to use it and exits 1', () => {
  const root = make_root()
  try {
    const { code, err } = publish(root, [])
    assert.equal(code, 1)
    assert.match(
      err,
      /brayness-publish: usage: brayness-publish items <action> \| app <action>/
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('an unknown action names the ones that exist', () => {
  const root = make_root()
  try {
    assert.match(
      publish(root, ['items', 'nope']).err,
      /items list\|mint\|settle/
    )
    assert.match(
      publish(root, ['app', 'nope']).err,
      /app add\|build\|list\|publish\|unpublish/
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('an option without a value is refused, but --drafts needs none', () => {
  const root = make_root()
  try {
    assert.match(
      publish(root, ['app', 'add', 'blog', '--type']).err,
      /--type needs a value/
    )
    const drafted = publish(root, [
      'app',
      'add',
      'blog',
      '--type',
      'blog',
      '--drafts'
    ])
    assert.equal(drafted.code, 0)
    assert.doesNotMatch(drafted.err, /needs a value/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('app add writes app.json and site.json, and app list reports them', () => {
  const root = make_root()
  try {
    const added = publish(root, ['app', 'add', 'blog', '--type', 'blog'])
    assert.equal(added.code, 0)
    assert.match(added.out, new RegExp(`blog: .*apps/blog/app\\.json`))

    const app = JSON.parse(
      read_file_sync(join(root, 'apps/blog/app.json'), 'utf8')
    )
    assert.equal(app.type, 'blog')
    assert.match(app.id, /^a-[0-9a-f]{12}$/)
    // Relative to the app folder, which is how app_sources resolves it. A base
    // one level up writes '../vault' and app list then fails with ENOENT.
    assert.equal(app.vault, '../../vault')
    assert.deepEqual(app.sources, [])
    assert.deepEqual(app.assets, [])

    const site = JSON.parse(
      read_file_sync(join(root, 'apps/blog/site.json'), 'utf8')
    )
    assert.deepEqual(site, {
      name: 'blog',
      tagline: '',
      url: '',
      description: '',
      poster: 'example.svg'
    })

    const listed = publish(root, ['app', 'list'])
    assert.equal(listed.code, 0)
    assert.match(listed.out, /^blog\s+blog\s+\S+\s+0 source\(s\)$/m)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('app add refuses a bad name, a bad type, and a second add', () => {
  const root = make_root()
  try {
    assert.match(
      publish(root, ['app', 'add', 'Not A Name', '--type', 'blog']).err,
      /app add <name> --type blog\|plans/
    )
    assert.match(
      publish(root, ['app', 'add', 'blog', '--type', 'wiki']).err,
      /app add <name> --type blog\|plans/
    )

    assert.equal(
      publish(root, ['app', 'add', 'blog', '--type', 'blog']).code,
      0
    )
    assert.match(
      publish(root, ['app', 'add', 'blog', '--type', 'blog']).err,
      /app already exists: blog/
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a source must be an id and slug pair that names a real item', () => {
  const root = make_root()
  try {
    assert.match(
      publish(root, [
        'app',
        'add',
        'blog',
        '--type',
        'blog',
        '--source',
        'noseparator'
      ]).err,
      /--source wants <id>=<slug>: noseparator/
    )
    assert.match(
      publish(root, [
        'app',
        'add',
        'blog',
        '--type',
        'blog',
        '--source',
        '/+1/x=home'
      ]).err,
      /unknown item: \/\+1\/x/
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('app list over no apps prints nothing and succeeds', () => {
  const root = make_root()
  try {
    rmSync(join(root, 'apps'), { recursive: true, force: true })
    const listed = publish(root, ['app', 'list'])
    assert.equal(listed.code, 0)
    assert.equal(listed.out, '')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('items list over an empty vault prints nothing and succeeds', () => {
  const root = make_root()
  try {
    const listed = publish(root, ['items', 'list'])
    assert.equal(listed.code, 0)
    assert.equal(listed.out, '')
    assert.equal(exists_sync(join(root, 'vault')), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
