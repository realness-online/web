import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { artifacts_dir } from '../../scripts/lib/artifacts.js'

vi.mock('../../scripts/lib/changelog.js', async original => ({
  ...(await original()),
  read_changelog: () =>
    '# Changelog\n\n## v2.0.0 - 2026-01-01\n\n- shipped\n\n## v1.0.0\n\n- old\n',
  package_version: () => '2.0.0'
}))

const { main } = await import('../../scripts/changelog-notes.js')

let dir
beforeEach(() => {
  mkdirSync(artifacts_dir, { recursive: true })
  dir = mkdtempSync(path.join(artifacts_dir, 'notes-'))
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('changelog-notes main', () => {
  it('writes the package version section with a footer', () => {
    const out = path.join(dir, 'nested', 'notes.md')
    const { notes } = main(['--out', out])
    expect(readFileSync(out, 'utf8')).toBe(notes)
    expect(notes).toMatch(/^## v2\.0\.0 - 2026-01-01\n\n- shipped/)
    expect(notes).not.toMatch(/- old/)
  })

  it('writes a chosen version', () => {
    const out = path.join(dir, 'notes.md')
    expect(main(['--version', '1.0.0', '--out', out]).notes).toMatch(/- old/)
  })

  it('prints usage for --help', () => {
    expect(main(['--help'])).toEqual({ help: true })
    expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/Usage/))
  })
})
