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
<script>
  import finger from '@/mixins/finger'
  import vector from '@/mixins/vector'
  export default {
    mixins: [vector, finger],
    props: {
      itemid: {
        required: true,
        type: String
      }
    },
    emits: ['pressed'],
    data() {
      return {
        color: '#151518',
        focus_id: ''
      }
    },
    watch: {
      color() {
        document.getElementById(this.focus_id).style.fill = this.color
      }
    },
    methods: {
      re_focus() {
        document.getElementById(this.focus_id).focus()
      },
      focus(id) {
        this.focus_id = id
        this.color = document.getElementById(this.focus_id).style.fill
      }
    }
  }
</script>
<script setup>
  import { ref } from 'vue'
  import asSvg from '@/components/posters/as-svg'
  import { fill_opacity } from '@/use/path_style'
  import { useMagicKeys, whenever, usePointerSwipe } from '@vueuse/core'
  const figure = ref(null)
  const { distanceY } = usePointerSwipe(figure, {
    onSwipe(e) {
      if (distanceY.value < 0) fill_opacity('more', 0.03)
      else fill_opacity('less', 0.03)
    }
  })
  const keys = useMagicKeys()
  whenever(keys.up, () => fill_opacity())
  whenever(keys.up_shift, () => fill_opacity('more', 0.01))
  whenever(keys.down, () => fill_opacity('less'))
  whenever(keys.down_shift, () => fill_opacity('less', 0.01))
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
        width: base-line * 1.75
        height: base-line * 1.75
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
