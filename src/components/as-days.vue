<template lang="html">
  <section class="as-day">
    <header>
      <icon v-if="working" name="working"></icon>
    </header>
    <article v-else class="day" :key="date" v-for="[date, day] in days" :class="{today: is_today(date)}">
      <header>
        <h4>{{as_day(date)}}</h4>
      </header>
      <slot v-for="item in day" :key="item.id" v-slot="{ item }"></slot>
    </article>
  </section>
</template>
<script>
  import sorting from '@/modules/sorting'
  import date_helper from '@/helpers/date'
  import as_thoughts from '@/helpers/thoughts'
  import icon from '@/components/icon'
  export default {
    components: { icon }
    props: [{
      posts: {
        type: Array,
        required: false,
        default: []
      },
      posters: {
        type: Array,
        required: false,
        default: []
      },
      avatars: {
        type: Array,
        required: false,
        default: []
      },
      events: {
        type: Array,
        required: false,
        default: []
      }
    }]
    data() {
      return {
        working: true
        days: new Map()
      }
    },
    created() {
      if (this.posts.length) as_thoughts(this.posts).forEach(this.insert_into_day)
      if (this.posters.length) this.posters.forEach(this.insert_into_day)
      this.working = false
    }
    computed: {
      today_as_date () {
        const now = new Date()
        return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`
      }
    },
    methods: {
      insert_into_day (item) {
        const day_name = date_helper.id_as_day(item.id)
        const day = this.days.get(day_name)
        if (day) {
          day.unshift(item)
          day.sort(sorting.newer_first)
        } else this.days.set(day_name, [item])
      },
      is_today (date) {
        if (date === this.today_as_date) return true
        else return false
      },
    }
  }
</script>
<style lang="stylus">
</style>
