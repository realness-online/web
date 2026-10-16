import { spawnSync as spawn_sync } from 'node:child_process'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { product_paths } from '#root/src/settings/layout.js'
import { artifacts_dir } from '../../scripts/lib/artifacts.js'
import { main } from '../../scripts/check-coverage.js'

const { app, frontend } = product_paths()
const script = join(frontend, 'scripts/check-coverage.js')
const outputs = []

const report_file = report => {
  mkdir_sync(artifacts_dir, { recursive: true })
  const dir = mkdtemp_sync(join(artifacts_dir, 'coverage-'))
  outputs.push(dir)
  const file = join(dir, 'coverage-final.json')
  write_file_sync(file, JSON.stringify(report))
  return file
}

const check = report => {
  mkdir_sync(artifacts_dir, { recursive: true })
  const dir = mkdtemp_sync(join(artifacts_dir, 'coverage-'))
  outputs.push(dir)
  const file = join(dir, 'coverage-final.json')
  write_file_sync(file, JSON.stringify(report))
  return spawn_sync(process.execPath, [script, file], { encoding: 'utf8' })
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const dir of outputs.splice(0))
    rm_sync(dir, { recursive: true, force: true })
})

describe('check-coverage', () => {
  it('counts app files with statements', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    const file = report_file({
      [join(app, 'a.js')]: { s: { 0: 1 } },
      [join(app, 'empty.js')]: { s: {} },
      [join(app, 'none.js')]: {},
      '/elsewhere/b.js': { s: { 0: 1 } }
    })
    expect(main(file)).toBe(1)
    expect(write).toHaveBeenCalledWith('Coverage measured 1 app source files\n')
  })

  it('fails when no app file was measured', () => {
    const file = report_file({ '/elsewhere/b.js': { s: { 0: 1 } } })
    expect(() => main(file)).toThrow(/Coverage must measure app source files/)
  })

  it('exits non-zero as a command', () => {
    const result = check({ '/elsewhere/b.js': { s: { 0: 1 } } })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/Coverage must measure app source files/)
  })
})
