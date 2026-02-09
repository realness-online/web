<script setup>
  import { computed } from 'vue'
  import * as preferences from '@/utils/preference'
  const props = defineProps({
    name: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: false
    },
    subtitle: {
      type: String,
      required: false
    },
    show_state: {
      type: Boolean,
      required: false,
      default: false
    }
  })
  const preference = preferences[props.name]
  const state_text = computed(() => {
    if (!props.show_state) return ''
    return preference.value ? ' (on)' : ' (off)'
  })
  const toggle = () => {
    const new_state = !preference.value
    preference.value = new_state

    // Special logic: when turning cutout ON, enable all geology layers
    if (props.name === 'cutout' && new_state) {
      preferences.boulders.value = true
      preferences.rocks.value = true
      preferences.gravel.value = true
      preferences.sand.value = true
      preferences.sediment.value = true
    }

    // Special logic: when turning fill ON, enable all shadow layers
    if (props.name === 'fill' && new_state) {
      preferences.bold.value = true
      preferences.medium.value = true
      preferences.regular.value = true
      preferences.light.value = true
      preferences.background.value = true
    }

    // Special logic: when toggling drama, sync drama_back and drama_front
    if (props.name === 'drama') {
      preferences.drama_back.value = new_state
      preferences.drama_front.value = new_state
    }
  }
</script>

<template>
  <fieldset class="preference">
    <div>
      <h4>{{ name }}{{ state_text }}</h4>
      <label class="switch">
        <input
          :checked="preference"
          :name="name"
          type="checkbox"
          @click="toggle" />
        <span class="slider"></span>
      </label>
    </div>
    <p v-if="title">{{ title }}</p>
    <p v-if="subtitle">{{ subtitle }}</p>
    <slot />
  </fieldset>
</template>

<style lang="stylus">
  fieldset.preference
    margin-bottom: base-line
    & > div
      display: flex
      justify-content: space-between
      h4
        text-transform: capitalize
        display: inline-block
        line-height: 1
        margin: 0 0 base-line 0
        padding: 0
        font-size: normal;
      & > label.switch
        position: relative
        display: inline-block
        width: base-line * 3
        height: base-line * 1.5
        & > input
          opacity: 0
          width: 0
          height: 0
          &:checked + .slider
            background-color: green
          &:focus + .slider
            box-shadow: 0 0 1px red
          &:checked + .slider:before
            transform: translateX(base-line * 1.4)
        .slider
          border-radius: base-line * 2
          position: absolute
          cursor: pointer
          top: 0
          left: 0
          right: 0
          bottom: 0
          background-color: black
          -webkit-transition: .4s
          transition: .4s
          &:before
            border-radius: 50%
            position: absolute
            content: ""
            height: base-line * 1.2
            width: base-line * 1.2
            left: base-line * 0.2
            bottom: base-line * 0.15
            background-color: white
            opacity: 0.75
            -webkit-transition: .4s
            transition: .4s
</style>
