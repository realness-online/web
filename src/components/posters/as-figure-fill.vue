<script setup>
  import Icon from '@/components/icon'
  import AsSvg from '@/components/posters/as-svg'
  import { ref, provide, computed } from 'vue'
  import {
    whenever,
    useMagicKeys as keyboard,
    usePointerSwipe as swipe
  } from '@vueuse/core'
  import { use as use_path, change_by, itemprop_query as query } from '@/use/path'
  import { is_vector_id, is_vector } from '@/use/poster'
  import { to_hex as to_hex, to_complimentary_hsl } from '@/utils/colors'
  import { as_fragment_id } from '@/utils/itemid'
  const props = defineProps({
    itemid: {
      required: true,
      type: String,
      validator: is_vector_id
    }
  })
  const emit = defineEmits({ toggle: () => true, show: is_vector })
  const has_opacity = ref(false)
  const figure = ref(null)
  const color = ref('#151518')
  const itemprop = ref('background')
  const fragment = add => `url(${as_fragment_id(props.itemid)}-${add})`
  const { opacity_percentage, as_stroke, selected_path, fill_opacity, stroke_opacity } =
    use_path()
  provide('as_stroke', as_stroke)
  const focus_on_active = () => query(itemprop.value).focus()
  const layer_selected = id => {
    if (id === 'background') has_opacity.value = false
    else has_opacity.value = true
    itemprop.value = id
    const path = query(id)
    if (as_stroke.value) color.value = to_hex(path.style.color)
    else {
      const { fill } = path.style
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
      if (as_stroke.value) stroke_opacity(-1 * (distance_y.value / 300))
      else fill_opacity(-1 * (distance_y.value / 300))
    }
  })
  const keys = keyboard()
  const disable_controls = computed(() => {
    if (as_stroke.value && selected_path.value === 'background') return true
    else if (!selected_path.value) return true
    return false
  })
  const is_using = () => {
    const layer = selected_path.value
    if (layer) return true
    return false
  }
  const pick_gradient_for = type => {
    const layer = selected_path.value
    if (layer) return fragment(`${type}-${layer}`)
    return fragment(type)
  }
  whenever(keys.s, () => toggle_stroke())
  whenever(keys.up, () => {
    if (as_stroke.value) stroke_opacity(change_by)
    else fill_opacity(change_by)
  })
  whenever(keys.down, () => {
    if (as_stroke.value) stroke_opacity(-change_by)
    else fill_opacity(-change_by)
  })
  whenever(color, () => {
    const path = query(itemprop.value)
    if (as_stroke.value) {
      path.style.color = color.value
      path.style.stroke = 'currentColor'
    } else {
      const current_fill = path.style.fill
      if (to_hex(current_fill) !== color.value) {
        const compliment = to_complimentary_hsl(color.value)
        path.style.fill = color.value
        path.style.color = compliment.color
      }
    }
  })
</script>

<template>
  <figure id="edit-fill" ref="figure">
    <as-svg
      :itemid="itemid"
      :optimize="true"
      :slice="true"
      :tabable="true"
      tabindex="-1"
      @focus="layer_selected" />
    <figcaption hidden>
      <input
        id="opacity"
        v-model="opacity_percentage"
        :disabled="!has_opacity"
        type="range"
        name="opacity"
        tabindex="-1"
        min="0.010"
        max="0.996"
        :step="change_by" />
      <output :value="opacity_percentage" for="opacity" />
      <h4>{{ selected_path }}</h4>
      <menu>
        <as-svg
          inert
          :itemid="itemid"
          :slice="true"
          :toggle_aspect="false"
          tabindex="-1"
          :aria-selected="as_stroke"
          @click="toggle_stroke" />
        <input
          id="color-input"
          v-model="color"
          type="color"
          tabindex="-1"
          :disabled="disable_controls"
          :aria-selected="is_using('input')"
          @blur="focus_on_active" />
        <icon
          name="circle"
          :disabled="disable_controls"
          :aria-selected="is_using('horizontal')"
          :fill="pick_gradient_for('horizontal')" />
        <icon
          name="circle"
          :disabled="disable_controls"
          :aria-selected="is_using('vertical')"
          :fill="pick_gradient_for('vertical')" />
        <icon
          name="circle"
          :disabled="disable_controls"
          :aria-selected="is_using('radial')"
          :fill="pick_gradient_for('radial')" />
      </menu>
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
        padding: (base-line * 0.5) base-line
        bottom: 0
        left: 0
        right: 0
        display: flex
        justify-content: space-between
        & > svg
          user-select: none
          cursor: pointer
          width: base-line * 1.5
          height: base-line * 1.5
          min-height: auto
          border-radius: 2rem
          &[disabled=true]
            opacity: 0.25
          &[aria-selected=true]
            border: (base-line * 0.13) solid green
          @media (min-width: pad-begins)
            bottom: inset(bottom,  base-line * 4.5)
        & > input[type="color"]
          width: base-line * 1.5
          height: base-line * 1.5
          &[disabled]
            &::-moz-color-swatch
              border: (base-line * 0.13) solid transparent
            &::-webkit-color-swatch
              border: (base-line * 0.13) solid transparent
          &::-webkit-color-swatch-wrapper
            padding: 0
          &::-moz-color-swatch
            border-color: red
            border-radius: base-line
          &::-webkit-color-swatch
            border-color: red
            border-radius: base-line
          &[aria-selected=true]
            &::-moz-color-swatch
              border: (base-line * 0.13) solid green
            &::-webkit-color-swatch
              border: (base-line * 0.13) solid green
</style>
