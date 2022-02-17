<script setup>
  import asSvg from '@/components/posters/as-svg'
  import { ref, provide } from 'vue'
  import {
    whenever,
    useMagicKeys as keyboard,
    usePointerSwipe as swipe
  } from '@vueuse/core'
  import {
    fill_opacity as opacity,
    itemprop_query as query,
    color_luminosity as luminosity
  } from '@/use/path-style'
  import { is_vector_id } from '@/use/vector'
  import { to_hex, to_complimentary_hsl } from '@/use/colors'
  import css_var from '@/use/css-var'
  defineProps({
    itemid: {
      required: true,
      type: String,
      validator: is_vector_id
    }
  })
  const emit = defineEmits(['toggle'])
  const figure = ref(null)
  const color = ref('#151518')
  const itemprop = ref('background')
  const as_stroke = ref(false)
  provide('as_stroke', as_stroke)
  const focus_on_active = () => {
    query(itemprop.value).focus()
  }
  const set_input_color = id => {
    itemprop.value = id
    if (as_stroke.value) {
      const stroke = query(id).style.stroke
      console.log(stroke)
      if (stroke) color.value = to_hex(stroke)
    } else {
      const fill = query(id).style.fill
      if (fill) color.value = to_hex(fill)
      else if (id === 'background')
        color.value = css_var('--white-poster').substring(1)
      else color.value = '#151518'
    }
  }
  const toggle_stroke = () => {
    as_stroke.value = !as_stroke.value
    if (as_stroke.value) color.value = to_hex(query(itemprop.value).style.color)
    else color.value = to_hex(query(itemprop.value).style.fill)
    emit('toggle')
  }
  const { distanceY } = swipe(figure, {
    onSwipe() {
      if (as_stroke.value) {
        const chill = distanceY.value / 50
        luminosity(chill)
      } else {
        const chill = distanceY.value / 500
        opacity(chill)
      }
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
    if (as_stroke.value) query(itemprop.value).style.color = color.value
    else {
      query(itemprop.value).style.fill = color.value
      query(itemprop.value).style.color = to_complimentary_hsl(
        color.value
      ).color
    }
  })
</script>
<template>
  <figure id="edit-fill" ref="figure">
    <as-svg
      :itemid="itemid"
      :immediate="true"
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
        v-model="color"
        type="color"
        tabindex="-1"
        @blur="focus_on_active" />
    </figcaption>
  </figure>
</template>
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
      position: relative
      z-index: 0
      border: none
      padding: 0
      height: auto
      display: flex
      justify-content: space-between
      & > button
      & > svg
        cursor: pointer
        position: fixed
        z-index: 4
        bottom: inset(bottom,  base-line * 4.5)
      & > button
        padding: round(base-line * .25, 2) round(base-line * .33, 2)
        color: red
        border-color: red
        left: inset(left, base-line * 3 )
      & > svg
        left: inset(left, base-line)
        width: base-line * 1.5
        height: base-line * 1.5
        border: green
        border-width: 3px
        border-radius: 2rem
        min-height: auto
      & > input[type="color"]
        position: fixed
        z-index: 2
        bottom: inset(bottom,  base-line * 4.5)
        right: inset(right, base-line)
        width: base-line * 1.5
        height: base-line * 1.5
        &::-moz-color-swatch
          border: 1px solid green
          border-radius: base-line
        &::-webkit-color-swatch
          border: 1px solid green
          border-radius: base-line
        &::-webkit-color-swatch-wrapper
          padding: 0
</style>
