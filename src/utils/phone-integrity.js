const functions_override_url = () => {
  const raw = import.meta.env.VITE_FUNCTIONS_URL
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/\/$/, '')
  return trimmed || null
}

/** @param {string} path */
const service_urls = path => {
  /** @type {string[]} */
  const urls = []
  const override = functions_override_url()
  if (override) urls.push(`${override}${path}`)

  if (typeof location !== 'undefined') urls.push(`${location.origin}${path}`)

  return [...new Set(urls)]
}

/**
 * Pre-auth Twilio Lookup gate. Returns null when the endpoint is unreachable.
 * @param {string} phone E.164
 * @returns {Promise<{ allowed: boolean, integrity_data?: object } | null>}
 */
export const check_phone_integrity = async phone => {
  for (const url of service_urls('/check-phone-integrity'))
    try {
      // sequential: try each URL only if the previous failed
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone })
      })
      if (!response.ok) continue
      // eslint-disable-next-line no-await-in-loop
      const data = await response.json()
      if (typeof data?.allowed === 'boolean') return data
    } catch (error) {
      console.warn('[integrity] check failed', url, error)
    }

  return null
}
