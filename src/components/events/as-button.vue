<script>
  import icons from '/icons.svg'
  import { list } from '@/use/itemid'
  export default {
    props: {
      itemid: {
        type: String,
        required: true
      }
    },
    emits: ['picker'],
    data() {
      return {
        accept: true,
        events: []
      }
    },
    computed: {
      date_picker_icon() {
        return `${icons}#date-picker`
      },
      day() {
        const event = this.events.find(event => event.url === this.itemid)
        if (event) {
          const when = new Date(parseInt(event.id))
          return when.toLocaleString('en-US', { day: 'numeric' })
        } return new Date().toLocaleString('en-US', { day: 'numeric' })
      },
      month() {
        const event = this.events.find(event => event.url === this.itemid)
        if (event) {
          const when = new Date(parseInt(event.id))
          return when.toLocaleString('en-US', { month: 'long' })
        } return new Date().toLocaleString('en-US', { month: 'long' })
      },
      has_event() {
        const exists = this.events.some(event => event.url === this.itemid)
        return exists ? 'has-event' : null
      }
    },
    async created() {
      this.events = await list(`${localStorage.me}/events`)
    },
    methods: {
      on_click() {
        this.$emit('picker', {
          picker: true,
          itemid: this.itemid
        })
      }
    }
  }
</script>

<template>
  <a class="event" @click="on_click">
    <svg viewBox="0 0 150 150" :class="has_event" class="icon">
      <use :href="date_picker_icon" />
      <text class="month" x="57" y="24" text-anchor="middle">{{ month }}</text>
      <text x="57" y="84" text-anchor="middle">{{ day }}</text>
    </svg>
  </a>
</template>

<style lang="stylus">
  a.event
    position: relative
    & > svg
      width: base-line * 1.75
      height: base-line * 1.75
      &.has-event
        fill: red !important
        text
          color: #fff
          fill: #fff
      text
        fill: white
        font-size: base-line * 2
      text.month
        font-size: base-line * .5
        font-weight: 300
        letter-spacing: .02em
        fill: #fff
      rect, path
        stroke: darken(black, 5%)
        stroke-width: 0.5px
</style>
