/* The pay page talks to the proxy through this app's /pay: GET /pay/limit,
   POST /pay/checkout for a Stripe Checkout URL. Both take the ID token. */

/** The caller's limits, use, and warning. */
export const get_limit = async token => {
  const response = await fetch('/pay/limit', {
    headers: { authorization: `Bearer ${token}` }
  })
  if (!response.ok)
    throw new Error(`Could not read your limits (${response.status})`)
  return response.json()
}

/** Starts a subscription; resolves to Stripe's hosted checkout URL. */
export const start_checkout = async token => {
  const response = await fetch('/pay/checkout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` }
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.url)
    throw new Error(
      body.error ?? `Could not start checkout (${response.status})`
    )
  return body.url
}

/** One line per limit, for people. */
export const limit_lines = status => {
  const n = value =>
    value === null || value === undefined
      ? 'no limit'
      : value.toLocaleString('en-US')
  const lines = [
    `Today: ${n(status.free.day.used)} of ${n(status.free.day.limit)} free tokens`,
    `This month: ${n(status.free.month.used)} of ${n(status.free.month.limit)} free tokens`
  ]
  if (status.paid)
    lines.push(
      `House model credit: $${status.paid.used.toFixed(2)} of $${status.paid.credit.toFixed(2)}`
    )
  return lines
}
