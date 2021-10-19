<template>
  <figure id="edit-fill" v-hotkey="keymap" v-finger:pressMove="press_move">
    <as-svg :itemid="itemid" :immediate="true"
            :tabindex="-1" :slice="false" :tabable="true"
            @focus="focus" />
    <figcaption>
      <as-svg style="visibility:hidden;" :itemid="itemid" class="as-line-art" />
      <input v-model="color" :tabindex="-1" type="color" @blur="re_focus">
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
    emits: ['pressed'],
    setup() {
      console.log('as-fill-figure')
    },
    data () {
      return {
        color: '#151518',
        focus_id: ''
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
        this.change_color(this.focus_id)
      }
    },
    methods: {
      re_focus () {
        document.getElementById(this.focus_id).focus()
      },
      focus (id) {
        this.focus_id = id
        this.color = this.get_color(this.focus_id)
      },
      press_move (evt) {
        this.$emit('pressed')
        if (evt.deltaY > 0) this.change_opacity('down', 'fill', 0.03)
        else this.change_opacity('up', 'fill', 0.03)
      },
      fill_down () {
        this.change_opacity('down')
      },
      tiny_fill_up () {
        this.change_opacity('up', 'fill', 0.01)
      },
      tiny_fill_down () {
        this.change_opacity('down', 'fill', 0.01)
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
    & > figcaption
      position relative
      z-index: 0
      border:none
      padding: 0
      height:auto
      display: flex
      justify-content: space-between
      & > input
        border: 2px solid red
        position:fixed
        z-index: 2
        bottom: base-line * 3
        right: base-line
        width: base-line * 2
        height: base-line * 2
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
