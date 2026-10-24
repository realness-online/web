import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { it } from 'node:test'

const manifest = JSON.parse(
  read_file_sync(new URL('../../package.json', import.meta.url), 'utf8')
)
const checks = ['check:backend', 'type:backend', 'fallow', 'test:coverage:node']
const stages = [
  ...checks,
  'check:frontend',
  'check:functions',
  'type',
  'test:coverage',
  'test:functions'
]
const scratch = new URL(
  '../../../../artifacts/realness/quality-command/',
  import.meta.url
)

const exercise = failed => {
  mkdir_sync(scratch, { recursive: true })
  const root = mkdtemp_sync(join(scratch.pathname, 'case-'))
  try {
    const scripts = {
      test: manifest.scripts.test,
      'check:quality': manifest.scripts['check:quality']
    }
    for (const stage of stages) scripts[stage] = `node task.js ${stage}`
    write_file_sync(join(root, 'package.json'), JSON.stringify({ scripts }))
    write_file_sync(
      join(root, 'task.js'),
      "const fs = require('node:fs'); const stage = process.argv[2]; fs.appendFileSync('calls.jsonl', JSON.stringify(stage) + '\\n'); process.exitCode = stage === process.env.FAILED_CHECK ? 17 : 0\n"
    )
    const result = spawn_sync('npm', ['test'], {
      cwd: root,
      env: { ...process.env, FAILED_CHECK: failed ?? '' },
      encoding: 'utf8',
      timeout: 30000
    })
    assert.equal(result.error, undefined)
    return {
      status: result.status,
      output: result.stdout + result.stderr,
      calls: read_file_sync(join(root, 'calls.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map(JSON.parse)
    }
  } finally {
    rm_sync(root, { recursive: true, force: true })
  }
}

it('product npm test runs quality once before the frontend and Functions suites', () => {
  assert.equal(typeof manifest.scripts['check:quality'], 'string')
  assert.match(
    manifest.scripts['check:quality'],
    /fallow -- dead-code --fail-on-regression/
  )
  const result = exercise()
  assert.equal(result.status, 0, result.output)
  assert.deepEqual(result.calls, stages)
})

for (const failed of stages) {
  it(`product npm test stops when ${failed} fails`, () => {
    assert.equal(typeof manifest.scripts['check:quality'], 'string')
    const result = exercise(failed)
    assert.notEqual(result.status, 0, result.output)
    assert.deepEqual(result.calls, stages.slice(0, stages.indexOf(failed) + 1))
  })
}
