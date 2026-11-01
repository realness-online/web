/** The caller's limits, use, and warning. */
export const get_limit = async token => {
  const response = await fetch('/pay/limit', {
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}` }
  })
  if (!response.ok)
    throw new Error(`Could not read your limits (${response.status})`)
  return response.json()
}

/** Starts a subscription; resolves to Stripe's hosted checkout URL. */
export const start_checkout = async token => {
  const response = await fetch('/pay/checkout', {
    cache: 'no-store',
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
