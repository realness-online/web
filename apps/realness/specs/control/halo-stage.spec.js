import assert from 'node:assert/strict'
import {
  execFileSync as exec_file_sync,
  spawnSync as spawn_sync
} from 'node:child_process'
import {
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  rmSync as rm_sync
} from 'node:fs'
import { join } from 'node:path'
import { it } from 'node:test'
import { project_root } from '#root/src/settings/layout.js'
import { out_path } from '#root/src/settings/output.js'

it('a locally staged halo loads its real entry and can stage an actor without installed packages', t => {
  const artifacts = out_path('halo-stage-tests')
  mkdir_sync(artifacts, { recursive: true })
  const scratch = mkdtemp_sync(join(artifacts, 'halo with spaces-'))
  t.after(() => rm_sync(scratch, { recursive: true, force: true }))
  exec_file_sync('bash', ['tools/control/scripts/stage-halo.sh', scratch], {
    cwd: project_root
  })
  assert.equal(exists_sync(join(scratch, 'node_modules')), false)
  const result = spawn_sync(
    process.execPath,
    ['server/halo/main.js', '--invalid-stage-check'],
    { cwd: scratch, encoding: 'utf8' }
  )
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /ERR_PARSE_ARGS_UNKNOWN_OPTION/)
  assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND/)
  const runtime = join(scratch, 'actor runtime')
  exec_file_sync('bash', ['tools/control/scripts/stage-runtime.sh', runtime], {
    cwd: scratch
  })
  const help = exec_file_sync(
    process.execPath,
    ['tools/cli/bin/realness.js', '--help'],
    {
      cwd: runtime,
      encoding: 'utf8',
      env: { ...process.env, REALNESS_ACTOR: '1', PROFILE: 'actor' }
    }
  )
  assert.match(help, /files sync/)
})
