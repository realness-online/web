/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */
/** @typedef {import('@/types').Statements} Statements */

import { ref, watch } from 'vue'
import { as_author } from '@/utils/itemid'
import { poster_thought_overlay_pairs } from '@/use/statements'

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
    queue_items = null
  } = options
  const loaded_people_ids = ref(/** @type {Id[]} */ ([]))
  const overlay_cache = new WeakMap()

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
    let hit = overlay_cache.get(day)
    if (!hit) {
      hit = poster_thought_overlay_pairs(
        /** @type {Array<Item|Statements>} */ (day)
      )
      overlay_cache.set(day, hit)
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
      if (!loaded_people_ids.value.length) return
      await load_feed_for_people(loaded_people_ids.value)
    })

  if (queue_items)
    watch(
      queue_items,
      async (new_queue, old_queue) => {
        if (!old_queue) return
        if (new_queue?.length >= old_queue.length) return
        if (!loaded_people_ids.value.length) return
        await load_feed_for_people(loaded_people_ids.value)
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
