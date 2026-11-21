import assert from 'node:assert/strict'
import { readFileSync as read_file_sync } from 'node:fs'
import { it } from 'node:test'

const read = name =>
  read_file_sync(
    new URL(`../../tools/control/scripts/${name}`, import.meta.url),
    'utf8'
  )

/** @param {string} script @param {string} built @param {string} removed */
const removes_after = (script, built, removed) => {
  const at = script.lastIndexOf(built)
  assert.ok(at >= 0, `missing ${built}`)
  assert.ok(script.indexOf(removed, at) > at, `${removed} after ${built}`)
}

for (const name of ['template-build.sh'])
  it(`${name} removes its working tree once the image is built`, () =>
    removes_after(read(name), 'mv "$IMG.new" "$IMG"', 'tree_remove'))

it('app-image-build.sh keeps a base tree and removes a built one', () => {
  const script = read('app-image-build.sh')
  removes_after(script, 'mv "$IMG.new" "$IMG"', 'tree_remove')
  assert.ok(
    script.indexOf('tree_remove', script.indexOf('mv "$IMG.new"')) <
      script.indexOf('\nfi\n', script.indexOf('mv "$IMG.new"'))
  )
})

it('guest-setup.sh removes the unpacked squashfs after the rootfs', () =>
  removes_after(
    read('guest-setup.sh'),
    'mv rootfs.ext4.new rootfs.ext4',
    'rm -rf squashfs-root ubuntu-24.04.squashfs'
  ))

it('template-build.sh removes its tree and a half-built image on any exit', () => {
  const script = read('template-build.sh')
  const finish = script.slice(script.indexOf('finish() {'))
  assert.match(script, /trap finish EXIT/)
  assert.ok(finish.indexOf('tree_remove') < finish.indexOf('rm -f "$IMG.new"'))
})

it('template-build.sh frees old scratch, then stops when space is low', () => {
  const script = read('template-build.sh')
  const sweep = script.indexOf('tree_remove\n')
  const check = script.indexOf('[ "$free_gib" -ge "$MIN_FREE_GIB" ]')
  assert.ok(sweep >= 0)
  assert.ok(sweep < check)
  assert.ok(check < script.indexOf('tar xzf'))
})
