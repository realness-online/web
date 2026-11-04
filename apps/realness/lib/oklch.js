const HALF_TURN_DEGREES = 180
const BYTE = 255
const HEX = 16

/** OKLab a and b weights for each cone response; lightness weighs 1. */
const LMS = {
  l: { a: 0.3963377774, b: 0.2158037573 },
  m: { a: -0.1055613458, b: -0.0638541728 },
  s: { a: -0.0894841775, b: -1.291485548 }
}

/** Linear sRGB channels from cubed cone responses. */
const SRGB = {
  r: { l: 4.0767416621, m: -3.3077115913, s: 0.2309699292 },
  g: { l: -1.2684380046, m: 2.6097574011, s: -0.3413193965 },
  b: { l: -0.0041960863, m: -0.7034186147, s: 1.707614701 }
}

/** The sRGB transfer curve: linear near black, a power curve above. */
const CURVE = {
  knee: 0.0031308,
  slope: 12.92,
  scale: 1.055,
  gamma: 2.4,
  offset: 0.055
}

/** oklch lightness, chroma, hue to sRGB hex; alpha is dropped. */
export const oklch_hex = (L, C, H) => {
  const h = (H * Math.PI) / HALF_TURN_DEGREES
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const cone = weights => (L + weights.a * a + weights.b * b) ** 3
  const lms = { l: cone(LMS.l), m: cone(LMS.m), s: cone(LMS.s) }
  const linear = weights =>
    weights.l * lms.l + weights.m * lms.m + weights.s * lms.s
  const byte = x => {
    const v =
      x <= CURVE.knee
        ? CURVE.slope * x
        : CURVE.scale * x ** (1 / CURVE.gamma) - CURVE.offset
    return Math.round(Math.min(1, Math.max(0, v)) * BYTE)
      .toString(HEX)
      .padStart(2, '0')
  }
  return `#${[SRGB.r, SRGB.g, SRGB.b].map(linear).map(byte).join('')}`
}
