<template lang="html">
  <menu>
    <a @click="$emit('remove-poster')">
      <icon v-if="working" name="working" />
      <icon v-else name="remove" />
    </a>
    <a v-if="!is_new" id="create-event">
      <svg viewBox="0 0 150 150" :class="has_event">
        <use :href="date_picker_icon" />
        <text class="month" x="57" y="24" text-anchor="middle">{{ month }}</text>
        <text x="57" y="84" text-anchor="middle">{{ day }}</text>
      </svg>
    </a>
    <a v-if="is_new" @click="$emit('add-poster')">
      <icon v-if="accept" name="finished" />
      <icon v-else name="working" />
    </a>
    <download-vector v-if="!is_new" :itemid="itemid" />
  </menu>
</template>
<script>
  import icon from '@/components/icon'
  import icons from '@/icons.svg'
  import { as_created_at, list } from '@/helpers/itemid'
  import download_vector from '@/components/download-vector'
  export default {
    components: {
      icon,
      'download-vector': download_vector
    },
    props: {
      itemid: {
        type: String,
        required: true
      },
      working: {
        type: Boolean,
        required: false,
        default: false
      },
      is_new: {
        type: Boolean,
        required: false,
        default: false
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
          const event_at = as_created_at(event.id)
          return new Date(event_at).toLocaleString('en-US', { day: 'numeric' })
        } else return new Date().toLocaleString('en-US', { day: 'numeric' })
      },
      month () {
        const event = this.events.find(event => event.url === this.itemid)
        if (event) {
          const event_at = as_created_at(event.id)
          return new Date(event_at).toLocaleString('en-US', { month: 'long' })
        } else return new Date().toLocaleString('en-US', { month: 'long' })
      },
      has_event () {
        const exists = this.events.some(event => event.url === this.itemid)
        return exists ? 'has-event' : null
      }
    },
    async created () {
      this.events = await list(`${this.me}/events`)
    }
  }
</script>
<style lang="stylus">
  figure.poster
    & > figcaption > menu
      padding: base-line
      margin-top: -(base-line * 4)
      display: flex
      justify-content: space-between
      width: 100%
      z-index: 4
      & > a#create-event
        position: relative
        svg
          &.has-event
            fill: blue
          text
            fill: white
            font-size: base-line * 2
          text.month
            font-size: (base-line / 2)
            font-weight: 900
          rect, path
            stroke: darken(black, 5%)
            stroke-width: 0.5px
      & > a > svg
        fill: red
        &.finished
        &.add
          fill: blue
</style>
