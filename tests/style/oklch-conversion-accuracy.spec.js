import { describe, it, expect } from 'vite-plus/test'
import { oklch_to_hex } from '@/utils/color-converters'
import { read_palette } from '../helpers/palette'

// Pins the exact sRGB appearance every named material renders as right now.
// This is a re-baseline after a deliberate palette revision pass (legacy
// var cleanup, contrast retuning, moss -> slate for --working) — not the
// original pre-oklch-migration snapshot anymore. If this test ever fails,
// either the OKLCH math broke or someone hand-edited a value in
// palette.css and drifted its appearance without meaning to. A deliberate
// palette change should update this map in the same commit, the same way
// a visual snapshot gets re-recorded after an intentional UI change.
const EXPECTED_HEX = {
  graphite: '#525252',
  chalk: '#ecebe4',
  'chalk-transparent': '#ecebe4',
  bone: '#dbdbd4',
  pumice: '#3b3b35',
  basalt: '#2c2c26',
  'basalt-transparent': '#2c2c26',
  moonlight: '#17130f',
  'water-lighten': '#74b9b9',
  'water-fill': '#4e9394',
  'water-darken': '#356e6e',
  'clay-lighten': '#ed8b8b',
  'clay-fill': '#a34145',
  'clay-darken': '#933237',
  'slate-lighten': '#849dc1',
  'slate-fill': '#5373a0',
  'slate-darken': '#3d5c87',
  'ochre-lighten': '#e1be89',
  ochre: '#dfad6d',
  'ochre-darken': '#7e531c',
  'sediment-lighten': '#d6bba8',
  sediment: '#c79a7a',
  'sediment-darken': '#a17557',
  'sand-lighten': '#b59074',
  sand: '#967257',
  'sand-darken': '#654934',
  'gravel-lighten': '#9e7f69',
  gravel: '#7c5f4a',
  'gravel-darken': '#4a3525',
  'rocks-lighten': '#8a7357',
  rocks: '#64523d',
  'rocks-darken': '#332618',
  'boulders-lighten': '#8e5353',
  boulders: '#643a3a',
  'boulders-darken': '#39191a'
}

const palette = read_palette()

describe('palette: oklch literals still resolve to their pre-migration hex', () => {
  it('every named color is defined as oklch() in palette.css', () => {
    for (const name of Object.keys(EXPECTED_HEX))
      expect(palette[name], `missing --${name}`).toBeDefined()
  })

  it.each(Object.entries(EXPECTED_HEX))(
    '%s renders as %s',
    (name, expected_hex) => {
      const { l, c, h } = palette[name]
      expect(oklch_to_hex(l, c, h).toLowerCase()).toBe(expected_hex)
    }
  )
})
