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

describe('build-manifest', () => {
  beforeEach(() => {
    fs.mkdirSync(dist_dir, { recursive: true })
    fs.writeFileSync(path.join(dist_dir, 'index.html'), '<html></html>\n')
  })

  afterEach(() => {
    if (fs.existsSync(manifest_path)) fs.unlinkSync(manifest_path)
    if (fs.existsSync(path.join(dist_dir, 'index.html')))
      fs.unlinkSync(path.join(dist_dir, 'index.html'))
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
})
