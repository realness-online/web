<template>
  <figure id="edit-fill" ref="figure">
    <as-svg
      :itemid="itemid"
      :immediate="true"
      :optimize="true"
      :slice="false"
      :tabable="true"
      tabindex="-1"
      @focus="set_input_color" />
    <figcaption>
      <input
        id="opacity"
        v-model="opacity_percentage"
        :disabled="!has_opacity"
        type="range"
        name="opacity"
        tabindex="-1"
        min="0.010"
        max="0.996"
        step="0.013" />
      <output :value="opacity_percentage" for="opacity" />
      <h4>{{ selected_path }}</h4>
      <menu>
        <as-svg
          :itemid="itemid"
          :immediate="true"
          :slice="true"
          :toggle_aspect="false"
          tabindex="-1"
          @click="toggle_stroke" />
        <input
          id="color-input"
          v-model="color"
          type="color"
          tabindex="-1"
          @blur="focus_on_active" />
        <icon name="circle" :fill="fragment('horizontal-gradient')" />
        <icon name="circle" :fill="fragment('vertical-gradient')" />
        <icon
          class="selected"
          name="circle"
          :fill="fragment('radial-gradient')" />
      </menu>
    </figcaption>
  </figure>
</template>
<script setup>
  import Icon from '@/components/icon'
  import AsSvg from '@/components/posters/as-svg'
  import { ref, provide } from 'vue'
  import {
    whenever,
    useMagicKeys as keyboard,
    usePointerSwipe as swipe
  } from '@vueuse/core'
  import { use as use_path, itemprop_query as query } from '@/use/path'
  import { is_vector_id, is_vector } from '@/use/vector'
  import { to_hex as to_hex, to_complimentary_hsl } from '@/use/colors'
  import { as_fragment_id } from '@/use/itemid'
  const has_opacity = ref(false)
  const props = defineProps({
    itemid: {
      required: true,
      type: String,
      validator: is_vector_id
    }
  })
  const emit = defineEmits({ toggle: () => true, loaded: is_vector })
  const figure = ref(null)
  const color = ref('#151518')
  const itemprop = ref('background')
  const as_stroke = ref(false)
  const fragment = add => {
    return `url(${as_fragment_id(props.itemid)}-${add})`
  }
  provide('as_stroke', as_stroke)
  const {
    opacity_percentage,
    selected_path,
    fill_opacity: opacity,
    color_luminosity: luminosity
  } = use_path()
  const focus_on_active = () => query(itemprop.value).focus()
  const set_input_color = id => {
    if (id === 'background') has_opacity.value = false
    else has_opacity.value = true
    itemprop.value = id
    const path = query(id)
    if (as_stroke.value) color.value = to_hex(path.style.color)
    else {
      const fill = path.style.fill
      if (fill) color.value = to_hex(fill)
      else color.value = to_hex()
    }
  }
  const toggle_stroke = () => {
    as_stroke.value = !as_stroke.value
    const path = query(itemprop.value)
    if (as_stroke.value) color.value = to_hex(path.style.color)
    else color.value = to_hex(path.style.fill)
    emit('toggle')
  }
  const { distanceY: distance_y } = swipe(figure, {
    onSwipe() {
      if (as_stroke.value) luminosity(-1 * (distance_y.value / 3))
      else opacity(-1 * (distance_y.value / 300))
    }
  })
  const keys = keyboard()
  whenever(keys.s, () => toggle_stroke())
  whenever(keys.up, () => {
    if (as_stroke.value) luminosity(4)
    else opacity(0.08)
  })
  whenever(keys.down, () => {
    if (as_stroke.value) luminosity(-4)
    else opacity(-0.08)
  })
  whenever(color, () => {
    const path = query(itemprop.value)
    if (as_stroke.value) path.style.color = color.value
    else {
      const current_fill = path.style.fill
      if (to_hex(current_fill) !== color.value) {
        const compliment = to_complimentary_hsl(color.value)
        path.style.fill = color.value
        path.style.color = compliment.color
      }
    }
  })
</script>
<style lang="stylus">
  figure#edit-fill
    & > svg
      position: fixed
      z-index: 0
      top: 0
      bottom: 0
      left: 0
      right: 0
      @media (orientation: landscape) and (max-height: page-width)
        max-height: 100vh
        min-height: inherit
    & > figcaption
      position: fixed
      bottom: base-line * 4
      z-index: 2
      display: flex
      & > h4
        color: red
        margin: 0
        text-shadow: 1px 1px 1.25px black-background
        text-transform: capitalize
        transform: translate(-5rem, -1rem)
      & > input
        transform: rotate(-90deg)
        transform-origin: bottom
        margin-left: base-line * 0.333
        margin-bottom: 2rem
        border: 3px solid red
        border-radius: base-line * 0.25
        padding: base-line * 0.25
        width: base-line * 4
        &[disabled]
          opacity:0.5
      & > output
        color:red
        width: 3rem
        height: 2rem
        transform: translate(-2rem, 1rem)
        transform-origin: top
        text-shadow: 1px 1px 1.25px black-background
      & > menu
        background-color: black-transparent
        position: fixed
        padding: base-line
        bottom: 0
        left: 0
        right: 0
        display: flex
        justify-content: space-between
        & > svg
          cursor: pointer
          width: base-line * 1.5
          height: base-line * 1.5
          min-height: auto
          border-radius: 2rem
          @media (min-width: pad-begins)
            bottom: inset(bottom,  base-line * 4.5)
          &.selected
            border: 3px solid green
        & > input[type="color"]
          width: base-line * 1.5
          height: base-line * 1.5
          &::-moz-color-swatch
            border: 3px solid black
            border-radius: base-line
          &::-webkit-color-swatch
            border: 3px solid black
            border-radius: base-line
          &::-webkit-color-swatch-wrapper
            padding: 0
          &.selected
            &::-moz-color-swatch
                border-color: green
            &::-webkit-color-swatch
                border-color: green
</style>
