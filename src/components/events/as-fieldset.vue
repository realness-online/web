<template lang="html">
  <fieldset class="event">
    <label for="day">{{event_label}}</label>
    <input type="time" required :value="event_time" ref="time" @input="update_time">
    <menu>
      <a @click="remove"><icon name="remove"></icon></a>
      <a @click="emit('save', this.main_event.getTime())">
        <icon name="add"></icon>
      </a>
    </menu>
  </fieldset>
</template>
<script>
  import icon from '@/components/icon'
  export default {
    components: [icon],
    data () {
      return {
        main_event: null
      }
    },
    created () {
      const my_event = this.events.find(event => event.url === this.itemid)
      if (my_event) this.main_event = new Date(parseInt(my_event.id))
      else this.main_event = this.tonight
    },
    computed: {
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
      remove () {
        this.emit('remove')
        this.main_event = new Date(this.tonight)
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
      }
    }
  }
</script>
<style lang="stylus">
  fieldset.event
    padding: base-line
    display: flex
    justify-content: space-around
    flex-direction: column
    border:none
    padding: base-line
    border: none
    &.selecting
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
</style>
