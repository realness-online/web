/**
 * Reads named HSL(A) colors from variables.styl :root literals (and any
 * remaining Stylus assignments) so palette-harmony tests assert against the
 * real source of truth instead of a hand-copied duplicate that can drift.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const VARIABLES_PATH = path.resolve(
  fileURLToPath(import.meta.url),
  '../../../src/style/variables.styl'
)

const STYLUS_ASSIGNMENT_RE = /^([a-z][a-z0-9-]*)\s*=\s*hsla?\(([^)]+)\)/gm
const CSS_VAR_LITERAL_RE = /^\s*--([a-z][a-z0-9-]*):\s*hsla?\(([^)]+)\)/gm

const parse_hsl = args => {
  const [h, s, l, a] = args.split(',').map(part => Number.parseFloat(part))
  return { h, s, l, a: Number.isFinite(a) ? a : 1 }
}

/**
 * @returns {Record<string, { h: number, s: number, l: number, a: number }>}
 */
export const read_palette = () => {
  const text = readFileSync(VARIABLES_PATH, 'utf8')
  const palette = {}

  for (const match of text.matchAll(CSS_VAR_LITERAL_RE)) {
    const [, name, args] = match
    palette[name] = parse_hsl(args)
  }

  for (const match of text.matchAll(STYLUS_ASSIGNMENT_RE)) {
    const [, name, args] = match
    palette[name] = parse_hsl(args)
  }

  return palette
}
