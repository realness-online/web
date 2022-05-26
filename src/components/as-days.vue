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
<script>
  import icon from '@/components/icon'
  import {
    recent_date_first,
    earlier_weirdo_first,
    recent_weirdo_first
  } from '@/use/sorting'
  import { as_author } from '@/use/itemid'
  import { id_as_day, as_day, is_today } from '@/use/date'
  import { as_thoughts, thoughts_sort } from '@/use/statements'

  const page_size = 5
  export default {
    components: { icon },
    props: {
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
    },
    data() {
      return {
        days: new Map(),
        page: 1,
        observer: null
      }
    },
    computed: {
      filtered_days() {
        if (this.paginate) return [...this.days].slice(0, this.page * page_size)
        else return this.days
      },
      thoughts() {
        let thoughts = []
        const people = this.statements_by_people(this.statements)
        people.forEach(statements => {
          thoughts = [...thoughts, ...as_thoughts(statements)]
        })
        thoughts.sort(thoughts_sort)
        return thoughts
      }
    },
    watch: {
      statements: {
        handler() {
          this.refill_days()
        },
        deep: true
      },
      posters: {
        handler() {
          this.refill_days()
        },
        deep: true
      },
      events: {
        handler() {
          this.refill_days()
        },
        deep: true
      }
    },
    mounted() {
      this.observer = new IntersectionObserver(this.check_intersection, {
        root: null,
        threshold: 0.25
      })
    },
    updated() {
      const element = this.$el.querySelector('article.day:last-of-type')
      if (element) this.observer.observe(element)
    },
    methods: {
      check_intersection(entries) {
        entries.forEach(async entry => {
          if (entry.isIntersecting) {
            this.observer.unobserve(entry.target)
            const pages = this.days.size / page_size
            if (this.page < pages) this.page += 1
          }
        })
      },
      statements_by_people(statements) {
        const people = new Map()
        if(!statements) return []
        statements.forEach(item => {
          const author = as_author(item.id)
          let statements = people.get(author)
          if (!statements) statements = []
          statements.push(item)
          people.set(author, statements)
        })
        return people
      },
      refill_days() {
        const days = new Map()
        days[Symbol.iterator] = function* () {
          const page = [...this.entries()].sort(recent_date_first)
          yield* page
        }
        this.thoughts.forEach(thought => this.insert_into_day(thought, days))
        this.posters.forEach(poster => this.insert_into_day(poster, days))
        this.events.forEach(happening => this.insert_into_day(happening, days))
        this.days = days
      },
      insert_into_day(item, days) {
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
      },
      as_day(date) {
        return as_day(date)
      },
      is_today(date) {
        return is_today(date)
      }
    }
  }
</script>
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
