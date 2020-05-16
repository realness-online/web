
<template lang="html">
  <section class="as-day">
    <header v-if="working">
      <icon name="working"></icon>
    </header>
    <article v-else class="day" :key="date" v-for="[date, day] in days" :class="{today: is_today(date)}">
      <header>
        <h4>{{as_day(date)}}</h4>
      </header>
      <slot v-for="item in day" :item="item"></slot>
    </article>
  </section>
</template>
<script>
  import { newer_item_first } from '@/helpers/sorting'
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
    created () {
      if (this.statements.length) {
        this.statements.sort(newer_item_first)
        as_thoughts(this.statements).forEach(thought => this.insert_into_day(thought))
      }
      this.posters.forEach(poster => this.insert_into_day(poster))
      this.working = false
    },
    computed: {
      today_as_date () {
        const now = new Date()
        return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`
      }
    },
    methods: {
      insert_into_day (item) {
        const day_name = date_helper.id_as_day(item[0].id)
        const day = this.days.get(day_name)
        if (day) {
          day.unshift(item)
          day.sort()
        } else this.days.set(day_name, [item])
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
