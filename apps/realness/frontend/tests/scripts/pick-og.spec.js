import { product_paths } from '#root/src/settings/layout.js'
import { spawnSync as spawn_sync } from 'node:child_process'
import {
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { artifacts_dir } from '../../scripts/lib/artifacts.js'
import { pick } from '../../scripts/pick-og.js'

const { frontend } = product_paths()
const script = join(frontend, 'scripts/pick-og.js')
const candidates = join(artifacts_dir, 'og-candidates')
const tag = `spec-${process.pid}`
const made = []

/** Smallest jpeg-shaped buffer with a start-of-frame segment. */
const jpeg = (width, height) => {
  const sof = Buffer.alloc(11)
  sof.writeUInt16BE(0xffc0, 0)
  sof.writeUInt16BE(9, 2)
  sof.writeUInt8(8, 4)
  sof.writeUInt16BE(height, 5)
  sof.writeUInt16BE(width, 7)
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]),
    sof
  ])
}

const candidate = (name, bytes) => {
  mkdir_sync(candidates, { recursive: true })
  const path = join(candidates, name)
  write_file_sync(path, bytes)
  made.push(path)
  return path
}

const run = (...args) =>
  spawn_sync(process.execPath, [script, ...args], { encoding: 'utf8' })

afterEach(() => {
  for (const path of made.splice(0)) rm_sync(path, { force: true })
  vi.restoreAllMocks()
})

describe('pick-og', () => {
  it('copies a correctly sized candidate', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const bytes = jpeg(1200, 630)
    candidate(`${tag}-ok.jpg`, bytes)
    const destination = join(artifacts_dir, `${tag}-og.jpg`)
    made.push(destination)
    pick(`${tag}-ok`, destination)
    expect(read_file_sync(destination)).toEqual(bytes)
  })

  it('needs a file name', () => {
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/usage: npm run og:pick/)
  })

  it('names the candidates when the file is missing', () => {
    candidate(`${tag}-listed.jpg`, jpeg(1200, 630))
    const result = run(`${tag}-absent`)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(`no candidate named ${tag}-absent.jpg`)
    expect(result.stderr).toMatch(`${tag}-listed.jpg`)
  })

  it('refuses an unreadable jpeg', () => {
    candidate(`${tag}-bad.jpg`, Buffer.from('not a jpeg'))
    const result = run(`${tag}-bad.jpg`)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/is not a readable jpeg/)
  })

  it('refuses the wrong dimensions without touching public/og.jpg', () => {
    const og = join(frontend, 'public/og.jpg')
    const before = exists_sync(og) ? read_file_sync(og) : null
    candidate(`${tag}-small.jpg`, jpeg(600, 315))
    const result = run(`${tag}-small`)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/is 600x315, expected 1200x630/)
    expect(exists_sync(og) ? read_file_sync(og) : null).toEqual(before)
  })
})
