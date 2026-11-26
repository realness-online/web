/**
 * Cap meter: after each Claude reply, mark the session page with Anthropic's
 * own weekly meter and whether the call ran on the subscription or on paid
 * credits. `.pi/bin/prewalk/taken.js` reads the marks to count cap used.
 */

/**
 * The weekly meter in a reply's headers, or null without it.
 * @param {Record<string, string> | undefined} headers
 */
export const meter_of = headers => {
  const used = headers?.['anthropic-ratelimit-unified-7d-utilization']
  if (!used) return null
  return { used: Number(used), reset: Number(headers['anthropic-ratelimit-unified-7d-reset'] ?? 0) }
}

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
export default pi => {
  pi.on('after_provider_response', (event, ctx) => {
    if (ctx.model?.provider !== 'anthropic') return
    const billing = ctx.modelRegistry?.isUsingOAuth(ctx.model) ? 'sub' : 'credits'
    const meter = meter_of(event.headers)
    if (!meter && billing === 'sub') return
    pi.appendEntry('cap-meter', { billing, ...meter, at: new Date().toISOString() })
  })
}
