import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const project_root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

// A tree of this spec's own, never the real `dist/`. build-manifest deletes
// the junk it finds, so pointing it at a real build makes running the tests
// destroy it - `npm run build` then `npm run test` used to leave dist without
// an index.html.
let dist_dir
let manifest_path

const run_manifest = () =>
  execSync('node scripts/build-manifest.js', {
    cwd: project_root,
    env: { ...process.env, DIST_DIR: dist_dir }
  })

describe('build-manifest', () => {
  beforeEach(() => {
    const artifacts = path.join(project_root, 'artifacts')
    fs.mkdirSync(artifacts, { recursive: true })
    dist_dir = fs.mkdtempSync(path.join(artifacts, 'build-manifest-'))
    manifest_path = path.join(dist_dir, 'build-manifest.json')
    fs.writeFileSync(path.join(dist_dir, 'index.html'), '<html></html>\n')
  })

  afterEach(() => {
    fs.rmSync(dist_dir, { recursive: true, force: true })
  })

  it('writes sha256 entries for dist files', () => {
    run_manifest()
    const manifest = JSON.parse(fs.readFileSync(manifest_path, 'utf8'))
    const expected = `sha256:${createHash('sha256')
      .update('<html></html>\n')
      .digest('hex')}`
    expect(manifest.files['/index.html']).toBe(expected)
    expect(manifest.version).toBeTruthy()
    expect(manifest.bundle_sha256).toMatch(/^sha256:/)
  })

  it('strips and omits OS junk from dist and the manifest', () => {
    const tone_dir = path.join(dist_dir, 'screentones')
    fs.mkdirSync(tone_dir, { recursive: true })
    fs.writeFileSync(path.join(tone_dir, '.DS_Store'), 'finder-junk')
    fs.writeFileSync(path.join(tone_dir, 'ok.txt'), 'keep\n')
    fs.writeFileSync(path.join(dist_dir, 'Thumbs.db'), 'windows-junk')

    run_manifest()
    const manifest = JSON.parse(fs.readFileSync(manifest_path, 'utf8'))

    expect(manifest.files['/screentones/ok.txt']).toBeTruthy()
    expect(manifest.files['/screentones/.DS_Store']).toBeUndefined()
    expect(manifest.files['/Thumbs.db']).toBeUndefined()
    expect(fs.existsSync(path.join(tone_dir, '.DS_Store'))).toBe(false)
    expect(fs.existsSync(path.join(dist_dir, 'Thumbs.db'))).toBe(false)
    expect(fs.existsSync(path.join(tone_dir, 'ok.txt'))).toBe(true)
  })
})
