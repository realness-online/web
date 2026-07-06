import { describe, it, expect } from 'vite-plus/test'
import { scan_src } from '../helpers/scan-src'

// Item 4 from the color critique: components are supposed to touch roles
// (--accent, --emphasis, --info, ...), not materials (--water, --clay,
// --sediment, ...) directly — color.styl documents `.water`/`.graphite`
// as "the blessed exception," but nothing stopped a second, third, or
// fifth exception from quietly showing up elsewhere.
//
// This doesn't forbid the pattern — sometimes a control really should
// read as a material. It just makes every instance of it show up here,
// so adding one is a deliberate, reviewable decision instead of a habit
// that spreads unnoticed.

const MATERIAL_TOKEN_RE =
  /var\(--(water|clay|moss|slate|heather|sulfur|ochre|sediment|sand|gravel|rocks|boulders)(-(fill|light|dark))?\)/

// Files that define or wire the palette itself, not "components touching
// materials" — excluded rather than allowlisted.
const DEFINITION_FILES = new Set(['style/variables.styl', 'style/color.styl'])

// views/Colors.vue is the palette browser: referencing every material by
// name is the entire point of the page, not a bypass.
const SELF_REFERENTIAL_FILES = new Set(['views/Colors.vue'])

// Every other file that reaches past a role into a material directly.
// Adding to this list should mean "I looked at this and it's deliberate,"
// not "the test was in my way."
const ALLOWED_BYPASSES = new Set([
  'style/keyframes.styl', // press-hold tap-highlight, scoped to .water elements
  'components/profile/as-form-mobile.vue', // country <select> option hover
  'components/as-fps.vue', // dev-only fps overlay, borrows geology colors
  'components/thoughts/as-textarea.vue' // compose caret, borrows geology colors
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
