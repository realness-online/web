import path from 'node:path'
import { fileURLToPath as file_u_r_l_to_path } from 'node:url'

/** Scratch output lives only in the harness root's artifacts folder. */
export const artifacts_dir = path.resolve(
  path.dirname(file_u_r_l_to_path(import.meta.url)),
  '../../../../artifacts/realness'
)
