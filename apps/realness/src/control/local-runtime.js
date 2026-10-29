/**
 * Which actor runtime the local halo should run: `box` unless the shell asks
 * for `firecracker`. dev-stack.sh reads the same RUNTIME and defaults to box.
 */
const RUNTIMES = ['box', 'firecracker']

export const local_runtime = (env = process.env) => {
  const asked = env.HALO_RUNTIME ?? env.RUNTIME
  return RUNTIMES.includes(asked) ? asked : 'box'
}

/** A halo built before health reported its runtime counts as a mismatch. */
export const runtime_matches = (health, env = process.env) =>
  health?.runtime === local_runtime(env)
