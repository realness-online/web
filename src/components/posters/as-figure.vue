<template lang="html">
  <figure itemscope itemtype="/posters" :itemid="poster.id" v-bind:class="selecting">
    <svg @click="svg_click" :preserveAspectRatio="aspect_ratio"
         :viewBox="poster.view_box" v-html="poster.path">
    </svg>
    <figcaption>
      <meta itemprop="view_box" :content="poster.view_box">
      <meta itemprop="created_at" :content="poster.created_at">
      <meta itemprop="created_by" :content="author.id">
      <input id="event-day" type="date" required
             ref="day"
             :value="event_day"
             @click="manage_event"
             @input="update_date">
      <fieldset v-if="show_event">
        <label for="event-day">{{event_label}}</label>
        <input id="event-time" type="time" :value="event_time" ref="time" required>
        <menu>
          <a @:click="remove_event"><icon name="remove"></icon></a>
          <a @:click="save_event"><icon name="add"></icon></a>
        </menu>
      </fieldset>
      <menu v-if="menu">
        <a id="create-event" v-if="!is_new">
          <svg viewBox="0 0 150 150" v-bind:class="has_date">
            <rect x="1" y="1" rx="8" width="114" height="114" />
            <text class="month" x="57" y="24" text-anchor="middle">{{month}}</text>
            <text x="57" y="84" text-anchor="middle">{{day}}</text>
            <path d="M130.019 110.44H117.56V97.9805C117.56 97.0364 117.185 96.131 116.517 95.4635C115.85 94.7959 114.944 94.4209 114 94.4209C113.056 94.4209 112.151 94.7959 111.483 95.4635C110.816 96.131 110.441 97.0364 110.441 97.9805V110.44H97.9807C97.0367 110.44 96.1313 110.815 95.4637 111.483C94.7962 112.15 94.4211 113.056 94.4211 114C94.4211 114.944 94.7962 115.849 95.4637 116.517C96.1313 117.184 97.0367 117.559 97.9807 117.559H110.441V130.019C110.441 130.963 110.816 131.869 111.483 132.536C112.151 133.204 113.056 133.579 114 133.579C114.944 133.579 115.85 133.204 116.517 132.536C117.185 131.869 117.56 130.963 117.56 130.019V117.559H130.019C130.964 117.559 131.869 117.184 132.536 116.517C133.204 115.849 133.579 114.944 133.579 114C133.579 113.056 133.204 112.15 132.536 111.483C131.869 110.815 130.964 110.44 130.019 110.44V110.44Z" />
            <path d="M88.5442 88.5442C74.4853 102.603 74.4853 125.397 88.5442 139.456C102.603 153.515 125.397 153.515 139.456 139.456C153.515 125.397 153.515 102.603 139.456 88.5442C125.397 74.4853 102.603 74.4853 88.5442 88.5442ZM134.543 134.544C123.198 145.888 104.802 145.889 93.4566 134.544C82.1109 123.198 82.1109 104.803 93.4566 93.4566C104.802 82.1109 123.198 82.1109 134.543 93.4566C145.889 104.803 145.889 123.198 134.543 134.544Z" />
          </svg>
        </a>
        <a @click="delete_poster">
          <icon v-if="working" name="working"></icon>
          <icon v-else name="remove"></icon>
        </a>
        <a @click="save" v-if="is_new">
          <icon v-if="accept" name="finished"></icon>
          <icon v-else name="working"></icon>
        </a>
        <download-vector :vector="poster" :author="author"></download-vector>
      </menu>
    </figcaption>
  </figure>
</template>
<script>
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
        default: []
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
      this.main_event = this.events.find(event => event.href === poster.id)
      if (!this.main_event) this.main_event = this.tonight
    },
    computed: {
      selecting() {
        return {
          'selecting-date': this.show_event
        }
      },
      has_date() {
        return this.events.some(event => event.href === this.poster.id)? 'has-date' : null
      },
      aspect_ratio() {
        if (this.menu) return `xMidYMid meet`
        else return `xMidYMid slice`
      },
      event_time() {
        let minutes = this.main_event.getMinutes()
        minutes = minutes > 9? minutes : `0${minutes}`
        const time_value = `${this.main_event.getHours()}:${minutes}`
        // console.log('event_time', time_value)
        return time_value
      },
      event_day() {
        // console.log('event_day');
        const year = this.main_event.getFullYear()
        let month = this.main_event.getMonth() + 1
        let day = this.main_event.getDate()

        if (month <= 9) month = `0${month}`
        if (day <= 9) day = `0${day}`

        const day_value = `${year}-${month}-${day}`
        // console.log('day', day_value);
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
        if(this.show_event) this.menu = false
        else this.menu = !this.menu
      },
      update_date(event) {
        const date_list = this.$refs.day.value.split('-')
        const year = parseInt(date_list[0])
        const month = parseInt(date_list[1]) - 1
        const day = parseInt(date_list[2])
        this.main_event = new Date(this.main_event.setFullYear(year, month, day))
      },
      manage_event(event) {
        this.show_event = true
        this.menu = false
      },
      remove_event() {
        this.show_event = false
        this.menu = true
        this.$emit('remove-event', this.main_event)
        this.new_event = null
      },
      save_event() {
        this.show_event = false
        this.menu = true
        const temp_event = this.event_day + this.event_time
        console.log(event)
        if (this.new_event) this.$emit('add-event', temp_event)
      },
      delete_poster() {
        const message = 'Delete poster?'
        if (window.confirm(message)) this.$emit('delete', this.poster.id)
      },
      save() {
        this.$emit('save', this.poster.id)
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
            &.has-date
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
