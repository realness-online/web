/**
 * Reads named OKLCH colors straight out of palette.css :root literals, so
 * palette-harmony tests assert against the real source of truth instead of
 * a hand-copied duplicate that can drift.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const VARIABLES_PATH = path.resolve(
  fileURLToPath(import.meta.url),
  '../../../src/style/palette.css'
)

const CSS_VAR_LITERAL_RE = /^\s*--([a-z][a-z0-9-]*):\s*oklch\(([^)]+)\)/gm

const parse_oklch = args => {
  const [l, c, h, a] = args
    .split(/[\s/]+/)
    .filter(Boolean)
    .map(part => Number.parseFloat(part))
  return { l, c, h, a: Number.isFinite(a) ? a : 1 }
}

/**
 * @returns {Record<string, { l: number, c: number, h: number, a: number }>}
 */
export const read_palette = () => {
  const text = readFileSync(VARIABLES_PATH, 'utf8')
  const palette = {}

  for (const match of text.matchAll(CSS_VAR_LITERAL_RE)) {
    const [, name, args] = match
    palette[name] = parse_oklch(args)
  }

  return palette
}
