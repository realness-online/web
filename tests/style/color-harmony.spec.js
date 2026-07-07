import { describe, it, expect } from 'vite-plus/test'
import { oklch_to_hex, contrast_ratio } from '@/utils/color-converters'
import { read_palette } from '../helpers/palette'

// Guards the perceptual-harmony fixes made to the palette this round —
// not a general design-token linter, just the specific failure modes we
// hit by hand: signal colors reading as twins, and geology-ramp steps
// collapsing into each other when lightness alone doesn't separate them.

const palette = read_palette()

const oklch_of = name => palette[name]

const hex_of = name => {
  const { l, c, h } = palette[name]
  return oklch_to_hex(l, c, h)
}

describe('palette: text/surface contrast (WCAG AA, 4.5:1)', () => {
  const AA_NORMAL_TEXT = 4.5

  it.each([
    ['graphite', 'chalk'], // light-mode body text on the light surface
    ['white-text', 'basalt'], // dark-mode body text on the dark surface
    ['clay-darken', 'chalk'], // emphasis role, light mode
    ['clay-lighten', 'basalt'], // emphasis text, dark mode
    ['water-darken', 'chalk'], // accent role, light mode
    ['water-lighten', 'basalt'], // accent (link) text, dark mode
    ['moss-darken', 'chalk'], // working role, light mode
    ['moss-lighten', 'basalt'], // working role, dark mode
    ['slate-darken', 'chalk'] // slate foreground on light (if used as text)
  ])('%s on %s clears %s:1', (fg, bg) => {
    expect(contrast_ratio(hex_of(fg), hex_of(bg))).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT
    )
  })
})

const circular_hue_distance = (a, b) => {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

describe('palette: accent/emphasis/working roles stay hue-distinct', () => {
  const MIN_ROLE_HUE_SEPARATION = 40

  it.each([
    ['light', 'water-darken', 'clay-darken', 'moss-darken'],
    ['dark', 'water-lighten', 'clay-lighten', 'moss-lighten']
  ])(
    '%s scheme: accent/emphasis/working stay hue-distinct',
    (_, accent, emphasis, working) => {
      const hues = {
        accent: oklch_of(accent).h,
        emphasis: oklch_of(emphasis).h,
        working: oklch_of(working).h
      }
      expect(
        circular_hue_distance(hues.accent, hues.emphasis)
      ).toBeGreaterThanOrEqual(MIN_ROLE_HUE_SEPARATION)
      expect(
        circular_hue_distance(hues.accent, hues.working)
      ).toBeGreaterThanOrEqual(MIN_ROLE_HUE_SEPARATION)
      expect(
        circular_hue_distance(hues.emphasis, hues.working)
      ).toBeGreaterThanOrEqual(MIN_ROLE_HUE_SEPARATION)
    }
  )
})

describe('palette: geology ramp stays a real depth ramp', () => {
  const LAYERS = ['sediment', 'sand', 'gravel', 'rocks', 'boulders']
  const MIN_LIGHTNESS_STEP = 0.04
  const TIGHT_STEP_THRESHOLD = 0.065
  const MIN_HUE_SEPARATION_WHEN_TIGHT = 8

  it('gets monotonically darker from sediment to boulders', () => {
    const lightnesses = LAYERS.map(name => oklch_of(name).l)
    for (let i = 0; i < lightnesses.length - 1; i++)
      expect(lightnesses[i] - lightnesses[i + 1]).toBeGreaterThanOrEqual(
        MIN_LIGHTNESS_STEP
      )
  })

  it('separates adjacent layers by hue when the lightness step is tight', () => {
    // Two adjacent layers can share a lightness step that's small (a subtle
    // depth cue is fine) ONLY if their hues are far enough apart to still
    // read as different materials — otherwise they collapse into the same
    // gray, which is exactly what happened to gravel/rocks mid-session.
    for (let i = 0; i < LAYERS.length - 1; i++) {
      const a = oklch_of(LAYERS[i])
      const b = oklch_of(LAYERS[i + 1])
      const lightness_step = a.l - b.l
      if (lightness_step >= TIGHT_STEP_THRESHOLD) continue
      const hue_gap = Math.abs(a.h - b.h)
      expect(hue_gap).toBeGreaterThanOrEqual(MIN_HUE_SEPARATION_WHEN_TIGHT)
    }
  })
})

describe('palette: variant triplets step lighten → fill → darken', () => {
  const MATERIALS = [
    'water',
    'clay',
    'moss',
    'slate',
    'sediment',
    'sand',
    'gravel',
    'rocks',
    'boulders'
  ]

  const weights_of = name => ({
    lighten: `${name}-lighten`,
    fill: ['sediment', 'sand', 'gravel', 'rocks', 'boulders'].includes(name)
      ? name
      : `${name}-fill`,
    darken: `${name}-darken`
  })

  it.each(MATERIALS)('%s weights get lighter toward lighten', name => {
    const { lighten, fill, darken } = weights_of(name)
    const l_lighten = oklch_of(lighten).l
    const l_fill = oklch_of(fill).l
    const l_darken = oklch_of(darken).l
    expect(l_lighten).toBeGreaterThan(l_fill)
    expect(l_fill).toBeGreaterThan(l_darken)
  })
})
