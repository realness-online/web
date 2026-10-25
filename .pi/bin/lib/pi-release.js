import assert from 'node:assert/strict'
import { createHash as create_hash } from 'node:crypto'
import {
  existsSync as exists_sync,
  readdirSync as readdir_sync,
  readFileSync as read_file_sync,
  readlinkSync as readlink_sync,
  lstatSync as lstat_sync
} from 'node:fs'
import { dirname, isAbsolute as is_absolute, join, relative, resolve } from 'node:path'

/** Verify the approved fork archives before npm can install them. */
export const verify_release = runtime => {
  const release = JSON.parse(read_file_sync(join(runtime, 'release.json'), 'utf8'))
  for (const field of ['source_commit', 'upstream_commit']) assert.match(release[field], /^[a-f0-9]{40}$/)
  assert.match(release.version, /^\d+\.\d+\.\d+$/)
  assert.match(release.upstream_tag, /^v\d+\.\d+\.\d+$/)
  const manifest = JSON.parse(read_file_sync(join(runtime, 'package.json'), 'utf8'))
  const paths = Object.keys(release.archives)
  assert.ok(paths.length > 0, 'Fork release has no archives')
  for (const path of paths) {
    assert.match(path, /^tarballs\/[a-zA-Z0-9._-]+\.tgz$/)
    assert.match(release.archives[path], /^[a-f0-9]{64}$/)
    const hash = create_hash('sha256')
      .update(read_file_sync(join(runtime, path)))
      .digest('hex')
    assert.equal(hash, release.archives[path], `Fork archive changed: ${path}`)
  }
  const dependencies = Object.values({ ...manifest.overrides, ...manifest.dependencies })
  const references = [
    ...new Set(
      dependencies.map(value => {
        assert.match(value, /^file:\.\/tarballs\/[a-zA-Z0-9._-]+\.tgz$/)
        return value.slice('file:./'.length)
      })
    )
  ].sort()
  assert.deepEqual(references, paths.sort(), 'Fork package references differ from approved archives')
  return release
}

/**
 * Installed commands link inside their own runtime. A copy made without
 * verbatim links points back at its source, and breaks when that is removed.
 */
export const verify_install = runtime => {
  const bin = join(runtime, 'node_modules/.bin')
  const names = exists_sync(bin) ? readdir_sync(bin) : []
  for (const name of names) {
    const link = join(bin, name)
    if (!lstat_sync(link).isSymbolicLink()) continue
    const target = readlink_sync(link)
    assert.ok(!is_absolute(target), `Installed command is an absolute link: ${name} -> ${target}`)
    const reached = relative(resolve(runtime), resolve(dirname(link), target))
    assert.ok(
      reached && !reached.startsWith('..') && !is_absolute(reached),
      `Installed command leaves the runtime: ${name} -> ${target}`
    )
    assert.ok(exists_sync(link), `Installed command is dangling: ${name} -> ${target}`)
  }
  return names.length
}
