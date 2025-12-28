<script setup>
  import icons from '/icons.svg'
  import { list } from '@/utils/itemid'
  import { ref, computed, onMounted } from 'vue'

  const props = defineProps({
    itemid: {
      type: String,
      required: true
    },
    event: {
      type: Object,
      required: false
    }
  })

  const emit = defineEmits(['picker', 'click'])

  const events = ref([])

  const date_picker_icon = computed(() => `${icons}#date-picker`)

  const day = computed(() => {
    // If event prop is provided, use it directly
    if (props.event) {
      const when = new Date(props.event.date || props.event.id)
      return when.toLocaleString('en-US', { day: 'numeric' })
    }

    const found_event = events.value.find(event => event.url === props.itemid)
    if (found_event) {
      const when = new Date(parseInt(found_event.id))
      return when.toLocaleString('en-US', { day: 'numeric' })
    }
    return new Date().toLocaleString('en-US', { day: 'numeric' })
  })

  const month = computed(() => {
    // If event prop is provided, use it directly
    if (props.event) {
      const when = new Date(props.event.date || props.event.id)
      return when.toLocaleString('en-US', { month: 'long' })
    }

    const found_event = events.value.find(event => event.url === props.itemid)
    if (found_event) {
      const when = new Date(parseInt(found_event.id))
      return when.toLocaleString('en-US', { month: 'long' })
    }
    return new Date().toLocaleString('en-US', { month: 'long' })
  })

  const has_event = computed(() => {
    if (props.event) return 'has-event'
    const exists = events.value.some(event => event.url === props.itemid)
    return exists ? 'has-event' : null
  })

  const event_title = computed(() => {
    if (props.event) return props.event.title
    const found_event = events.value.find(event => event.url === props.itemid)
    return found_event?.title || ''
  })

  onMounted(async () => {
    if (localStorage.me) events.value = await list(`${localStorage.me}/events`)
  })

  const on_click = () => {
    emit('picker', {
      picker: true,
      itemid: props.itemid
    })
    emit('click')
  }
</script>

<template>
  <button class="event" @click="on_click">
    <svg viewBox="0 0 150 150" :class="has_event" class="icon">
      <use :href="date_picker_icon" />
      <text class="month" x="57" y="24" text-anchor="middle">{{ month }}</text>
      <text x="57" y="84" text-anchor="middle">{{ day }}</text>
    </svg>
    <span v-if="event_title" class="event-title">{{ event_title }}</span>
  </button>
</template>

<style lang="stylus">
  button.event
    position: absolute
    z-index: 2;
    border: none;
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
