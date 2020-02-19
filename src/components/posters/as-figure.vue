<template lang="html">
  <figure itemscope itemtype="/posters" :itemid="poster.id" :class="selecting">
    <svg @click="svg_click" :preserveAspectRatio="aspect_ratio"
         :viewBox="poster.view_box" v-html="poster.path">
    </svg>
    <figcaption>
      <meta itemprop="view_box" :content="poster.view_box">
      <meta itemprop="created_at" :content="poster.created_at">
      <meta itemprop="created_by" :content="author.id">
      <input id="day" type="date" required
             ref="day"
             v-if="show_date_picker"
             :value="event_day"
             @click="manage_event"
             @input="update_date">
      <fieldset v-if="show_event">
        <label for="day">{{event_label}}</label>
        <input type="time" required
               :value="event_time"
               ref="time"
               @input="update_time">
        <menu>
          <a @click="remove_event"><icon name="remove"></icon></a>
          <a @click="save_event"><icon name="add"></icon></a>
        </menu>
      </fieldset>
      <menu v-if="menu">
        <a id="create-event" v-if="!is_new">
          <svg viewBox="0 0 150 150" :class="has_event">
            <use :href="date_picker_icon"/>
            <text class="month" x="57" y="24" text-anchor="middle">{{month}}</text>
            <text x="57" y="84" text-anchor="middle">{{day}}</text>
          </svg>
        </a>
        <a @click="remove_poster">
          <icon v-if="working" name="working"></icon>
          <icon v-else name="remove"></icon>
        </a>
        <a @click="add_poster" v-if="is_new">
          <icon v-if="accept" name="finished"></icon>
          <icon v-else name="working"></icon>
        </a>
        <download-vector :vector="poster" :author="author" v-if="!is_new"></download-vector>
      </menu>
    </figcaption>
  </figure>
</template>
<script>
  import icons from '@/icons.svg'
  import icon from '@/components/icon'
  import download_vector from '@/components/download-vector'
  export default {
    components: {
      'download-vector': download_vector,
      icon
    },
    props: {
      poster: {
        type: Object,
        required: true
      },
      author: {
        type: Object,
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
      },
      events: {
        type: Array,
        required: false,
        default: () => []
      }
    },
    data() {
      return {
        menu: false,
        accept: true,
        show_event: false,
        main_event: null
      }
    },
    created() {
      if (this.is_new) this.menu = true
      const my_event = this.events.find(event => event.poster === this.poster.id)
      if (my_event) this.main_event = new Date(parseInt(my_event.id))
      else this.main_event = this.tonight
    },
    computed: {
      date_picker_icon() {
        return `${icons}#date-picker`
      },
      show_date_picker() {
        if (this.menu || this.show_event && this.is_new === false) return true
        else return false
      },
      selecting() {
        return {
          'selecting-date': this.show_event
        }
      },
      has_event() {
        const exists = this.events.some(event => event.poster === this.poster.id)
        return exists ? 'has-event' : null
      },
      aspect_ratio() {
        if (this.menu) return 'xMidYMid meet'
        else return 'xMidYMid slice'
      },
      event_time() {
        let minutes = this.main_event.getMinutes()
        minutes = minutes > 9 ? minutes : `0${minutes}`
        const time_value = `${this.main_event.getHours()}:${minutes}`
        return time_value
      },
      event_day() {
        const year = this.main_event.getFullYear()
        let month = this.main_event.getMonth() + 1
        let day = this.main_event.getDate()
        if (month <= 9) month = `0${month}`
        if (day <= 9) day = `0${day}`
        const day_value = `${year}-${month}-${day}`
        return day_value
      },
      event_label() {
        return this.main_event.toLocaleString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        })
      },
      day() {
        return this.main_event.toLocaleString('en-US', { day: 'numeric' })
      },
      month() {
        return this.main_event.toLocaleString('en-US', { month: 'long' })
      },
      tonight() {
        const tonight = new Date()
        tonight.setHours(21)
        tonight.setMinutes(0)
        return tonight
      }
    },
    methods: {
      svg_click() {
        if (this.show_event) this.menu = false
        else this.menu = !this.menu
      },
      remove_poster() {
        const message = 'Delete poster?'
        if (window.confirm(message)) this.$emit('remove-poster', this.poster.id)
      },
      add_poster() {
        this.show_event = false
        this.menu = false
        this.$emit('add-poster', this.poster.id)
      },
      manage_event() {
        this.show_event = true
        this.menu = false
      },
      remove_event() {
        this.show_event = false
        this.menu = true
        this.main_event = new Date(this.tonight)
        this.$emit('remove-event', this.poster.id)
      },
      save_event() {
        this.show_event = false
        this.menu = true
        const new_event = {
          id: this.main_event.getTime(),
          poster: this.poster.id
        }
        if (this.has_event) this.$emit('remove-event', this.poster.id)
        this.$emit('add-event', new_event)
      },
      update_date() {
        const date_list = this.$refs.day.value.split('-')
        const year = parseInt(date_list[0])
        const month = parseInt(date_list[1]) - 1
        const day = parseInt(date_list[2])
        this.main_event = new Date(this.main_event.setFullYear(year, month, day))
      },
      update_time() {
        const time_list = this.$refs.time.value.split(':')
        const hour = parseInt(time_list[0])
        const minute = parseInt(time_list[1])
        this.main_event = new Date(this.main_event.setHours(hour, minute))
      }
    }
  }
</script>
<style lang="stylus">
  figure[itemtype="/posters"]
    overflow: hidden;
    position: relative
    background: green
    @media (min-width: min-screen)
      &:first-of-type:not(.new) // how to handle the first poster on a desktop
        max-width: 50vw
    &.selecting-date
      & > svg
        opacity: 0.1
      & > figcaption > input[type="date"]
        width: auto
        height: base-line
        @media (min-width: mid-screen)
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
      & > figcaption > fieldset
        margin-top: -(round(base-line * 10, 2))
        & > label
          z-index: 2
          cursor: pointer
          text-align: ceter
          display: block
          line-height: base-line
          margin-bottom: base-line
          color: red
          font-weight: 800
          font-size: base-line
        & > input
          height: base-line
          padding: 0
          line-height: 1
          z-index: 3
          cursor: pointer
          color:red
          font-weight: 900
          margin-bottom: base-line * 3
        & > menu
          width: 100%
          z-index: 4
          display: flex
          justify-content: space-between
          & > a > svg
            fill: red
            &.add
              fill: blue
    & > svg
      width: 100%
      height: 100vh
      max-height: page-width
    & > figcaption
      position: relative
      & > input[type="date"]
        position: absolute
        top: base-line
        left: base-line
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
      & > fieldset
        padding: base-line
        display: flex
        justify-content: space-around
        flex-direction: column
        border:none
        padding: base-line
        border: none
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
