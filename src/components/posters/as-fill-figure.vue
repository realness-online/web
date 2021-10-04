<template lang="html">
  <figure id="edit-fill" v-hotkey="keymap" v-finger:pressMove="press_move">
    <as-svg :itemid="itemid" :immediate="true"
            :tabindex="-1" :slice="false" :tabable="true"
            @focus="focus" />
    <figcaption>
      <input v-model="color" :tabindex="-1" type="color">
      <as-svg :tabindex="-1" :itemid="itemid" class="as-line-art" />
    </figcaption>
  </figure>
</template>
<script>
  import as_svg from '@/components/posters/as-svg'
  import finger from '@/mixins/finger'
  import vector from '@/mixins/vector'
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
    data () {
      return {
        color: '#151518',
        focused_layer: ''
      }
    },
    computed: {
      keymap () {
        return {
          up: () => this.change_opacity(),
          down: this.fill_down,
          'shift+up': this.tiny_fill_up,
          'shift+down': this.tiny_fill_down
        }
      }
    },
    watch: {
      color () {
        this.change_color(this.focused_layer, this.color)
      }
    },
    methods: {
      focus (id) {
        this.focused_layer = id
      },
      press_move (evt) {
        this.$emit('pressed')
        if (evt.deltaY > 0) this.change_opacity('down', 'fill', 0.03)
        else this.change_opacity('up', 'fill', 0.03)
      },
      fill_down (event) {
        this.change_opacity('down')
      },
      tiny_fill_up (event) {
        this.change_opacity('up', 'fill', 0.01)
      },
      tiny_fill_down (event) {
        this.change_opacity('down', 'fill', 0.01)
      }
    }
  }
</script>
<style lang="stylus">
  figure#edit-fill
    & > svg
      position: fixed
      z-index: 1
      top: 0
      bottom: 0
      left: 0
      right: 0
    & > figcaption
      border:none
      padding: 0
      height:auto
      padding: base-line
      display: flex
      justify-content: space-between
      & > input
        position:fixed
        z-index: 1
        bottom: base-line * 3
        left: base-line
        width: base-line * 2
        height: base-line * 2
      & > svg
        position:fixed
        z-index: 1
        bottom: base-line * 3
        right: base-line
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
