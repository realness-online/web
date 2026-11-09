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

for (const name of ['template-build.sh', 'chrome-image-build.sh'])
  it(`${name} removes its working tree once the image is built`, () =>
    removes_after(read(name), 'mv "$IMG.new" "$IMG"', 'rm -rf "$TREE"'))

it('app-image-build.sh keeps a base tree and removes a built one', () => {
  const script = read('app-image-build.sh')
  removes_after(script, 'mv "$IMG.new" "$IMG"', 'rm -rf "$TREE"')
  assert.ok(
    script.indexOf('rm -rf "$TREE"', script.indexOf('mv "$IMG.new"')) <
      script.indexOf('\nfi\n', script.indexOf('mv "$IMG.new"'))
  )
})

it('guest-setup.sh removes the unpacked squashfs after the rootfs', () =>
  removes_after(
    read('guest-setup.sh'),
    'mv rootfs.ext4.new rootfs.ext4',
    'rm -rf squashfs-root ubuntu-24.04.squashfs'
  ))
