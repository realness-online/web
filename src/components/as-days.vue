<script setup>
  import icon from '@/components/icon'
  import { recent_date_first } from '@/utils/sorting'
  import { as_author, as_created_at, feed_slot_itemid } from '@/utils/itemid'
  import { id_as_day, as_day, is_today } from '@/utils/date'
  import { thoughts_for_author, thought_feed_slots } from '@/utils/thoughts'
  import {
    ref,
    computed,
    watch,
    onMounted as mounted,
    onBeforeUnmount as before_unmount
  } from 'vue'

  // Props
  const props = defineProps({
    statements: {
      type: Array,
      required: false,
      default: () => []
    },
    posters: {
      type: Array,
      required: false,
      default: () => []
    },
    events: {
      type: Array,
      required: false,
      default: () => []
    },
    paginate: {
      type: Boolean,
      required: false,
      default: true
    },
    working: {
      type: Boolean,
      required: false,
      default: false
    },
    storytelling: {
      type: Boolean,
      required: false,
      default: false
    }
  })

  const DEFAULT_SLOT_BATCH = 12
  const MIN_SLOT_COUNT = 6

  const days = ref(new Map())
  const visible_slot_count = ref(0)
  const viewport_slot_batch = ref(DEFAULT_SLOT_BATCH)
  const observer = ref(null)

  const sorted_days_entries = computed(() => [...days.value])

  const estimate_viewport_slot_batch = () => {
    if (typeof window === 'undefined') return DEFAULT_SLOT_BATCH
    const min_card_width = 420
    const estimated_card_height = 360
    const columns = Math.max(1, Math.floor(window.innerWidth / min_card_width))
    const rows = Math.max(
      1,
      Math.ceil(window.innerHeight / estimated_card_height) + 1
    )
    return Math.max(MIN_SLOT_COUNT, columns * rows)
  }

  const update_viewport_slot_batch = () => {
    viewport_slot_batch.value = estimate_viewport_slot_batch()
    if (!props.paginate) return
    if (visible_slot_count.value < viewport_slot_batch.value)
      visible_slot_count.value = viewport_slot_batch.value
  }

  const flattened_day_slots = computed(() => {
    const slots = []
    for (const [date, day] of sorted_days_entries.value)
      for (const item of day) slots.push({ date, item })
    return slots
  })

  const visible_day_slots = computed(() => {
    if (!props.paginate) return flattened_day_slots.value
    const limit = Math.max(viewport_slot_batch.value, visible_slot_count.value)
    return flattened_day_slots.value.slice(0, limit)
  })

  const filtered_days_list = computed(() => {
    if (!props.paginate) return sorted_days_entries.value

    /** @type {Map<string, unknown[]>} */
    const grouped_days = new Map()
    const ordered_days = []
    for (const { date, item } of visible_day_slots.value) {
      if (!grouped_days.has(date)) {
        grouped_days.set(date, [])
        ordered_days.push(date)
      }
      grouped_days.get(date)?.push(item)
    }
    return ordered_days
      .map(date => [date, grouped_days.get(date)])
      .filter(([, day]) => day?.length)
  })

  /**
   * Cheap signature so we refill when membership or order changes, without a deep watch
   * over statements / posters / events (which costs reactive traversal every tick).
   */
  const feed_source_signature = computed(() => {
    const ids = items => (items ?? []).map(item => item.id).join('\u001f')
    return [
      (props.statements ?? []).length,
      ids(props.statements),
      (props.posters ?? []).length,
      ids(props.posters),
      (props.events ?? []).length,
      ids(props.events)
    ].join('|')
  })

  const flattened_items = computed(() => {
    if (!props.storytelling) return []
    const items = []
    const days_to_use = props.paginate
      ? filtered_days_list.value
      : sorted_days_entries.value
    for (const [date, day] of days_to_use)
      for (const item of day) {
        if (Array.isArray(item)) continue
        items.push({ item, date })
      }

    return items
  })

  const thought_feed_slots_list = computed(() => {
    /** @type {unknown[]} */
    const slots = []
    const ordered_authors = []
    const seen = new Set()
    const note_author = id => {
      if (seen.has(id)) return
      seen.add(id)
      ordered_authors.push(id)
    }
    if (props.statements)
      props.statements.forEach(s => note_author(as_author(s.id)))
    if (props.posters) props.posters.forEach(p => note_author(as_author(p.id)))
    for (const author_id of ordered_authors) {
      const items = [
        ...(props.statements ?? []).filter(s => as_author(s.id) === author_id),
        ...(props.posters ?? []).filter(p => as_author(p.id) === author_id)
      ]
      for (const th of thoughts_for_author(items))
        slots.push(...thought_feed_slots(th))
    }
    return slots
  })

  const check_intersection = entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        observer.value.unobserve(entry.target)
        if (!props.paginate) return
        const max_slots = flattened_day_slots.value.length
        if (visible_slot_count.value >= max_slots) return
        visible_slot_count.value = Math.min(
          max_slots,
          visible_slot_count.value + viewport_slot_batch.value
        )
      }
    })
  }

  const refill_days = () => {
    const new_days = new Map()
    new_days[Symbol.iterator] = function* () {
      const page = [...this.entries()].sort(recent_date_first)
      yield* page
    }
    thought_feed_slots_list.value.forEach(slot => push_to_day(slot, new_days))
    props.events.forEach(happening => push_to_day(happening, new_days))
    for (const day_name of new_days.keys())
      sort_day_grouped_by_author(
        day_name,
        /** @type {unknown[]} */ (new_days.get(day_name))
      )
    let max_slots = 0
    for (const day of new_days.values()) max_slots += day.length
    days.value = new_days
    if (!props.paginate) return
    const current = visible_slot_count.value
    const batch = viewport_slot_batch.value
    if (max_slots > current)
      visible_slot_count.value = Math.min(current + batch, max_slots)
    else
      visible_slot_count.value = Math.min(Math.max(current, batch), max_slots)
  }

  /**
   * @param {unknown} item
   * @param {Map<string, unknown[]>} days_map
   */
  const push_to_day = (item, days_map) => {
    const day_name = Array.isArray(item)
      ? id_as_day(item[0].id)
      : id_as_day(/** @type {import('@/types').Item} */ (item).id)
    const existing = days_map.get(day_name)
    if (existing) existing.push(item)
    else days_map.set(day_name, [item])
  }

  /**
   * @param {import('@/types').Statements | import('@/types').Item} slot
   * @returns {number | null}
   */
  const slot_timestamp = slot => {
    const id = Array.isArray(slot) ? slot[0]?.id : slot.id
    if (!id) return null
    return as_created_at(id)
  }

  /**
   * Newest activity time for a feed slot (max over a statement train).
   * @param {import('@/types').Statements | import('@/types').Item} slot
   * @returns {number}
   */
  const slot_newest_timestamp = slot => {
    if (Array.isArray(slot)) {
      let max = 0
      for (const s of slot) {
        const t = as_created_at(s.id)
        if (t !== null && t !== undefined && t > max) max = t
      }
      return max
    }
    return as_created_at(slot.id) ?? 0
  }

  /**
   * @param {string} day_name
   * @param {unknown[]} day
   */
  const sort_day_grouped_by_author = (day_name, day) => {
    /** @type {Map<string, { slots: Array<import('@/types').Statements | import('@/types').Item> }>} */
    const by_author = new Map()
    for (const item of day) {
      const slot =
        /** @type {import('@/types').Statements | import('@/types').Item} */ (
          item
        )
      const id = Array.isArray(slot) ? slot[0]?.id : slot.id
      if (!id) continue
      const author = as_author(id)
      let bucket = by_author.get(author)
      if (!bucket) {
        bucket = { slots: [] }
        by_author.set(author, bucket)
      }
      bucket.slots.push(slot)
    }
    const author_group_anchor = bucket =>
      bucket.slots.reduce((min, slot) => {
        const t = slot_timestamp(slot)
        return t === null ? min : Math.min(min, t)
      }, Infinity)
    const ordered_authors = [...by_author.entries()].sort((a, b) => {
      const anc_a = author_group_anchor(a[1])
      const anc_b = author_group_anchor(b[1])
      const by_anchor = is_today(day_name) ? anc_b - anc_a : anc_a - anc_b
      if (by_anchor !== 0) return by_anchor
      return String(a[0]).localeCompare(String(b[0]))
    })
    day.length = 0
    for (const [, bucket] of ordered_authors) day.push(...bucket.slots)
    if (is_today(day_name))
      day.sort(
        (a, b) =>
          slot_newest_timestamp(
            /** @type {import('@/types').Statements | import('@/types').Item} */ (
              b
            )
          ) -
          slot_newest_timestamp(
            /** @type {import('@/types').Statements | import('@/types').Item} */ (
              a
            )
          )
      )
  }

  watch(feed_source_signature, () => refill_days(), { immediate: true })

  const last_day_sentinel = ref(/** @type {Element | null} */ (null))

  const set_last_day_sentinel_ref = (el, index) => {
    const n = filtered_days_list.value.length
    if (index === n - 1) last_day_sentinel.value = el
  }

  watch(
    () => filtered_days_list.value.length,
    len => {
      if (len === 0) last_day_sentinel.value = null
    }
  )

  mounted(() => {
    update_viewport_slot_batch()
    observer.value = new IntersectionObserver(check_intersection, {
      root: null,
      threshold: 0.25
    })
    window.addEventListener('resize', update_viewport_slot_batch)
  })

  before_unmount(() => {
    observer.value?.disconnect()
    if (typeof window !== 'undefined')
      window.removeEventListener('resize', update_viewport_slot_batch)
  })

  watch(
    [last_day_sentinel, observer, () => props.paginate],
    () => {
      if (!props.paginate || !observer.value || !last_day_sentinel.value) return
      observer.value.observe(last_day_sentinel.value)
    },
    { flush: 'post' }
  )
</script>

<template>
  <section class="as-days">
    <header v-if="working"><icon name="working" /></header>
    <template v-else-if="storytelling">
      <article @focusin="$emit('focusin', $event)">
        <section
          v-for="({ item, date }, index) in flattened_items"
          :key="feed_slot_itemid(item)">
          <header v-if="!is_today(date)">
            <h4>{{ as_day(date) }}</h4>
          </header>
          <slot :day="[item]" :date="date" />
        </section>
      </article>
    </template>
    <div v-else role="feed">
      <article
        v-for="([date, day], index) in filtered_days_list"
        :key="date"
        :ref="el => set_last_day_sentinel_ref(el, index)"
        :class="{ today: is_today(date) }">
        <header v-if="!is_today(date)">
          <h4>{{ as_day(date) }}</h4>
        </header>
        <slot :day="day" :date="date" />
      </article>
    </div>
  </section>
</template>

<style lang="stylus">
  section.page.storytelling section.as-days
    display: flex
    flex-direction: column
    overflow: hidden
    padding: 0
    gap: 0
    min-height: 100vh
    & > header
      display: none
    & > article
      container-type: inline-size
      container-name: storytelling
      display: flex
      overflow-x: auto
      overflow-y: hidden
      gap: base-line
      scroll-behavior: smooth
      height: 100vh
      min-height: 100vh
      align-items: center
      justify-content: start
      flex: 1
      & > section
        height: 100vh
        min-height: 100vh
        flex-shrink: 0
        min-width: var(--storytelling-slide-width)
        max-width: var(--storytelling-slide-width)
        display: flex
        align-items: center
        justify-content: center
        overflow: hidden
        position: relative
        & > header
          position: absolute
          top: base-line
          left: base-line
          z-index: 6
          & > h4
            color: var(--blue)
            text-shadow: 0 0 2px var(--black)
        & > article,
        & > figure
          width: 100%
          height: 100%
          display: flex
          align-items: center
          justify-content: center
        & > figure
          animation: none
  section.as-days
    padding: 0 base-line
    margin-bottom: base-line * 2
    container-type: inline-size
    container-name: feed-days
    & > header > svg.working
      margin-top: base-line * 2
    & [role='feed']
      display: flex
      flex-direction: column
      gap: base-line
    & [role='feed'] > article
      min-width: 0
      standard-grid: hi
      @media (min-width: page-width-large)
        grid-template-columns: repeat(auto-fill, minmax(420px, 1fr))
      &:focus
        outline: none
      & > header
        @media (min-width: pad-begins)
          grid-column: 1 / -1
        & > h4
          margin: 0
</style>
