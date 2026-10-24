import { describe, it, expect } from 'vite-plus/test'
import { scan_src } from '../helpers/scan-src'

const MATERIAL_NAMES =
  '(water|clay|slate|ochre|sediment|sand|gravel|rocks|boulders)'

const MATERIAL_TOKEN_RE = new RegExp(
  `var\\(--${MATERIAL_NAMES}(-(fill|darken|lighten))?\\)` +
    `|\\b(alpha|lighten|darken|saturate|desaturate|tint|shade|mix)\\(\\s*${MATERIAL_NAMES}(-(fill|darken|lighten))?\\b`
)

const DEFINITION_FILES = new Set(['style/palette.css', 'style/color.css'])

const SELF_REFERENTIAL_FILES = new Set(['views/Colors.vue'])

const ALLOWED_BYPASSES = new Set([
  'components/as-fps.vue',
  'components/thoughts/as-textarea.vue',
  'components/posters/as-mask-pen.vue',
  'components/posters/as-figure.vue',
  'components/icon.vue',
  'components/keys-keyboard.vue',
  'components/key-panel.vue'
])

describe('palette: role/material boundary stays deliberate', () => {
  it('every direct material reference outside the palette itself is on the allowlist', () => {
    const files = scan_src(['.vue', '.styl'])
    const bypasses = files
      .filter(
        ({ path, text }) =>
          !DEFINITION_FILES.has(path) &&
          !SELF_REFERENTIAL_FILES.has(path) &&
          MATERIAL_TOKEN_RE.test(text)
      )
      .map(({ path }) => path)
      .sort()

    expect(bypasses).toEqual([...ALLOWED_BYPASSES].sort())
  })
})
