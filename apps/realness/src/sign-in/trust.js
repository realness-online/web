import { google_certs } from '#root/src/can/index.js'
import { issuer_for } from './issuer.js'

/**
 * Which tokens a service trusts: Realness sign-in when `SIGN_IN_URL` is set,
 * Firebase's otherwise.
 * @param {string | undefined} project
 * @param {NodeJS.ProcessEnv} [env]
 */
export const token_trust = (project, env = process.env) =>
  env.SIGN_IN_URL
    ? {
        issuer: issuer_for(project),
        certs: google_certs(
          fetch,
          `${env.SIGN_IN_URL.replace(/\/$/, '')}/certs`
        )
      }
    : {}
