/**
 * Whether a secret holds a non-blank value. Firebase exposes a bound secret as
 * an environment variable; reading it here, rather than through `.value()`,
 * keeps an optional feature's unset secret from logging a warning on every check.
 */
export const secret_set = secret => !!process.env[secret.name]?.trim()
