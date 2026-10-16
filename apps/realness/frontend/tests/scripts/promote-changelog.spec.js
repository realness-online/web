import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { main } from '../../scripts/promote-changelog.js'

afterEach(() => vi.restoreAllMocks())

describe('promote-changelog main', () => {
  it('writes the promoted changelog and reports the version', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    let written
    main({
      version: () => 'v1.2.3',
      read: () => '# Changelog\n\n## Unreleased\n\n- thing\n',
      write: text => (written = text)
    })
    expect(written).toMatch(/## v?1\.2\.3/)
    expect(written).not.toMatch(/## Unreleased\n\n- thing/)
    expect(info).toHaveBeenCalledWith(
      expect.stringMatching(/→ v1\.2\.3 in .*CHANGELOG\.md$/)
    )
  })
})
