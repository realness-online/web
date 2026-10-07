import { ref, computed } from 'vue'

/**
 * Optional server capabilities from realness-functions. Probed at runtime from
 * the deployed origin — no build-time env var for moderators.
 *
 * 1. GET /capabilities — hosting rewrite to the live function (when deployed)
 * 2. GET /capabilities.json — static fallback shipped with the web app (all false)
 *
 * VITE_FUNCTIONS_URL is an optional dev override (e.g. functions emulator).
 *
 * @typedef {Object} InstanceCapabilities
 * @property {boolean} push
 * @property {boolean} phone_integrity
 */

const empty_capabilities = () => ({
  push: false,
  phone_integrity: false
})

const capabilities = ref(
  /** @type {InstanceCapabilities} */ (empty_capabilities())
)
const ready = ref(false)

/** @type {Promise<InstanceCapabilities> | null} */
let probe_promise = null

const functions_override_url = () => {
  const raw = import.meta.env.VITE_FUNCTIONS_URL
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/\/$/, '')
  return trimmed || null
}

const parse_capabilities = data => ({
  push: !!data?.push,
  phone_integrity: !!data?.phone_integrity
})

/** @param {string} url */
const fetch_capabilities = async url => {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) return null
  const content_type = response.headers.get('content-type') || ''
  if (
    content_type &&
    !content_type.includes('json') &&
    !content_type.includes('text/plain')
  )
    return null
  const data = await response.json()
  if (!data || typeof data !== 'object') return null
  return parse_capabilities(data)
}

const capability_probe_urls = () => {
  /** @type {string[]} */
  const urls = []
  const override = functions_override_url()
  if (override) urls.push(`${override}/capabilities`)

  if (typeof location !== 'undefined') {
    const { origin } = location
    urls.push(`${origin}/capabilities`, `${origin}/capabilities.json`)
  }

  return [...new Set(urls)]
}

/** Probe once at boot; safe to await again (returns cached result). */
export const probe_instance_capabilities = () => {
  if (ready.value) return capabilities.value
  if (probe_promise) return probe_promise

  probe_promise = (async () => {
    for (const url of capability_probe_urls())
      try {
        // sequential: try each URL only if the previous failed
        // eslint-disable-next-line no-await-in-loop
        const parsed = await fetch_capabilities(url)
        if (parsed) {
          capabilities.value = parsed
          ready.value = true
          return capabilities.value
        }
      } catch (error) {
        console.warn('[capabilities] probe failed', url, error)
      }

    capabilities.value = empty_capabilities()
    ready.value = true
    return capabilities.value
  })()

  return probe_promise
}

export const use_instance_capabilities = () => ({
  ready: computed(() => ready.value),
  capabilities: computed(() => capabilities.value),
  push: computed(() => capabilities.value.push),
  phone_integrity: computed(() => capabilities.value.phone_integrity),
  probe: probe_instance_capabilities
})
