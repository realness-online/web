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
      <label for="color-input">{{ selected_path }}</label>
      <label for="color-input">{{ opacity_percentage }}</label>
    </figcaption>
  </figure>
</template>
<script setup>
  import asSvg from '@/components/posters/as-svg'
  import { ref, provide } from 'vue'
  import {
    whenever,
    useMagicKeys as keyboard,
    usePointerSwipe as swipe
  } from '@vueuse/core'
  import { use as use_path, itemprop_query as query } from '@/use/path'
  import { is_vector_id, is_vector } from '@/use/vector'
  import { to_hex as to_hex, to_complimentary_hsl } from '@/use/colors'
  defineProps({
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
  provide('as_stroke', as_stroke)
  const {
    opacity_percentage,
    selected_path,
    fill_opacity: opacity,
    color_luminosity: luminosity
  } = use_path()
  const focus_on_active = () => query(itemprop.value).focus()
  const set_input_color = id => {
    itemprop.value = id
    const path = query(id)
    if (as_stroke.value) color.value = to_hex(path.style.color)
    else {
      const fill = path.style.fill
      if (fill) color.value = to_hex(fill)
      else color.value = to_hex()
    }
  }
  const svg_loaded = event => emit('loaded', event)
  const toggle_stroke = () => {
    as_stroke.value = !as_stroke.value
    const path = query(itemprop.value)
    if (as_stroke.value) color.value = to_hex(path.style.color)
    else color.value = to_hex(path.style.fill)
    emit('toggle')
  }
  const { distanceY } = swipe(figure, {
    onSwipe() {
      if (as_stroke.value) luminosity(-1 * (distanceY.value / 3))
      else opacity(-1 * (distanceY.value / 300))
    }
  })
  const keys = keyboard()
  whenever(keys.s, () => toggle_stroke())
  whenever(keys.up, () => {
    if (as_stroke.value) luminosity(4)
    else opacity(0.03)
  })
  whenever(keys.down, () => {
    if (as_stroke.value) luminosity(-4)
    else opacity(-0.03)
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
      bottom: 0
      z-index: 0
      border: none
      padding: 0
      height: auto
      display: flex
      justify-content: space-between
      & > label
        text-transform: capitalize
        position: fixed
        right: base-line
        bottom: inset(bottom,  base-line * 6.5)
        &:nth-of-type(2)
          bottom: inset(bottom,  base-line * 3)
      & > svg
        cursor: pointer
        position: fixed
        z-index: 4
        width: base-line * 1.5
        height: base-line * 1.5
        min-height: auto
        left: base-line
        bottom: inset(bottom,  base-line * 2.5)
        @media (min-width: pad-begins)
          bottom: inset(bottom,  base-line * 4.5)
        border: green
        border-width: 3px
        border-radius: 2rem
      & > input[type="color"]
        position: fixed
        z-index: 2
        width: base-line * 1.5
        height: base-line * 1.5
        right: base-line
        bottom: inset(bottom,  base-line * 2.5)
        @media (min-width: pad-begins)
          bottom: inset(bottom,  base-line * 4.5)
        &::-moz-color-swatch
          border: 1px solid green
          border-radius: base-line
        &::-webkit-color-swatch
          border: 1px solid green
          border-radius: base-line
        &::-webkit-color-swatch-wrapper
          padding: 0
</style>
