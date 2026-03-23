<script setup>
  import icon from '@/components/icon'
  import { recent_date_first } from '@/utils/sorting'
  import { as_author, as_created_at } from '@/utils/itemid'
  import { id_as_day, as_day, is_today } from '@/utils/date'
  import { slot_key } from '@/use/statements'
  import { thoughts_for_author, thought_feed_slots } from '@/utils/thoughts'
  import {
    ref,
    computed,
    watch,
    onMounted as mounted,
    onUpdated as updated
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

  const page_size = 5
  const days = ref(new Map())
  const page = ref(1)
  const observer = ref(null)

  const filtered_days = computed(() => {
    if (props.paginate) return [...days.value].slice(0, page.value * page_size)
    return days.value
  })

  const flattened_items = computed(() => {
    if (!props.storytelling) return []
    const items = []
    const days_to_use = props.paginate ? filtered_days.value : days.value
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
        const pages = days.value.size / page_size
        if (page.value < pages) page.value += 1
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
    days.value = new_days
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
  }

  watch(
    () => ({
      statements: props.statements,
      posters: props.posters,
      events: props.events
    }),
    () => {
      refill_days()
    },
    { deep: true, immediate: true }
  )

  mounted(() => {
    observer.value = new IntersectionObserver(check_intersection, {
      root: null,
      threshold: 0.25
    })
  })

  updated(() => {
    const element = document.querySelector('article.day:last-of-type')
    if (element) observer.value.observe(element)
  })
</script>

<template>
  <section class="as-days">
    <header v-if="working"><icon name="working" /></header>
    <template v-else-if="storytelling">
      <article @focusin="$emit('focusin', $event)">
        <section
          v-for="({ item, date }, index) in flattened_items"
          :key="slot_key(item)">
          <header v-if="!is_today(date)">
            <h4>{{ as_day(date) }}</h4>
          </header>
          <slot :day="[item]" :date="date" />
        </section>
      </article>
    </template>
    <article
      v-else
      v-for="[date, day] in filtered_days"
      :key="date"
      :class="{ today: is_today(date) }"
      class="day">
      <header v-if="!is_today(date)">
        <h4>{{ as_day(date) }}</h4>
      </header>
      <slot :day="day" :date="date" />
    </article>
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
    & > header > svg.working
      margin-top: base-line * 2
    & > article.day
      margin-top: base-line
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
