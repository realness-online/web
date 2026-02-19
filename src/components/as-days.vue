<script setup>
  import icon from '@/components/icon'
  import {
    recent_date_first,
    earlier_weirdo_first,
    recent_weirdo_first
  } from '@/utils/sorting'
  import { as_author } from '@/utils/itemid'
  import { id_as_day, as_day, is_today } from '@/utils/date'
  import { as_thoughts, thoughts_sort } from '@/use/statement'
  import {
    ref,
    computed,
    watch,
    onMounted as mounted,
    onUpdated as updated
  } from 'vue'

  // Props
  const props = defineProps({
    thoughts: {
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

  const thoughts = computed(() => {
    let thought_list = []
    const people = statements_by_people(props.thoughts)
    people.forEach(statements => {
      thought_list = [...thought_list, ...as_thoughts(statements)]
    })
    thought_list.sort(thoughts_sort)
    return thought_list
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
      let statements = people.get(author)
      if (!statements) statements = []
      statements.push(item)
      people.set(author, statements)
    })
    return people
  }

  const refill_days = () => {
    const new_days = new Map()
    new_days[Symbol.iterator] = function* () {
      const page = [...this.entries()].sort(recent_date_first)
      yield* page
    }
    thoughts.value.forEach(thought => insert_into_day(thought, new_days))
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
      day.sort(recent_weirdo_first)
    } else if (day) {
      day.push(item)
      day.sort(earlier_weirdo_first)
    } else days_map.set(day_name, [item])
  }

  watch(
    () => ({
      thoughts: props.thoughts,
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
    <article
      v-for="[date, day] in filtered_days"
      v-else
      :key="date"
      :class="{ today: is_today(date) }"
      class="day">
      <header v-if="!is_today(date)">
        <h4>{{ as_day(date) }}</h4>
      </header>
      <slot v-for="item in day" :item="item" />
    </article>
  </section>
</template>

<style lang="stylus">
  section.page.storytelling .as-days
      aspect-ratio: 16/9
      overflow-x: auto
      overflow-y: hidden
      white-space: nowrap
      display: flex
      flex-direction: row
      gap: 0
      padding: 0
      & > header
        display: none
      & > article.day
        flex-shrink: 0
        width: 100vw
        height: 100vh
        margin: 0
        padding: base-line
        display: flex
        flex-direction: column
        justify-content: center
        align-items: center
        overflow: hidden
        position: relative
        & > header
          position: absolute
          top: base-line
          left: base-line
          z-index: 6
          & > h4
            color: blue
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8)
        & > *:not(header)
          position: absolute
          top: 0
          left: 0
          width: 100%
          height: 100%
          object-fit: cover
          z-index: 1
        & > slot
          position: absolute
          top: 50%
          left: 50%
          transform: translate(-50%, -50%)
          z-index: 2
          color: white
          text-shadow: 2px 2px 4px rgba(0,0,0,0.8)
          text-align: center
          max-width: 80%
          max-height: 80%
          overflow: hidden
  section.as-days
    padding: 0 base-line
    margin-bottom: base-line * 2
    & > header > svg.working
      margin-top: base-line * 2
    & > article.day
      margin-top: base-line
      standard-grid: hi
      &:focus
        outline: none
      & > header
        @media (min-width: pad-begins)
          grid-column: 1 / -1
        & > h4
          margin: 0
</style>
