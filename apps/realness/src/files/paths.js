import { skipped } from './skip.js'
import { has_escape, unsafe_part } from '#root/lib/path-parts.js'

const MAX_PATH = 512

/** A relative path an actor may be limited to: no traversal, no secrets. */
export const limit_path = path =>
  typeof path === 'string' &&
  path.length <= MAX_PATH &&
  !skipped(path) &&
  path.split('/').every(part => !unsafe_part(part) && !has_escape(part))
