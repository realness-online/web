/** @typedef {import('@/types').Id} Id */
import { watch, onBeforeUnmount, toValue } from 'vue'
import { as_query_id } from '@/utils/itemid'

/**
 * Dispatched on `document` so the canonical `as-svg` can toggle meet/slice when a
 * duplicate row (e.g. `<use>` reference) activates, without that row emitting into the hero figure.
 */
export const POSTER_MEET_TOGGLE_ONLY = 'poster-toggle-meet-only'

/**
 * Fragment id (no `#`) for the poster root SVG (`as-svg` sets `:id="query()"`).
 * @param {Id} itemid
 * @returns {string}
 */
export const poster_dom_id = itemid => as_query_id(itemid)

/**
 * @param {Id} itemid
 * @returns {string}
 */
export const poster_dom_href = itemid => `#${poster_dom_id(itemid)}`

/**
 * @param {Node} removed
 * @param {string} id
 * @returns {boolean}
 */
export const removed_subtree_had_id = (removed, id) => {
  if (removed.nodeType !== 1) return false
  const el = /** @type {Element} */ (removed)
  if (el.id === id) return true
  try {
    // eslint-disable-next-line eqeqeq -- != null: element found (nullish; not strict identity)
    return el.querySelector(`#${CSS.escape(id)}`) != null
  } catch {
    return false
  }
}

/**
 * When a duplicate row uses `<use href="#…">`, observe removals so we can
 * reconcile if the canonical poster node disappears (virtualized list, route change, etc.).
 *
 * @param {import('vue').MaybeRefOrGetter<boolean>} active
 * @param {import('vue').MaybeRefOrGetter<Id>} itemid
 * @param {() => void} on_lost - still verify with `getElementById` inside (debounced)
 * @param {ParentNode | null | undefined} [observe_root]
 */
export const use_poster_canonical_presence = (
  active,
  itemid,
  on_lost,
  observe_root = undefined
) => {
  let obs = /** @type {MutationObserver | null} */ (null)
  let raf = 0

  const run_truth_check = () => {
    const id = poster_dom_id(/** @type {Id} */ (toValue(itemid)))
    if (!document.getElementById(id)) on_lost()
  }

  const schedule = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      raf = 0
      run_truth_check()
    })
  }

  const disconnect = () => {
    if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
    if (obs) {
      obs.disconnect()
      obs = null
    }
  }

  watch(
    () => [toValue(active), toValue(itemid)],
    () => {
      disconnect()
      const is_active = toValue(active)
      if (!is_active || typeof document === 'undefined') return
      const id = poster_dom_id(/** @type {Id} */ (toValue(itemid)))
      const root =
        toValue(observe_root) ?? document.getElementById('app') ?? document.body
      if (!root) return

      obs = new MutationObserver(muts => {
        for (const m of muts)
          for (const n of m.removedNodes)
            if (removed_subtree_had_id(n, id)) {
              schedule()
              return
            }
      })
      obs.observe(root, { childList: true, subtree: true })
    },
    { immediate: true }
  )

  onBeforeUnmount(disconnect)
}
