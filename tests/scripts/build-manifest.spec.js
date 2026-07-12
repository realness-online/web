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
const dist_dir = path.join(project_root, 'dist')
const manifest_path = path.join(dist_dir, 'build-manifest.json')

const cleanup_path = relative => {
  const full = path.join(dist_dir, relative)
  if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true })
}

describe('build-manifest', () => {
  beforeEach(() => {
    fs.mkdirSync(dist_dir, { recursive: true })
    fs.writeFileSync(path.join(dist_dir, 'index.html'), '<html></html>\n')
  })

  afterEach(() => {
    cleanup_path('build-manifest.json')
    cleanup_path('index.html')
    cleanup_path('screentones')
    cleanup_path('Thumbs.db')
  })

  it('writes sha256 entries for dist files', () => {
    execSync('node scripts/build-manifest.js', { cwd: project_root })
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

    execSync('node scripts/build-manifest.js', { cwd: project_root })
    const manifest = JSON.parse(fs.readFileSync(manifest_path, 'utf8'))

    expect(manifest.files['/screentones/ok.txt']).toBeTruthy()
    expect(manifest.files['/screentones/.DS_Store']).toBeUndefined()
    expect(manifest.files['/Thumbs.db']).toBeUndefined()
    expect(fs.existsSync(path.join(tone_dir, '.DS_Store'))).toBe(false)
    expect(fs.existsSync(path.join(dist_dir, 'Thumbs.db'))).toBe(false)
    expect(fs.existsSync(path.join(tone_dir, 'ok.txt'))).toBe(true)
  })
})
