<template lang="html">
  <a class="event" @click="on_click()">
    <svg viewBox="0 0 150 150" :class="has_event">
      <use :href="date_picker_icon" />
      <text class="month" x="57" y="24" text-anchor="middle">{{ month }}</text>
      <text x="57" y="84" text-anchor="middle">{{ day }}</text>
    </svg>
  </a>
</template>
<script>
  import icons from '@/style/icons.svg'
  import { list } from '@/helpers/itemid'
  export default {
    props: {
      itemid: {
        type: String,
        required: true
      }
    },
    data () {
      return {
        accept: true,
        events: []
      }
    },
    computed: {
      date_picker_icon () {
        return `${icons}#date-picker`
      },
      day () {
        const event = this.events.find(event => event.url === this.itemid)
        if (event) {
          const when = new Date(parseInt(event.id))
          return when.toLocaleString('en-US', { day: 'numeric' })
        } else return new Date().toLocaleString('en-US', { day: 'numeric' })
      },
      month () {
        const event = this.events.find(event => {
          return event.url === this.itemid
        })
        if (event) {
          const when = new Date(parseInt(event.id))
          return when.toLocaleString('en-US', { month: 'long' })
        } else return new Date().toLocaleString('en-US', { month: 'long' })
      },
      has_event () {
        const exists = this.events.some(event => event.url === this.itemid)
        return exists ? 'has-event' : null
      }
    },
    async created () {
      this.events = await list(`${localStorage.me}/events`)
    },
    methods: {
      on_click () {
        this.$emit('picker', {
          picker: true,
          itemid: this.itemid
        })
      }
    }

  }
</script>
<style lang="stylus">
  a.event
    position: relative
    svg
      &.has-event
        fill: blue
      text
        fill: white
        font-size: base-line * 2
      text.month
        font-size: round((base-line / 2), 2)
        font-weight: 900
      rect, path
        stroke: darken(black, 5%)
        stroke-width: 0.5px
</style>
