<script setup>
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
    }
  })
  const preference = preferences[props.name]
  const toggle = () => (preference.value = !preference.value)
</script>

<template>
  <fieldset class="preference">
    <div>
      <h3>{{ name }}</h3>
      <label class="switch">
        <input v-model="preference" type="checkbox" @click="toggle" />
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
    & > p:last-of-type
      margin-bottom: 0
    & > div
      display: flex
      justify-content: space-between
      h3
        text-transform: capitalize
        display: inline-block
        line-height: 1
        margin: 0 0 base-line 0
        padding: 0
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
