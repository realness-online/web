/** @typedef {import('@/types').Id} Id */
/** @typedef {{ at: string, session: string }} Sponsorship */

import { computed, nextTick as tick } from 'vue'
import { me } from '@/utils/serverless'
import { Me } from '@/persistence/Storage'

/**
 * Itemprops can come back as a single object when there's one entry, or as an
 * array when there are many. Normalize.
 * @param {unknown} source
 * @returns {Sponsorship[]}
 */
const as_array = source => {
  if (!source) return []
  if (Array.isArray(source)) return /** @type {Sponsorship[]} */ (source)
  const sponsorship = /** @type {Sponsorship} */ (source)
  return [sponsorship]
}

/**
 * Read/write sponsor state on the `me` profile element. Persistence rides on
 * the same `Me.save()` pipeline as the name form: the DOM `<address itemid>`
 * is uploaded as HTML, including the `<ol class="sponsorships">` slot.
 *
 * Verification caveat: a session_id surfaced via Stripe's redirect is not
 * authoritative on its own. A future Stripe webhook will confirm payment
 * server-side; the UI can then prefer a verified field.
 */
export const use_sponsor = () => {
  const sponsorships = computed(() => {
    const source = /** @type {{sponsorship?: unknown}} */ (me.value)
      ?.sponsorship
    return as_array(source)
      .filter(entry => entry && typeof entry.session === 'string')
      .slice()
      .sort((a, b) => (a.at < b.at ? 1 : -1))
  })

  const is_sponsor = computed(() => sponsorships.value.length > 0)
  const latest_sponsorship = computed(() => sponsorships.value[0] ?? null)

  /**
   * @param {string} session_id
   * @returns {Promise<boolean>} true when a new entry was added
   */
  const record_session = async session_id => {
    if (!session_id) return false
    if (!me.value) return false
    const target = /** @type {{sponsorship?: unknown}} */ (me.value)
    const existing = as_array(target.sponsorship)
    if (existing.some(entry => entry?.session === session_id)) return false
    const new_entry = {
      at: new Date().toISOString(),
      session: session_id
    }
    target.sponsorship = [...existing, new_entry]
    await tick()
    if (typeof document === 'undefined' || typeof localStorage === 'undefined')
      return true
    const me_el = document.querySelector(`[itemid="${localStorage.me}"]`)
    if (me_el) await new Me().save(me_el)
    return true
  }

  return {
    sponsorships,
    is_sponsor,
    latest_sponsorship,
    record_session
  }
}
