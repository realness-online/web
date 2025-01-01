<script setup>
  import {
    ref,
    computed,
    watch,
    onMounted as mounted,
    onUpdated as updated
  } from 'vue'
  import icon from '@/components/icon'
  import {
    recent_date_first,
    earlier_weirdo_first,
    recent_weirdo_first
  } from '@/use/sorting'
  import { as_author } from '@/use/itemid'
  import { id_as_day, as_day, is_today } from '@/use/date'
  import { as_thoughts, thoughts_sort } from '@/use/statements'

  // Add component name
  defineOptions({
    name: 'as_days'
  })

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
    const people = statements_by_people(props.statements)
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
    const days = new Map()
    days[Symbol.iterator] = function* () {
      const page = [...this.entries()].sort(recent_date_first)
      yield* page
    }
    thoughts.value.forEach(thought => insert_into_day(thought, days))
    props.posters.forEach(poster => insert_into_day(poster, days))
    props.events.forEach(happening => insert_into_day(happening, days))
    days.value = days
  }

  const insert_into_day = (item, days) => {
    let day_name
    if (item.id) day_name = id_as_day(item.id)
    else day_name = id_as_day(item[0].id)
    const day = days.get(day_name)
    if (day && is_today(day_name)) {
      day.unshift(item)
      day.sort(recent_weirdo_first)
    } else if (day) {
      day.push(item)
      day.sort(earlier_weirdo_first)
    } else days.set(day_name, [item])
  }

  const as_day = date => {
    return as_day(date)
  }

  const is_today = date => {
    return is_today(date)
  }

  // Lifecycle hooks
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

  // Watchers
  watch(
    [() => props.statements, () => props.posters, () => props.events],
    () => {
      refill_days()
    },
    { deep: true }
  )
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
