<script setup>
  import icon from '@/components/icon'
  import {
    recent_date_first,
    same_day_today,
    same_day_past
  } from '@/utils/sorting'
  import { as_author } from '@/utils/itemid'
  import { id_as_day, as_day, is_today } from '@/utils/date'
  import { as_thoughts, thoughts_sort, slot_key } from '@/use/statements'
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

  const thought_trains = computed(() => {
    let list = []
    const by_author = statements_by_people(props.statements)
    by_author.forEach(their_statements => {
      list = [...list, ...as_thoughts(their_statements)]
    })
    list.sort(thoughts_sort)
    return list
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

  const statements_by_people = statements => {
    const people = new Map()
    if (!statements) return []
    statements.forEach(item => {
      const author = as_author(item.id)
      let theirs = people.get(author)
      if (!theirs) theirs = []
      theirs.push(item)
      people.set(author, theirs)
    })
    return people
  }

  const refill_days = () => {
    const new_days = new Map()
    new_days[Symbol.iterator] = function* () {
      const page = [...this.entries()].sort(recent_date_first)
      yield* page
    }
    thought_trains.value.forEach(stmt => insert_into_day(stmt, new_days))
    props.posters.forEach(poster => insert_into_day(poster, new_days))
    props.events.forEach(happening => insert_into_day(happening, new_days))
    days.value = new_days
  }

  const insert_into_day = (item, days_map) => {
    let day_name
    if (item.id) day_name = id_as_day(item.id)
    else day_name = id_as_day(item[0].id)
    const day = days_map.get(day_name)
    if (day && is_today(day_name)) {
      day.unshift(item)
      day.sort(same_day_today)
    } else if (day) {
      day.push(item)
      day.sort(same_day_past)
    } else days_map.set(day_name, [item])
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
