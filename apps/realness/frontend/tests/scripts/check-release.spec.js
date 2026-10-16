import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { artifacts_dir } from '../../scripts/lib/artifacts.js'

const changelog = vi.hoisted(() => ({ text: '', version: '2.0.0' }))
vi.mock('../../scripts/lib/changelog.js', async original => ({
  ...(await original()),
  read_changelog: () => changelog.text,
  package_version: () => changelog.version
}))

const { main } = await import('../../scripts/check-release.js')

const shipped = `# Changelog

## Unreleased

- pending

## v2.0.0 - 2026-01-01

- shipped
`

let dist
let previous
beforeEach(() => {
  mkdirSync(artifacts_dir, { recursive: true })
  dist = mkdtempSync(path.join(artifacts_dir, 'check-release-'))
  previous = process.env.DIST_DIR
  process.env.DIST_DIR = dist
  changelog.text = shipped
  changelog.version = '2.0.0'
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  if (previous === undefined) delete process.env.DIST_DIR
  else process.env.DIST_DIR = previous
  rmSync(dist, { recursive: true, force: true })
  vi.restoreAllMocks()
})

const manifest = version =>
  writeFileSync(
    path.join(dist, 'build-manifest.json'),
    JSON.stringify({ version })
  )

describe('check-release', () => {
  it('allows versioning when Unreleased has notes', () => {
    main(['--unreleased'])
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/Unreleased has notes/)
    )
  })

  it('refuses versioning when Unreleased is empty', () => {
    changelog.text = '# Changelog\n\n## Unreleased\n\n## v2.0.0\n\n- shipped\n'
    expect(() => main(['--unreleased'])).toThrow(/Unreleased is empty/)
  })

  it('passes when the manifest matches the package version', () => {
    manifest('v2.0.0')
    main([])
    expect(console.info).toHaveBeenCalledWith(
      'check-release ok (v2.0.0, manifesto matches)'
    )
  })

  it('fails without a built manifest', () => {
    expect(() => main([])).toThrow(/Missing .*build-manifest\.json/)
  })

  it('fails when the manifest is from another version', () => {
    manifest('1.9.0')
    expect(() => main([])).toThrow(
      /version is 1\.9\.0, package\.json is 2\.0\.0/
    )
  })

  it('fails when the manifest has no version', () => {
    manifest(undefined)
    expect(() => main([])).toThrow(/version is undefined/)
  })

  it('fails when the changelog lacks the version', () => {
    changelog.version = '3.0.0'
    expect(() => main([])).toThrow()
  })
})
