/**
 * Where a finished sign-on goes: the `next` it was sent with, if that stays on
 * this site, otherwise the account page.
 * @param {Record<string, unknown> | undefined} query
 * @returns {string}
 */
export const after_sign_on = query => {
  const next = query?.next
  const same_site =
    typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
  return same_site ? next : '/account'
}
