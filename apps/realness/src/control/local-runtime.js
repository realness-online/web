/**
 * Which actor runtime the local halo should run: `box` unless the shell asks
 * for `firecracker`. dev-stack.sh reads the same RUNTIME and defaults to box.
 */
/** @typedef {'box' | 'firecracker'} Runtime */
/** @type {readonly Runtime[]} */
const RUNTIMES = ['box', 'firecracker']

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Runtime}
 */
export const local_runtime = (env = process.env) => {
  const asked = env.HALO_RUNTIME ?? env.RUNTIME
  return RUNTIMES.find(runtime => runtime === asked) ?? 'box'
}

/**
 * A halo built before health reported its runtime counts as a mismatch.
 * @param {{ runtime?: string } | null | undefined} health
 * @param {NodeJS.ProcessEnv} [env]
 */
export const runtime_matches = (health, env = process.env) =>
  health?.runtime === local_runtime(env)
