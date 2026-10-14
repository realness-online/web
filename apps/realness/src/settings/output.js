import { existsSync as exists_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { project_root } from './layout.js'

/** BRAYNESS_OUT overrides the harness artifact directory; standalone hosts use dist. */
export const out_root = ({ env = process.env, root = project_root } = {}) => {
  if (env.BRAYNESS_OUT) return resolve(env.BRAYNESS_OUT)
  const artifacts = join(root, '..', '..', 'artifacts')
  return exists_sync(artifacts)
    ? join(artifacts, 'brayness')
    : join(root, 'dist')
}

export const out_path = (...parts) => join(out_root(), ...parts)

export const frontend_out = (...parts) =>
  join(
    process.env.DIST_DIR
      ? resolve(process.env.DIST_DIR)
      : out_path('frontend', 'dist'),
    ...parts
  )
