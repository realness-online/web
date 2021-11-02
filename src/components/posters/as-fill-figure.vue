<template>
  <figure id="edit-fill" v-finger:pressMove="press_move">
    <as-svg
      :itemid="itemid"
      :immediate="true"
      :tabindex="-1"
      :slice="false"
      :tabable="true"
      @focus="focus" />
    <figcaption>
      <as-svg style="visibility: hidden" :itemid="itemid" class="as-line-art" />
      <input v-model="color" :tabindex="-1" type="color" @blur="re_focus" />
    </figcaption>
  </figure>
</template>
<script>
  import as_svg from '@/components/posters/as-svg'
  import {
    change_opacity,
    fill_more,
    fill_less,
    fill_more_subtle,
    fill_less_subtle
  } from '@/use/opacity-editor'

  import { change_color, get_color } from '@/use/color-editor'
  import finger from '@/mixins/finger'
  import vector from '@/mixins/vector'
  import { useKeypress as use_keypress } from 'vue3-keypress'
  import { ref } from 'vue'
  export default {
    components: {
      'as-svg': as_svg
    },
    mixins: [vector, finger],
    props: {
      itemid: {
        required: true,
        type: String
      }
    },
    emits: ['pressed'],
    setup() {
      const is_active = ref('true')
      use_keypress({
        keyEvent: 'keydown',
        isActive: is_active,
        keyBinds: [
          { success: fill_more, keyCode: 'up' },
          { success: fill_less, keyCode: 'down' },
          { success: fill_more_subtle, keyCode: 'up', modifiers: ['shiftKey'] },
          { success: fill_less_subtle, keyCode: 'down', modifiers: ['shiftKey'] }
        ]
      })
    },
    data() {
      return {
        color: '#151518',
        focus_id: ''
      }
    },
    watch: {
      color() {
        change_color(this.focus_id)
      }
    },
    methods: {
      re_focus() {
        document.getElementById(this.focus_id).focus()
      },
      focus(id) {
        this.focus_id = id
        this.color = get_color(this.focus_id)
      },
      press_move(evt) {
        if (evt.deltaY > 0) change_opacity('down', 'fill', 0.03)
        else change_opacity('up', 'fill', 0.03)
      }
    }
  }
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
      position relative
      z-index: 0
      border:none
      padding: 0
      height:auto
      display: flex
      justify-content: space-between
      & > input[type="color"]
        position: fixed
        z-index: 2
        bottom: inset(bottom)
        right: inset(right, base-line)
        width: base-line * 1.75
        height: base-line * 1.75
        &::-webkit-color-swatch
          border: 2px solid green
          border-radius: 32px
      & > svg
        position:fixed
        z-index: 4
        bottom: base-line * 3
        left: base-line
        width: base-line * 2
        height: base-line * 2
        fill: transparent
        border: black
        border-radius:2rem
        min-height: auto
        stroke-width: base-line
        stroke-opacity: 1
        stroke:white
</style>
