import { readFileSync as read_file_sync } from 'node:fs'
import { join } from 'node:path'
import { oklch_hex } from '../../../apps/realness/lib/oklch.js'

export { oklch_hex } from '../../../apps/realness/lib/oklch.js'

const PALETTE = 'apps/realness/themes/realness/palette.css'

/** Every `--name: oklch(...)` swatch as { name: hex }. */
export const swatches = root => {
  const css = read_file_sync(join(root, PALETTE), 'utf8')
  const out = {}
  for (const [, name, L, C, H] of css.matchAll(/--([\w-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/g))
    out[name] = oklch_hex(Number(L), Number(C), Number(H))
  return out
}

/** The plan status and graphic classDefs, in Realness swatches. Mermaid cannot read var(). */
export const legend = root => {
  const p = swatches(root)
  return [
    `classDef gate fill:${p['ochre-darken']},stroke:${p.ochre},color:${p['ochre-lighten']};`,
    `classDef done fill:none,stroke:${p.graphite},stroke-dasharray:3 3,color:${p.graphite};`,
    `classDef active fill:${p['water-darken']},stroke:${p['water-lighten']},color:${p.chalk};`,
    `classDef blocked fill:${p['clay-darken']},stroke:${p['clay-lighten']},color:${p.chalk};`,
    `classDef focus fill:none,stroke:${p['clay-lighten']},color:${p['clay-lighten']};`,
    `classDef next fill:none,stroke:${p.ochre},stroke-dasharray:3 3,color:${p['ochre-lighten']};`,
    `classDef place fill:none,stroke:${p.graphite},stroke-dasharray:3 3;`
  ]
}
