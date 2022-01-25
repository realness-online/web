<script setup>
  import asSvg from '@/components/posters/as-svg'
  import { ref } from 'vue'
  import {
    whenever,
    useMagicKeys as keyboard,
    usePointerSwipe as swipe
  } from '@vueuse/core'
  import {
    fill_opacity as opacity,
    itemprop_query as query
  } from '@/use/path-style'
  import { is_vector_id } from '@/use/vector'
  import rgb_to_hex from '@/use/rgb-to-hex'
  import css_var from '@/use/css-var'
  const figure = ref(null)
  const color = ref('#151518')
  const itemprop = ref('bold')
  defineProps({
    itemid: {
      required: true,
      type: String,
      validator: is_vector_id
    }
  })
  const focus_on_active = () => query(itemprop.value).focus()
  const set_input_color = id => {
    itemprop.value = id
    const fill = query(itemprop.value).style.fill
    if (fill) color.value = rgb_to_hex(fill)
    else if (id === 'background')
      color.value = css_var('--white-poster').substring(1)
    else color.value = '#151518'
  }
  const { distanceY } = swipe(figure, {
    onSwipe() {
      const chill = distanceY.value / 500
      console.log('swipe', chill)
      opacity(chill)
    }
  })
  const keys = keyboard()
  whenever(keys.up, () => opacity(0.03))
  whenever(keys.up_shift, () => opacity(0.01))
  whenever(keys.down, () => opacity(-0.03))
  whenever(keys.down_shift, () => opacity(-0.01))
  whenever(color, () => (query(itemprop.value).style.fill = color.value))
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
      & > input[type="color"]
        position: fixed
        z-index: 2
        bottom: inset(bottom)
        right: inset(right, base-line)
        width: base-line * 2
        height: base-line * 2
        &::-moz-color-swatch
          border: 2px solid green
          border-radius: 16px
        &::-webkit-color-swatch
          border: 2px solid green
          border-radius: 16px
      & > svg
        position: fixed
        z-index: 4
        bottom: base-line * 3
        left: base-line
        width: base-line * 2
        height: base-line * 2
        fill: transparent
        border: black
        border-radius: 2rem
        min-height: auto
        stroke-width: base-line
        stroke-opacity: 1
        stroke: white
</style>
