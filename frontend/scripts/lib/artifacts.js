import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Scratch output lives only in the harness root's artifacts folder. */
export const artifacts_dir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../artifacts/brayness'
)
