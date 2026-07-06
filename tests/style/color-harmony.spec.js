import { describe, it, expect } from 'vite-plus/test'
import {
  hsl_to_oklch,
  hsl_to_hex,
  contrast_ratio
} from '@/utils/color-converters'
import { read_palette } from '../helpers/palette'

// Guards the perceptual-harmony fixes made to the palette this round —
// not a general design-token linter, just the specific failure modes we
// hit by hand: signal colors reading as twins, and geology-ramp steps
// collapsing into each other when lightness alone doesn't separate them.

const palette = read_palette()

const oklch_of = name => {
  const { h, s, l } = palette[name]
  return hsl_to_oklch(h, s, l)
}

const hex_of = name => {
  const { h, s, l } = palette[name]
  return hsl_to_hex(h, s, l)
}

describe('palette: text/surface contrast (WCAG AA, 4.5:1)', () => {
  const AA_NORMAL_TEXT = 4.5

  it.each([
    ['graphite', 'chalk'], // light-mode body text on the light surface
    ['white-text', 'basalt'], // dark-mode body text on the dark surface
    ['clay-light', 'chalk'], // emphasis/danger text, light mode
    ['clay-dark', 'basalt'], // emphasis/danger text, dark mode
    ['slate-light', 'chalk'], // accent (link) text, light mode
    ['water-dark', 'basalt'] // accent (link) text, dark mode
  ])('%s on %s clears %s:1', (fg, bg) => {
    expect(contrast_ratio(hex_of(fg), hex_of(bg))).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT
    )
  })
})

describe('palette: signal colors stay distinguishable', () => {
  const MIN_LIGHTNESS_GAP = 0.05

  it('sulfur and ochre keep a real lightness gap, not just a hue difference', () => {
    // Hue alone doesn't save you here — the original regression had sulfur
    // and ochre nearly identical in OKLCH lightness/chroma despite a 31°
    // hue gap, which read as near-twins side by side as signal chips.
    const sulfur = oklch_of('sulfur')
    const ochre = oklch_of('ochre')
    expect(Math.abs(sulfur.l - ochre.l)).toBeGreaterThanOrEqual(
      MIN_LIGHTNESS_GAP
    )
  })
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
