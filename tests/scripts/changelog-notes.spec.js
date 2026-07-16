import { describe, it, expect } from 'vite-plus/test'
import { extract_changelog_section } from '../../scripts/changelog-notes.js'

const sample = `# Changelog

## 2026-07-13 → 07-15 — v2.5.11

- **one** — first
- **two** — second

## 2026-07-12 → 07-13 — v2.5.10

- older item
`

describe('extract_changelog_section', () => {
  it('returns the body for a bare version', () => {
    expect(extract_changelog_section(sample, '2.5.11')).toBe(
      '- **one** — first\n- **two** — second\n'
    )
  })

  it('accepts a v-prefixed version', () => {
    expect(extract_changelog_section(sample, 'v2.5.10')).toBe('- older item\n')
  })

  it('throws when the version heading is missing', () => {
    expect(() => extract_changelog_section(sample, '9.9.9')).toThrow(
      /No CHANGELOG.md section for v9\.9\.9/
    )
  })
})
