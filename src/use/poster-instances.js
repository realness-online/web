/** @typedef {import('@/types').Id} Id */
import { reactive, ref, computed, watch, toValue, onBeforeUnmount } from 'vue'
import { poster_dom_id } from '@/use/poster-dom-reference'

/**
 * Page-wide registry of every live rendering of a poster, keyed by itemid. Lets the N
 * instances of one poster elect a single visible canonical that owns the shared
 * `<defs>`/`<symbol>`s; the rest reference it with `<use href="#…">`. When none are visible
 * there is no canonical and every instance renders normally.
 *
 * @typedef {object} PosterInstanceRecord
 * @property {number} uid
 * @property {'poster' | 'avatar'} kind
 * @property {import('vue').MaybeRefOrGetter<Element | null | undefined>} el
 * @property {import('vue').Ref<boolean>} in_view
 */

/** @type {Map<string, PosterInstanceRecord[]>} */
const registry = reactive(new Map())

let next_uid = 0

/** Node.DOCUMENT_POSITION_FOLLOWING — kept local so the election stays testable without a DOM. */
const DOCUMENT_POSITION_FOLLOWING = 4

/**
 * Is `a` before `b` in document order? Missing elements sort last.
 * @param {Element | null | undefined} a
 * @param {Element | null | undefined} b
 * @returns {boolean}
 */
const precedes = (a, b) => {
  if (!a) return false
  if (!b) return true
  if (a === b) return false
  return (a.compareDocumentPosition(b) & DOCUMENT_POSITION_FOLLOWING) !== 0
}

/**
 * Pure election: among visible instances prefer a full poster over an avatar/row, then take
 * the earliest in document order. No visible instance → no canonical.
 * @param {Array<{ uid: number, kind: string, el: Element | null | undefined, in_view: boolean }>} records
 * @returns {{ uid: number } | null}
 */
export const elect_canonical = records => {
  const visible = records.filter(record => record.in_view)
  if (visible.length === 0) return null
  const posters = visible.filter(record => record.kind === 'poster')
  const pool = posters.length > 0 ? posters : visible
  return pool.reduce((best, record) =>
    precedes(record.el, best.el) ? record : best
  )
}

/**
 * @param {string} itemid
 * @returns {PosterInstanceRecord[]}
 */
const records_for = itemid => {
  let list = registry.get(itemid)
  if (!list) {
    list = reactive([])
    registry.set(itemid, list)
  }
  return list
}

/**
 * Register this rendering of a poster and derive whether it should be the canonical
 * (full render that owns the defs) or reference the canonical with `<use>`.
 *
 * @param {import('vue').MaybeRefOrGetter<Id>} itemid
 * @param {object} options
 * @param {import('vue').MaybeRefOrGetter<Element | null | undefined>} options.el - root element of this instance
 * @param {import('vue').MaybeRefOrGetter<boolean>} options.in_view
 * @param {'poster' | 'avatar'} options.kind
 */
export const use_poster_instance = (itemid, { el, in_view, kind }) => {
  const uid = next_uid++
  const list = records_for(String(toValue(itemid)))

  /** @type {PosterInstanceRecord} */
  const record = { uid, kind, el, in_view: ref(!!toValue(in_view)) }
  list.push(record)

  watch(
    () => toValue(in_view),
    visible => {
      record.in_view.value = !!visible
    }
  )

  const canonical = computed(() =>
    elect_canonical(
      list.map(other => ({
        uid: other.uid,
        kind: other.kind,
        el: toValue(other.el),
        in_view: other.in_view.value
      }))
    )
  )

  const am_canonical = computed(() => canonical.value?.uid === uid)

  // Canonical and serving at least one other instance — pin the full render so referrers
  // (avatars, duplicate rows) never lose the shared defs.
  const is_referenced = computed(() => am_canonical.value && list.length > 1)

  // Reference the canonical when one exists elsewhere. Hand-off: switching *to* a reference
  // (tearing down our own full render) waits a frame so an incoming canonical paints first,
  // preventing a source-less frame for other referrers. Becoming full happens immediately.
  const want_reference = computed(
    () => !!canonical.value && canonical.value.uid !== uid
  )
  const use_reference = ref(want_reference.value)
  watch(want_reference, want => {
    if (!want) {
      use_reference.value = false
      return
    }
    if (typeof requestAnimationFrame === 'undefined') {
      use_reference.value = true
      return
    }
    requestAnimationFrame(() => {
      if (want_reference.value) use_reference.value = true
    })
  })

  const reference_target_id = computed(() =>
    use_reference.value
      ? poster_dom_id(/** @type {Id} */ (toValue(itemid)))
      : null
  )

  onBeforeUnmount(() => {
    const index = list.indexOf(record)
    if (index !== -1) list.splice(index, 1)
    if (list.length === 0) registry.delete(String(toValue(itemid)))
  })

  return { am_canonical, is_referenced, use_reference, reference_target_id }
}
