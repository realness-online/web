<template lang="html">
  <figure itemscope itemtype="/posters" :itemid="poster.id" :class="selecting">
    <as-svg @vector-click="vector_click"></as-svg>
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
        <a @click="remove_poster">
          <icon v-if="working" name="working"></icon>
          <icon v-else name="remove"></icon>
        </a>
        <a id="create-event" v-if="!is_new">
          <svg viewBox="0 0 150 150" :class="has_event">
            <use :href="date_picker_icon"/>
            <text class="month" x="57" y="24" text-anchor="middle">{{month}}</text>
            <text x="57" y="84" text-anchor="middle">{{day}}</text>
          </svg>
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
  import as_svg from '@/components/posters/as-svg'
  import download_vector from '@/components/download-vector'
  import vector_click from '@/mixins/vector_click'
  export default {
    mixins: [vector_click],
    components: {
      'download-vector': download_vector,
      'as-svg': as_svg,
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
      const my_event = this.events.find(event => event.url === this.url)
      if (my_event) this.main_event = new Date(parseInt(my_event.id))
      else this.main_event = this.tonight
    },
    computed: {
      url() {
        return `${this.author.id}/${this.poster.id}`
      },
      date_picker_icon() {
        return `${icons}#date-picker`
      },
      show_date_picker() {
        if ((this.menu || this.show_event) && this.is_new === false) return true
        else return false
      },
      selecting() {
        return {
          'selecting-date': this.show_event
        }
      },
      has_event() {
        const exists = this.events.some(event => event.url === this.url)
        return exists ? 'has-event' : null
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
      vector_click() {
        if (this.show_event) this.menu = false
        else this.menu = !this.menu
      },
      remove_poster() {
        const message = 'Delete poster?'
        if (window.confirm(message)) this.$emit('remove-poster', this.url)
      },
      add_poster() {
        this.show_event = false
        this.menu = false
        this.$emit('add-poster', this.url)
      },
      manage_event() {
        this.show_event = true
        this.menu = false
      },
      remove_event() {
        this.show_event = false
        this.menu = true
        this.main_event = new Date(this.tonight)
        this.$emit('remove-event', this.url)
      },
      save_event() {
        this.show_event = false
        this.menu = true
        const new_event = {
          id: this.main_event.getTime(),
          url: this.url
        }
        if (this.has_event) this.$emit('remove-event', this.url)
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
    position: relative
    @media (min-width: pad-begins)
      &:first-of-type:not(.new) // how to handle the first poster on a desktop
        max-width: 50vw
    &.selecting-date
      & > svg
        opacity: 0.1
      & > figcaption > input[type="date"]
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
