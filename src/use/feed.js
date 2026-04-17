/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */
/** @typedef {import('@/types').Statements} Statements */

import { ref, watch, inject } from 'vue'
import { as_author } from '@/utils/itemid'
import { poster_thought_overlay_pairs, slot_key } from '@/use/statements'

const my_id = () =>
  (typeof window !== 'undefined' ? window.localStorage?.me : null) ?? null

/**
 * @typedef {Object} Use_Feed_Options
 * @property {import('vue').Ref<Item[]>} posters
 * @property {import('vue').Ref<Item[]|null>} statements
 * @property {(query: { id: Id }) => Promise<void>} statements_for_person
 * @property {(query: { id: Id }) => Promise<void>} posters_for_person
 * @property {import('vue').Ref<number>|null} [refresh_signal]
 * @property {import('vue').Ref<Array<unknown>>|null} [queue_items]
 * @property {() => Promise<void>} [on_refresh] replaces default refresh when set (e.g. reload phonebook then feed)
 * @property {(working: boolean) => void} [set_working] when set (including explicitly `undefined`), skips inject; tests use this
 */

/**
 * Shared feed behavior for Thoughts/Profile.
 *
 * @param {Use_Feed_Options} options
 */
export const use_feed = options => {
  const {
    posters,
    statements,
    statements_for_person,
    posters_for_person,
    refresh_signal = null,
    queue_items = null,
    on_refresh = null
  } = options
  const set_working =
    'set_working' in options ? options.set_working : inject('set_working')
  const loaded_people_ids = ref(/** @type {Id[]} */ ([]))
  /** @type {Map<string, ReturnType<typeof poster_thought_overlay_pairs>>} */
  const overlay_cache = new Map()

  /**
   * Same calendar bucket often gets a new array instance each render; key by item ids.
   * @param {unknown[]} day
   */
  const overlay_cache_key = day => {
    if (!Array.isArray(day) || day.length === 0) return ''
    return day
      .map(item =>
        slot_key(
          /** @type {import('@/types').Item | import('@/types').Statements} */ (
            item
          )
        )
      )
      .join('\0')
  }

  /**
   * @param {Id[]} people_ids
   * @param {{ reset?: boolean }} [options]
   */
  const load_feed_for_people = async (people_ids, options = {}) => {
    const { reset = false } = options
    const unique_people_ids = [...new Set(people_ids.filter(Boolean))]
    if (reset) {
      posters.value = []
      statements.value = []
      overlay_cache.clear()
    }
    loaded_people_ids.value = /** @type {Id[]} */ (unique_people_ids)
    await Promise.all(
      unique_people_ids.map(async raw_id => {
        const id = /** @type {Id} */ (raw_id)
        await Promise.all([
          statements_for_person({ id }),
          posters_for_person({ id })
        ])
      })
    )
  }

  /**
   * @param {Statements} item
   */
  const is_editable = item => {
    const me = my_id()
    if (!me) return false
    return as_author(item?.[0]?.id) === me
  }

  /**
   * @param {unknown[]} day
   */
  const overlay_for_day = day => {
    const key = overlay_cache_key(day)
    let hit = overlay_cache.get(key)
    if (!hit) {
      hit = poster_thought_overlay_pairs(
        /** @type {Array<Item|Statements>} */ (day)
      )
      overlay_cache.set(key, hit)
    }
    return hit
  }

  /**
   * @param {unknown[]} day
   * @param {Item} poster
   */
  const overlay_statements_for_poster = (day, poster) => {
    const thought = overlay_for_day(day).poster_to_thought.get(poster.id)
    if (!thought) return null
    return thought
  }

  /**
   * @param {unknown[]} day
   * @param {Item} poster
   */
  const overlay_editable_for_poster = (day, poster) => {
    const thought = overlay_statements_for_poster(day, poster)
    if (!thought) return false
    return is_editable(thought)
  }

  if (refresh_signal)
    watch(refresh_signal, async () => {
      if (on_refresh) {
        await on_refresh()
        return
      }
      if (!loaded_people_ids.value.length) return
      set_working?.(true)
      try {
        await load_feed_for_people(loaded_people_ids.value)
      } finally {
        set_working?.(false)
      }
    })

  if (queue_items)
    watch(
      queue_items,
      async (new_queue, old_queue) => {
        if (!old_queue) return
        if (new_queue?.length >= old_queue.length) return
        if (!loaded_people_ids.value.length) return
        set_working?.(true)
        try {
          await load_feed_for_people(loaded_people_ids.value)
        } finally {
          set_working?.(false)
        }
      },
      { deep: true }
    )

  return {
    load_feed_for_people,
    is_editable,
    overlay_for_day,
    overlay_statements_for_poster,
    overlay_editable_for_poster
  }
}
