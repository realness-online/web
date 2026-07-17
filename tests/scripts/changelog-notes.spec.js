import { describe, it, expect } from 'vite-plus/test'
import {
  extract_changelog_section,
  promote_unreleased,
  strip_unreleased,
  read_unreleased
} from '../../scripts/lib/changelog.js'

const sample = `# Changelog

## Unreleased

- **pending** — not shipped

## v2.5.11 — 2026-07-15

- **one** — first
- **two** — second

## v2.5.10 — 2026-07-13

- older item
`

describe('changelog lib', () => {
  it('extracts body for a bare version', () => {
    expect(extract_changelog_section(sample, '2.5.11')).toBe(
      '- **one** — first\n- **two** — second\n'
    )
  })

  it('includes the heading when asked', () => {
    expect(
      extract_changelog_section(sample, 'v2.5.10', { include_heading: true })
    ).toBe('## v2.5.10 — 2026-07-13\n\n- older item\n')
  })

  it('throws when the version heading is missing', () => {
    expect(() => extract_changelog_section(sample, '9.9.9')).toThrow(
      /No CHANGELOG.md section for v9\.9\.9/
    )
  })

  it('strips Unreleased for public docs', () => {
    const stripped = strip_unreleased(sample)
    expect(stripped).not.toContain('Unreleased')
    expect(stripped).not.toContain('pending')
    expect(stripped).toContain('v2.5.11')
  })

  it('reads Unreleased body', () => {
    expect(read_unreleased(sample).body).toBe('- **pending** — not shipped')
  })

  it('promotes Unreleased into a dated version heading', () => {
    const next = promote_unreleased(
      sample,
      '2.5.12',
      new Date('2026-07-16T12:00:00Z')
    )
    expect(next).toContain('## Unreleased\n\n## v2.5.12 — 2026-07-16')
    expect(next).toContain('- **pending** — not shipped')
    expect(next).toContain('## v2.5.11 — 2026-07-15')
    expect(next.indexOf('pending')).toBeGreaterThan(
      next.indexOf('## v2.5.12 — 2026-07-16')
    )
    expect(read_unreleased(next).body.trim()).toBe('')
  })

  it('refuses to promote an empty Unreleased', () => {
    const empty = `# Changelog\n\n## Unreleased\n\n## v2.5.11 — 2026-07-16\n\n- done\n`
    expect(() => promote_unreleased(empty, '2.5.12')).toThrow(/empty/)
  })
})
