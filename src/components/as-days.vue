<template lang="html">
  <section class="as-days">
    <header v-if="working"><icon name="working" /></header>
    <article v-for="[date, day] in filtered_days" v-else
             :key="date"
             :class="{today: is_today(date)}"
             class="day">
      <header v-if="!is_today(date)">
        <h4>{{ as_day(date) }}</h4>
      </header>
      <slot v-for="item in day" :item="item" />
    </article>
  </section>
</template>
<script>
  import { recent_date_first, earlier_weirdo_first, recent_weirdo_first } from '@/helpers/sorting'
  import { as_author } from '@/helpers/itemid'
  import { id_as_day, as_day, is_today } from '@/helpers/date'
  import { as_thoughts, thoughts_sort } from '@/helpers/thoughts'
  import icon from '@/components/icon'
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
      avatars: {
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
    data () {
      return {
        days: new Map(),
        page: 1,
        observer: null
      }
    },
    computed: {
      filtered_days () {
        if (this.paginate) return [...this.days].slice(0, this.page * page_size)
        else return this.days
      },
      thoughts () {
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
      statements () {
        this.refill_days()
      },
      posters () {
        this.refill_days()
      }
    },
    mounted () {
      this.observer = new IntersectionObserver(this.check_intersection, {
        root: null,
        threshold: 0.25
      })
    },
    updated () {
      const element = this.$el.querySelector('article.day:last-of-type')
      if (element) this.observer.observe(element)
    },
    methods: {
      check_intersection (entries) {
        entries.forEach(async entry => {
          if (entry.isIntersecting) {
            this.observer.unobserve(entry.target)
            const pages = this.days.size / page_size
            if (this.page < pages) this.page += 1
          }
        })
      },
      statements_by_people (statements) {
        const people = new Map()
        statements.forEach(item => {
          const author = as_author(item.id)
          let statements = people.get(author)
          if (!statements) statements = []
          statements.push(item)
          people.set(author, statements)
        })
        return people
      },
      refill_days () {
        const days = new Map()
        days[Symbol.iterator] = function * () {
          const page = [...this.entries()].sort(recent_date_first)
          yield * page
        }
        this.thoughts.forEach(thought => this.insert_into_day(thought, days))
        this.posters.forEach(poster => this.insert_into_day(poster, days))
        this.days = days
      },
      insert_into_day (item, days) {
        let day_name
        if (item.id) day_name = id_as_day(item.id) // posters
        else day_name = id_as_day(item[0].id) // thoughts
        const day = days.get(day_name)
        if (day && is_today(day_name)) {
          day.unshift(item)
          day.sort(recent_weirdo_first)
        } else if (day) {
          day.push(item)
          day.sort(earlier_weirdo_first)
        } else days.set(day_name, [item])
      },
      as_day (date) {
        return as_day(date)
      },
      is_today (date) {
        return is_today(date)
      }
    }
  }
</script>
<style lang="stylus">
  section.as-days
    margin-bottom: base-line * 2
    & > header > svg.working
      margin-top: base-line * 2
    & > article.day
      margin-top: base-line
      display: grid
      grid-gap: base-line
      grid-template-columns: repeat(auto-fill, minmax(poster-min-width, 1fr))
      @media (min-width: pad-begins)
        grid-template-rows: (base-line * 2)
        grid-auto-rows: poster-grid-height
      @media (min-width: typing-begins)
        grid-template-rows: (base-line * 3)
        grid-template-columns: repeat(auto-fill, minmax((poster-min-width * base-line), 1fr))
      &.today
        @media (min-width: pad-begins)
          grid-template-rows: auto
      & > header
        @media (min-width: pad-begins)
          grid-column: 1 / -1
        & > h4
          margin: 0
</style>
