<script setup>
  import icon from '@/components/icon'
  import { list } from '@/utils/itemid'

  import { Event } from '@/persistance/Storage'
  import { ref, computed, onMounted, nextTick } from 'vue'

  const props = defineProps({
    itemid: {
      type: String,
      required: true
    }
  })

  const emit = defineEmits(['picker'])

  defineOptions({
    name: 'EventsFieldset'
  })

  const main_event = ref(null)
  const events = ref([])
  const show = ref(false)
  const day = ref(null)
  const time = ref(null)
  const events_ref = ref(null)

  const tonight = computed(() => {
    const tonight = new Date()
    tonight.setHours(21)
    tonight.setMinutes(0)
    return tonight
  })

  const event_time = computed(() => {
    if (!main_event.value) return ''
    let minutes = main_event.value.getMinutes()
    minutes = minutes > 9 ? minutes : `0${minutes}`
    const time_value = `${main_event.value.getHours()}:${minutes}`
    return time_value
  })

  const event_day = computed(() => {
    if (!main_event.value) return ''
    const year = main_event.value.getFullYear()
    let month = main_event.value.getMonth() + 1
    let day_val = main_event.value.getDate()
    if (month <= 9) month = `0${month}`
    if (day_val <= 9) day_val = `0${day_val}`
    const day_value = `${year}-${month}-${day_val}`
    return day_value
  })

  const event_label = computed(() => {
    if (!main_event.value) return ''
    return main_event.value.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    })
  })

  const events_id = () => `${localStorage.me}/events`

  const save = async () => {
    show.value = false
    events.value = events.value.filter(event => event.url !== props.itemid)
    events.value.push({
      id: main_event.value.getTime(),
      url: props.itemid
    })
    await nextTick()
    new Event().save(events_ref.value.$el)
    emit('picker', {
      picker: false,
      itemid: props.itemid
    })
  }

  const remove = async () => {
    show.value = false
    main_event.value = new Date(tonight.value)
    events.value = events.value.filter(event => event.url !== props.itemid)
    await nextTick()
    new Event().save(events_ref.value.$el)
    emit('picker', {
      picker: false,
      itemid: props.itemid
    })
  }

  const update_date = () => {
    const date_list = day.value.value.split('-')
    const year = parseInt(date_list[0])
    const month = parseInt(date_list[1]) - 1
    const day_val = parseInt(date_list[2])
    main_event.value = new Date(
      main_event.value.setFullYear(year, month, day_val)
    )
  }

  const update_time = () => {
    const time_list = time.value.value.split(':')
    const hour = parseInt(time_list[0])
    const minute = parseInt(time_list[1])
    main_event.value = new Date(main_event.value.setHours(hour, minute))
  }

  onMounted(async () => {
    main_event.value = tonight.value
    events.value = await list(`${localStorage.me}/events`)
    const my_event = events.value.find(event => event.url === props.itemid)
    if (my_event) main_event.value = new Date(parseInt(my_event.id))
  })
</script>

<template>
  <fieldset class="event">
    <events-list ref="events_ref" :events="events" :itemid="events_id()" />
    <label for="day">{{ event_label }}</label>
    <input
      id="day"
      ref="day"
      type="date"
      required
      :value="event_day"
      @input="update_date" />
    <input
      ref="time"
      type="time"
      required
      :value="event_time"
      @input="update_time" />
    <menu>
      <a @click="remove"><icon name="remove" /></a>
      <a @click="save"><icon name="add" /></a>
    </menu>
  </fieldset>
</template>

<style lang="stylus">
  fieldset.event
    display: flex
    justify-content:flex-end
    flex-direction: column
    border: none
    padding: 0
    position: absolute
    top: 0; bottom: 0; left: 0; right: 0;
    z-index:2
    label
      z-index: 2
      cursor: pointer
      text-align: left
      line-height: base-line
      margin: 0 0 base-line base-line
      color: green
      font-weight: 800
      font-size: base-line
    input
      width: base-line * 8
      &::-webkit-calendar-picker-indicator
        visibility: hidden
      &:focus
        outline: .11em dotted green
        &::-webkit-calendar-picker-indicator
          padding-top: 3px
          visibility: visible
    input[type="date"]
      display: block
      color: transparent
      z-index: 1
      font-weight: 800
      position: static
      height: base-line
      left: base-line
      top: base-line
      color: green
      margin: 0 0 base-line base-line
      &::-webkit-datetime-edit-fields-wrapper
      &::-webkit-datetime-edit-text
      &::-webkit-datetime-edit-month-field
      &::-webkit-datetime-edit-day-field
      &::-webkit-datetime-edit-year-field
        display:inline-block
        color: green
        fill: green
        font-weight: 800
        font-family: Lato
    input[type="time"]
      height: base-line
      margin-left: base-line
      padding: 0
      line-height: 1
      z-index: 3
      cursor: pointer
      color: green
      font-weight: 800
      margin-bottom: base-line
    menu
      padding: base-line
      display: flex
      justify-content: space-between
      width: 100%
      z-index: 4
      svg
        fill: green
</style>
