<template lang="html">
  <figure class="poster" :class="selecting">
    <as-svg @vector-click="vector_click" :itemid="itemid"></as-svg>
    <figcaption>
      <input v-if="show_date_picker" id="day" type="date" required
             ref="day"
             :value="event_day"
             @click="manage_event"
             @input="update_date">
      <event-as-fieldset v-if="show_event"
                         :selecting="show_date_picker"
                         @save="save_event"
                         @remove="remove_event"></event-as-fieldset>
      <poster-menu v-if="menu" poster="poster"></poster-menu>
    </figcaption>
  </figure>
</template>
<script>
  import as_svg from '@/components/posters/as-svg'
  import as_menu from '@/components/posters/as-menu'
  import event_as_fieldset from '@/components/events/as-fieldset'
  export default {
    components: {
      'as-svg': as_svg,
      'poster-menu': as_menu,
      'event-as-fieldset': event_as_fieldset
    },
    props: {
      itemid: {
        type: String,
        required: true
      },
      poster: {
        type: Object,
        required: false,
        default: null
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
      },
      events: {
        type: Array,
        required: false,
        default: () => []
      }
    },
    data () {
      return {
        menu: false,
        accept: true,
        show_event: false
      }
    },
    created () {
      if (this.is_new) this.menu = true
    },
    computed: {
      show_date_picker () {
        if ((this.menu || this.show_event) && this.is_new === false) return true
        else return false
      },
      selecting () {
        return {
          'selecting-date': this.show_event
        }
      },
      has_event () {
        const exists = this.events.some(event => event.url === this.itemid)
        return exists ? 'has-event' : null
      }
    },
    methods: {
      vector_click () {
        if (this.show_event) this.menu = false
        else this.menu = !this.menu
      },
      remove_poster () {
        const message = 'Delete poster?'
        if (window.confirm(message)) this.$emit('remove-poster', this.itemid)
      },
      add_poster () {
        this.show_event = false
        this.menu = false
        this.$emit('add-poster', this.itemid)
      },
      manage_event () {
        this.show_event = true
        this.menu = false
      },
      remove_event () {
        this.show_event = false
        this.menu = true
        this.$emit('remove-event', this.itemid)
      },
      save_event (event_at) {
        this.show_event = false
        this.menu = true
        const new_event = {
          id: event_at,
          url: this.itemid
        }
        if (this.has_event) this.$emit('remove-event', this.itemid)
        this.$emit('add-event', new_event)
      }
    }
  }
</script>
<style lang="stylus">
  figure.poster
    position: relative
    @media (min-width: pad-begins)
      &:first-of-type:not(.new) // how to handle the first poster on a desktop
        max-width: 50vw
    &.selecting-date
      & > svg
        opacity: 0.1
      & > figcaption
        & > input[type="date"]
          width: auto
          height: base-line
          left: base-line
          @media (min-width: typing-begins)
            top: base-line * 2
            &::-webkit-datetime-edit-fields-wrapper
            &::-webkit-datetime-edit-text
            &::-webkit-datetime-edit-month-field
            &::-webkit-datetime-edit-day-field
            &::-webkit-datetime-edit-year-field
            &::-webkit-calendar-picker-indicator
              display:inline-block
              color: red
              font-weight: 800
              font-family: Lato
        & > menu
          width: 100%
          z-index: 4
          display: flex
          justify-content: space-between
          & > a > svg
            fill: red
            &.add
              fill: blue
    & > figcaption
      position: relative
      & > input[type="date"]
        position: absolute
        top: base-line
        left: s('calc( 50% - %s)', base-line)
        color: transparent
        z-index: 1
        width: base-line * 2
        height: base-line * 2
        &::-webkit-date-edit
        &::-webkit-datetime-edit-fields-wrapper
        &::-webkit-datetime-edit-text
        &::-webkit-datetime-edit-month-field
        &::-webkit-datetime-edit-day-field
        &::-webkit-datetime-edit-year-field
        &::-webkit-inner-spin-button
        &::-webkit-calendar-picker-indicator
          display: none
      & > menu
        padding: base-line
        margin-top: -(base-line * 4)
        display: flex
        justify-content: space-between
        a#create-event
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
        svg
          fill: red
          &.finished
            fill: blue
</style>
