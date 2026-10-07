/**
 * Where generated files go: builds, run logs, deploy stages, dev data, and
 * dev secrets. `BRAYNESS_OUT` wins; inside a harness it is the harness's
 * `artifacts/brayness`, so nothing generated lands in the source tree; on a
 * host, which has no harness, it is `dist/` beside the code.
 *
 * `out.sh` is the same rule for shell scripts.
 */
import { existsSync as exists_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

const project = file_url_to_path(new URL('..', import.meta.url))

/**
 * The output folder for a project checkout.
 * @param {{ env?: Record<string, string | undefined>, root?: string }} [options]
 * @returns {string} Absolute folder.
 */
export const out_root = ({ env = process.env, root = project } = {}) => {
  if (env.BRAYNESS_OUT) return resolve(env.BRAYNESS_OUT)
  const artifacts = join(root, '..', '..', 'artifacts')
  return exists_sync(artifacts) ? join(artifacts, 'brayness') : join(root, 'dist')
}

/**
 * A path inside the output folder.
 * @param {...string} parts Path segments below it.
 * @returns {string} Absolute path.
 */
export const out_path = (...parts) => join(out_root(), ...parts)
