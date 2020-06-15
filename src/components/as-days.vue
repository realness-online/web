<template lang="html">
  <section class="as-days">
    <header v-if="working">
      <icon name="working" />
    </header>
    <article v-for="[date, day] in days" v-else
             :key="date"
             :class="{today: is_today(date)}"
             class="day">
      <header>
        <h4>{{ as_day(date) }}</h4>
      </header>
      <slot v-for="item in day" :item="item" />
    </article>
  </section>
</template>
<script>
  import { newer_date_first } from '@/helpers/sorting'
  import date_helper from '@/helpers/date'
  import as_thoughts from '@/helpers/thoughts'
  import icon from '@/components/icon'
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
      }
    },
    data () {
      return {
        working: true,
        days: new Map()
      }
    },
    computed: {
      today_as_date () {
        const now = new Date()
        return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`
      },
      thoughts () {
        return as_thoughts(this.statements)
      }
    },
    watch: {
      statements () {
        const days = new Map()
        days[Symbol.iterator] = function * () {
          yield * [...this.entries()].sort(newer_date_first)
        }
        this.thoughts.forEach(thought => this.insert_into_day(thought, days))
        this.days = days
      },
      posters () {
        this.posters.forEach(poster => this.insert_into_day(poster))
      }
    },
    created () {
      this.working = false
    },
    methods: {
      insert_into_day (item, days) {
        const day_name = date_helper.id_as_day(item[0].id)
        const day = days.get(day_name)
        if (day && this.is_today(day)) day.push(item)
        else if (day) day.unshift(item)
        else days.set(day_name, [item])
      },
      is_today (date) {
        if (date === this.today_as_date) return true
        else return false
      },
      as_day (date) {
        return date_helper.as_day(date)
      }
    }
  }
</script>
<style lang="stylus">
  section.as-days > article.day
  section#posters > article
    display: grid
    grid-gap: base-line
    grid-template-columns: repeat(auto-fill, minmax(poster-min-width, 1fr))
    @media (min-width: pad-begins)
      grid-template-rows: (base-line * 5)
      grid-auto-rows: poster-grid-height
    @media (min-width: typing-begins)
      grid-template-columns: repeat(auto-fill, minmax((poster-min-width * base-line), 1fr))
      grid-auto-rows: (poster-grid-height * 1.11)
    & > header
      & > h1
        margin: base-line
      @media (min-width: pad-begins)
        grid-column: 1 / -1
        & > hgroup
          margin-top: -(base-line)
</style>
