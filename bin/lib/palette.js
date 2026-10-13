import { readFileSync as read_file_sync } from "node:fs"
import { join } from "node:path"

const PALETTE = "apps/realness/themes/realness/palette.css"

/** oklch lightness, chroma, hue to sRGB hex; alpha is dropped. */
export const oklch_hex = (L, C, H) => {
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const byte = (x) => {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")
  }
  return `#${rgb.map(byte).join("")}`
}

/** Every `--name: oklch(...)` swatch as { name: hex }. */
export const swatches = (root) => {
  const css = read_file_sync(join(root, PALETTE), "utf8")
  const out = {}
  for (const [, name, L, C, H] of css.matchAll(/--([\w-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/g))
    out[name] = oklch_hex(Number(L), Number(C), Number(H))
  return out
}

/** The four plan status classDefs, in Realness swatches. Mermaid cannot read var(). */
export const legend = (root) => {
  const p = swatches(root)
  return [
    `classDef gate fill:${p["ochre-darken"]},stroke:${p.ochre},color:${p["ochre-lighten"]};`,
    `classDef done fill:none,stroke:${p.graphite},stroke-dasharray:3 3,color:${p.graphite};`,
    `classDef active fill:${p["water-darken"]},stroke:${p["water-lighten"]},color:${p.chalk};`,
    `classDef blocked fill:${p["clay-darken"]},stroke:${p["clay-lighten"]},color:${p.chalk};`,
  ]
}
