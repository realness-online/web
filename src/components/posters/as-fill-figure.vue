<script setup>
  import { ref } from 'vue'
  import asSvg from '@/components/posters/as-svg'
  import { fill_opacity, path_query } from '@/use/path-style'
  import { useMagicKeys, whenever, usePointerSwipe } from '@vueuse/core'
  import { is_vector_id } from '@/use/vector'
  const figure = ref(null)
  const color = ref('#151518')
  const focus_id = ref(null)
  defineProps({
    itemid: {
      required: true,
      type: String,
      validator: is_vector_id
    }
  })
  const re_focus = () => {
    path_query(focus_id.value).focus()
  }
  const focus = id => {
    focus_id.value = id
    let element = path_query(focus_id.value)
    color.value = element.style.fill
  }
  const { distanceY } = usePointerSwipe(figure, {
    onSwipe() {
      if (distanceY.value < 0) fill_opacity('more', 0.03)
      else fill_opacity('less', 0.03)
    }
  })
  const keys = useMagicKeys()
  whenever(keys.up, () => fill_opacity())
  whenever(keys.up_shift, () => fill_opacity('more', 0.01))
  whenever(keys.down, () => fill_opacity('less'))
  whenever(keys.down_shift, () => fill_opacity('less', 0.01))
  whenever(color, () => (path_query(focus_id.value).style.fill = color.value))
</script>
<template>
  <figure id="edit-fill" ref="figure">
    <as-svg
      :itemid="itemid"
      :immediate="true"
      :tabindex="-1"
      :slice="false"
      :tabable="true"
      @focus="focus" />
    <figcaption>
      <input v-model="color" :tabindex="-1" type="color" @blur="re_focus" />
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
        position: relative
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
