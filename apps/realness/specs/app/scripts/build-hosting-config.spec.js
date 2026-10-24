import { product_paths } from '#root/src/settings/layout.js'
import { spawnSync as spawn_sync } from 'node:child_process'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync
} from 'node:fs'
import { isAbsolute as is_absolute, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { artifacts_dir } from '../../../scripts/lib/artifacts.js'
import { main } from '../../../scripts/build-hosting-config.js'

const { frontend } = product_paths()
const script = join(frontend, 'scripts/build-hosting-config.js')
const source = join(frontend, '.firebaserc')
const outputs = []

const build = (...args) => {
  mkdir_sync(artifacts_dir, { recursive: true })
  const root = mkdtemp_sync(join(artifacts_dir, 'hosting-'))
  outputs.push(root)
  main([...args, root])
  return {
    root,
    config: JSON.parse(
      read_file_sync(join(root, 'frontend', 'firebase.json'), 'utf8')
    ),
    rc: read_file_sync(join(root, 'frontend', '.firebaserc'), 'utf8')
  }
}

const services = config =>
  config.hosting
    .flatMap(hosting => hosting.rewrites ?? [])
    .filter(rewrite => rewrite.run)
    .map(rewrite => rewrite.run.serviceId)

afterEach(() => {
  for (const root of outputs.splice(0))
    rm_sync(root, { recursive: true, force: true })
})

describe('build-hosting-config', () => {
  it('writes absolute paths and copies .firebaserc', () => {
    const { config, rc } = build()
    for (const hosting of config.hosting)
      expect(is_absolute(hosting.public)).toBe(true)
    expect(is_absolute(config.storage.rules)).toBe(true)
    expect(rc).toBe(read_file_sync(source, 'utf8'))
  })

  it('keeps development service routes', () => {
    const { config } = build('--env', 'development')
    expect(services(config)).toEqual(
      expect.arrayContaining(['realness-sync', 'realness-proxy'])
    )
  })

  it('runs as a command', () => {
    mkdir_sync(artifacts_dir, { recursive: true })
    const root = mkdtemp_sync(join(artifacts_dir, 'hosting-'))
    outputs.push(root)
    const result = spawn_sync(process.execPath, [script, root], {
      encoding: 'utf8'
    })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })

  it('drops routes to services production lacks', () => {
    const { config } = build('--env', 'production')
    expect(services(config)).toEqual([])
    expect(config.hosting.some(hosting => hosting.rewrites?.length)).toBe(true)
  })
})
