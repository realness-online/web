<template lang="html">
  <fieldset class="event" :class="state">
    <ol ref="events" itemprop="events" hidden>
      <li itemscope itemtype="/events"
          v-for="event in events"
          :itemid="event.id"
          :key="event.id">
        <link itemprop="url" rel="icon" :href="event.url">
      </li>
    </ol>
    <label for="day">{{event_label}}</label>
    <input id="day" type="date" required
           ref="day"
           :value="event_day"
           @input="update_date"
           @click="show_picker">
    <input type="time" required
           ref="time"
           :value="event_time"
           @input="update_time">
    <menu>
      <a @click="remove"><icon name="remove"></icon></a>
      <a @click="save"><icon name="add"></icon></a>
    </menu>
  </fieldset>
</template>
<script>
  import icon from '@/components/icon'
  import { events_storage } from '@/persistance/Storage'
  export default {
    components: { icon },
    props: {
      menu: {
        type: Boolean,
        required: false,
        default: false
      }
    },
    data () {
      return {
        main_event: null,
        show: false,
        events: events_storage.as_list()
      }
    },
    created () {
      const my_event = this.events.find(event => event.url === this.itemid)
      if (my_event) this.main_event = new Date(parseInt(my_event.id))
      else this.main_event = this.tonight
    },
    computed: {
      state () {
        return { picker: this.show }
      },
      event_time () {
        let minutes = this.main_event.getMinutes()
        minutes = minutes > 9 ? minutes : `0${minutes}`
        const time_value = `${this.main_event.getHours()}:${minutes}`
        return time_value
      },
      event_day () {
        const year = this.main_event.getFullYear()
        let month = this.main_event.getMonth() + 1
        let day = this.main_event.getDate()
        if (month <= 9) month = `0${month}`
        if (day <= 9) day = `0${day}`
        const day_value = `${year}-${month}-${day}`
        return day_value
      },
      event_label () {
        return this.main_event.toLocaleString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        })
      },
      day () {
        return this.main_event.toLocaleString('en-US', { day: 'numeric' })
      },
      month () {
        return this.main_event.toLocaleString('en-US', { month: 'long' })
      },
      tonight () {
        const tonight = new Date()
        tonight.setHours(21)
        tonight.setMinutes(0)
        return tonight
      }
    },
    methods: {
      show_picker () {
        this.show = true
        this.$emit('picker', true)
      },
      async remove () {
        this.show = false
        this.main_event = new Date(this.tonight)
        this.events = this.events.filter(event => event.poster !== this.itemid)
        await this.$nextTick()
        events_storage.save(this.$refs.events)
        this.$emit('picker', false)
      },
      update_date () {
        const date_list = this.find('#day').value.split('-')
        const year = parseInt(date_list[0])
        const month = parseInt(date_list[1]) - 1
        const day = parseInt(date_list[2])
        this.main_event = new Date(this.main_event.setFullYear(year, month, day))
      },
      update_time () {
        const time_list = this.$refs.time.value.split(':')
        const hour = parseInt(time_list[0])
        const minute = parseInt(time_list[1])
        this.main_event = new Date(this.main_event.setHours(hour, minute))
      },
      async save () {
        this.show = false
        if (this.has_event) {
          this.events = this.events.filter(event => event.poster !== this.itemid)
        }
        this.events.push({
          id: this.main_event.getTime(),
          url: this.itemid
        })
        await this.$nextTick()
        events_storage.save(this.$refs.events)
        this.$emit('picker', false)
      }
    }
  }
</script>
<style lang="stylus">
  fieldset.event
    display: flex
    justify-content: space-around
    flex-direction: column
    border: none
    padding: 0
    ol, label, input, menu
      display: none
    input[type="date"]
      display: block
      position: absolute
      top: -(base-line * 3)
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
</style>
<style lang="stylus">
  fieldset.event.picker
    position: relative
    margin-top: -(round(base-line * 10, 2))
    label, input[type="time"], menu
      display: block
    label
      z-index: 2
      cursor: pointer
      text-align: left
      line-height: base-line
      margin: 0 0 base-line base-line
      color: red
      font-weight: 800
      font-size: base-line
    input[type="date"]
      position: static
      width: auto
      height: base-line
      left: base-line
      margin: 0 0 base-line base-line
      @media (min-width: typing-begins)
        top: base-line
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
    input[type="time"]
      height: base-line
      margin-left: base-line
      padding: 0
      line-height: 1
      z-index: 3
      cursor: pointer
      color:red
      font-weight: 900
      margin-bottom: base-line
    menu
      padding: base-line
      display: flex
      justify-content: space-between
      width: 100%
      z-index: 4
      svg
        fill:red
</style>
