/**
 * Reads named HSL(A) color assignments straight out of variables.styl, so
 * palette-harmony tests assert against the real source of truth instead of
 * a hand-copied duplicate that can drift.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const VARIABLES_PATH = path.resolve(
  fileURLToPath(import.meta.url),
  '../../../src/style/variables.styl'
)

const ASSIGNMENT_RE = /^([a-z][a-z0-9-]*)\s*=\s*hsla?\(([^)]+)\)/gm

/**
 * @returns {Record<string, { h: number, s: number, l: number, a: number }>}
 */
export const read_palette = () => {
  const text = readFileSync(VARIABLES_PATH, 'utf8')
  const palette = {}
  for (const match of text.matchAll(ASSIGNMENT_RE)) {
    const [, name, args] = match
    const [h, s, l, a] = args.split(',').map(part => Number.parseFloat(part))
    palette[name] = { h, s, l, a: Number.isFinite(a) ? a : 1 }
  }
  return palette
}
