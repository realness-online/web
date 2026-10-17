/** @param {NodeJS.ProcessEnv} [env] */
export const halo_pass_secret = (env = process.env) => env.HALO_PASS_SECRET
