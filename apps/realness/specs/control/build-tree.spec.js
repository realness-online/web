/**
 * A build tree borrows the host's /dev, /sys, and /proc. Removing the tree
 * while one is still mounted would delete the host's own files through the
 * mount, so the remove refuses; a mount that will not let go is detached.
 */
import assert from 'node:assert/strict'
import { execFile as exec_file } from 'node:child_process'
import { randomUUID as random_uuid } from 'node:crypto'
import {
  chmod,
  mkdir,
  readFile as read_file,
  rm,
  stat,
  writeFile as write_file
} from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { after, before, it } from 'node:test'
import { out_path } from '#root/lib/output.js'

const run = promisify(exec_file)
const library = new URL('../../lib/build-tree.sh', import.meta.url).pathname
const dir = out_path(`build-tree-${random_uuid()}`)
const bin = join(dir, 'bin')
const tree = join(dir, 'tree')
const calls = join(dir, 'calls')

/**
 * Stand-ins for the mount tools, and for Linux's `rm`: \`mounted\` lists what is still mounted, and
 * \`busy\` is a mount a plain unmount cannot release.
 */
const tools = {
  mountpoint: `grep -qxF "$2" "${dir}/mounted"`,
  umount: `echo "umount $*" >> "${calls}"
if [ "$1" = -l ]; then grep -vxF "$2" "${dir}/mounted" > "${dir}/m"; mv "${dir}/m" "${dir}/mounted"; exit 0; fi
grep -qxF "$1" "${dir}/busy" && exit 32
grep -vxF "$1" "${dir}/mounted" > "${dir}/m"; mv "${dir}/m" "${dir}/mounted"`,
  findmnt: `cat "${dir}/mounted"`,
  rm: `echo "rm $*" >> "${calls}"
exec /bin/rm $(printf '%s\\n' "$@" | grep -vx -- --one-file-system)`
}

before(async () => {
  await mkdir(bin, { recursive: true })
  for (const [name, body] of Object.entries(tools)) {
    await write_file(join(bin, name), `#!/bin/sh\n${body}\n`)
    await chmod(join(bin, name), 0o755)
  }
})

after(() => rm(dir, { recursive: true, force: true }))

/** A tree whose host mounts are \`mounted\`; \`busy\` ones refuse a plain unmount. */
const setup = async ({ mounted, busy = [] }) => {
  await rm(tree, { recursive: true, force: true })
  await mkdir(join(tree, 'dev/pts'), { recursive: true })
  await write_file(join(tree, 'dev/null'), 'the host device\n')
  await write_file(
    join(dir, 'mounted'),
    mounted.map(at => `${tree}/${at}\n`).join('')
  )
  await write_file(
    join(dir, 'busy'),
    busy.map(at => `${tree}/${at}\n`).join('')
  )
  await write_file(calls, '')
}

/** Run \`tree_remove\` with the stand-ins first on the PATH. */
const tree_remove = () =>
  run('bash', ['-c', `. "${library}"; tree_remove`], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TREE: tree }
  })

const exists = path =>
  stat(path).then(
    () => true,
    () => false
  )

it('a mount that will not let go is detached, then the tree goes', async () => {
  await setup({ mounted: ['dev/pts', 'dev', 'sys', 'proc'], busy: ['dev'] })
  await tree_remove()
  const said = await read_file(calls, 'utf8')
  assert.match(said, new RegExp(`umount -l ${tree}/dev\n`))
  assert.match(said, new RegExp(`rm -rf --one-file-system ${tree}\n`))
  assert.equal(await exists(tree), false)
})

it('a mount still inside the tree keeps the tree, and its files', async () => {
  await setup({ mounted: ['dev/shm'] })
  await assert.rejects(tree_remove(), /a mount is still inside/)
  assert.equal(
    await read_file(join(tree, 'dev/null'), 'utf8'),
    'the host device\n'
  )
})
