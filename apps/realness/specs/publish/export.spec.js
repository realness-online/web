import assert from 'node:assert/strict'
import {
  access,
  mkdir,
  mkdtemp,
  readFile as read_file,
  rm,
  symlink
} from 'node:fs/promises'
import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { it } from 'node:test'
import { export_static, renderer_path } from '../../src/publish/view.js'
import { run } from '#root/src/command/command.js'

const execute = promisify(exec_file)
const artifacts = new URL(
  '../../../../artifacts/realness/static-export/',
  import.meta.url
).pathname
const project = new URL('../../', import.meta.url).pathname

it('the public command exports a starter that builds without product source imports', async t => {
  await mkdir(artifacts, { recursive: true })
  const root = await mkdtemp(join(artifacts, 'run-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const destination = join(root, 'site')
  const result = await run(['example', 'static', destination], {
    get_token: () => {
      throw Error('export must stay offline')
    },
    export_static,
    stdout: { write: () => {} }
  })
  assert.equal(result, 0)
  await access(join(destination, 'src/build.js'))
  await assert.rejects(access(join(destination, 'dist')), { code: 'ENOENT' })
  await assert.rejects(access(join(destination, '.cache')), { code: 'ENOENT' })
  assert.equal(
    await read_file(join(destination, 'src/build.js'), 'utf8'),
    await read_file(join(renderer_path, 'src/build.js'), 'utf8')
  )
  assert.doesNotMatch(
    await read_file(join(destination, 'build.js'), 'utf8'),
    /#root\/|tools\/publish/
  )
  await symlink(
    join(project, 'node_modules'),
    join(destination, 'node_modules')
  )
  await execute(process.execPath, ['build.js'], { cwd: destination })
  await access(join(destination, 'dist/index.html'))
  await assert.rejects(export_static(destination), /destination exists/)
  const cli_destination = join(root, 'cli-site')
  const reply = await execute(process.execPath, [
    join(project, 'tools/cli/bin/realness.js'),
    'example',
    'static',
    cli_destination
  ])
  assert.equal(reply.stdout.trim(), cli_destination)
  assert.equal(
    await read_file(join(cli_destination, 'src/build.js'), 'utf8'),
    await read_file(join(destination, 'src/build.js'), 'utf8')
  )
})
