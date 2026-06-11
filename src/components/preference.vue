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
    label: {
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
    },
    compact: {
      type: Boolean,
      default: false
    }
  })
  const preference = preferences[props.name]
  const state_text = computed(() => {
    if (!props.show_state) return ''
    return preference.value ? ' (on)' : ' (off)'
  })
  const apply = new_state => {
    preference.value = new_state

    if (props.name === 'mosaic' && new_state)
      preferences.enable_geology_layers()

    if (props.name === 'shadow' && new_state) preferences.enable_shadow_layers()

    if (props.name === 'drama') {
      preferences.drama_back.value = new_state
      preferences.drama_front.value = new_state
    }
  }

  const on_change = event => apply(event.target.checked)
</script>

<template>
  <fieldset class="preference" :class="{ compact }">
    <div>
      <h4 :class="{ labeled: label }">{{ label || name }}{{ state_text }}</h4>
      <label class="switch">
        <input
          :checked="preference"
          :name="name"
          role="switch"
          type="checkbox"
          switch
          @change="on_change" />
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
    &.compact
      border: none
      padding: 0
      margin-bottom: 0
      min-width: 0
      & > div
        gap: base-line * 0.5
        align-items: center
        & > label.switch
          width: base-line * 2.25
          height: base-line * 1.25
          flex-shrink: 0
          & > input:checked + .slider:before
            transform: translateX(base-line * 1.05)
          .slider:before
            height: base-line
            width: base-line
            left: base-line * 0.125
            bottom: base-line * 0.125
    & > div
      display: flex
      justify-content: space-between
      h4
        text-transform: capitalize
        &.labeled
          text-transform: none
        display: inline-block
        line-height: 1
        padding: 0
        font-size: normal;
        margin: 0 0 base-line 0
        .compact > div > &
          margin: 0
          font-size: smaller
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
            background-color: blue
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
    a
      color: blue
      border-color: blue
</style>
