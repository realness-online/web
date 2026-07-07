import { describe, it, expect } from 'vite-plus/test'
import { oklch_to_hex } from '@/utils/color-converters'
import { read_palette } from '../helpers/palette'

// Pins the exact sRGB appearance every named material had right before
// variables.styl moved from hsla() to oklch(). Each expected hex below was
// captured by converting the pre-migration HSL literal straight to hex
// (ground truth, no OKLCH involved) at the moment of conversion. If this
// test ever fails, either the migration script's OKLCH math is wrong or
// someone hand-edited a value in variables.styl and drifted its appearance
// without meaning to — the exact failure mode that hit moss/slate/the
// geology ramp mid-session, caught here instead of by eye.
const EXPECTED_HEX = {
  graphite: '#525252',
  'black-dark': '#050505',
  basalt: '#2c2c26',
  'basalt-transparent': '#2c2c26',
  white: '#e4e4dc',
  'white-text': '#d7d6cb',
  chalk: '#ecebe4',
  'surface-glass-light': '#e4e4dc',
  moonlight: '#181410',
  pumice: '#3b3a32',
  bone: '#dadacf',
  'water-lighten': '#77c5c5',
  'water-fill': '#509595',
  'water-darken': '#1d7272',
  'clay-lighten': '#c87e7e',
  'clay-fill': '#955050',
  'clay-darken': '#833f3f',
  'moss-lighten': '#75bd75',
  'moss-fill': '#4d8f4d',
  'moss-darken': '#326732',
  'slate-lighten': '#87a1c5',
  'slate-fill': '#5a7396',
  'slate-darken': '#445c7e',
  'ochre-lighten': '#f8c36d',
  ochre: '#f4a31f',
  'ochre-darken': '#b97509',
  'sediment-lighten': '#e1c4b0',
  sediment: '#ca9874',
  'sediment-darken': '#ac6e41',
  'sand-lighten': '#c39674',
  sand: '#a16d45',
  'sand-darken': '#68462c',
  'gravel-lighten': '#ad8567',
  gravel: '#7e5d44',
  'gravel-darken': '#493627',
  'rocks-lighten': '#997b56',
  rocks: '#655139',
  'rocks-darken': '#31271c',
  'boulders-lighten': '#965a5a',
  boulders: '#633b3b',
  'boulders-darken': '#301d1d'
}

const palette = read_palette()

describe('palette: oklch literals still resolve to their pre-migration hex', () => {
  it('every named color is defined as oklch() in variables.styl', () => {
    for (const name of Object.keys(EXPECTED_HEX))
      expect(palette[name], `missing --${name}`).toBeDefined()
  })

  it.each(Object.entries(EXPECTED_HEX))('%s renders as %s', (name, expected_hex) => {
    const { l, c, h } = palette[name]
    expect(oklch_to_hex(l, c, h).toLowerCase()).toBe(expected_hex)
  })
})
