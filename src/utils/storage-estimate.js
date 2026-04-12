/** Fraction of quota at which we warn (e.g. 0.85 = 85%). */
const WARN_FRACTION = 0.85
const PERCENT_SCALE = 100

/**
 * Logs `navigator.storage.estimate()` so IndexedDB / origin quota use is visible in devtools.
 * Warns once per load when usage is a high fraction of quota.
 * @returns {Promise<void>}
 */
export async function log_storage_estimate() {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    const pct = quota > 0 ? Math.round((usage / quota) * PERCENT_SCALE) : null
    console.info('[storage] estimate', {
      usage_bytes: usage,
      quota_bytes: quota,
      pct_used: pct
    })
    if (quota > 0 && usage / quota >= WARN_FRACTION)
      console.warn('[storage] origin storage near quota', {
        usage_bytes: usage,
        quota_bytes: quota,
        pct_used: pct
      })
  } catch (e) {
    console.warn('[storage] estimate failed', e)
  }
}
