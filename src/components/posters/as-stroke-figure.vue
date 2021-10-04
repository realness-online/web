<template lang="html">
  <figure v-hotkey="keymap" v-finger:pressMove="press_move">
    <as-svg :itemid="itemid" :immediate="true" class="as-line-art"
            :tabindex="-1" :slice="false" :tabable="true" />
    <figcaption>
      <input v-model="color" :tabindex="-1" type="color">
      <as-svg :tabindex="-1" :itemid="itemid" />
    </figcaption>
  </figure>
</template>

<script>
  import as_svg from '@/components/posters/as-svg'
  export default {
    components: {
      'as-svg': as_svg
    },
    props: {
      itemid: {
        required: true,
        type: String
      }
    },
    computed: {
      keymap () {
        return {
          down: this.down_stroke,
          up: this.up_stroke,
          'shift+up': this.tiny_down_stroke,
          'shift+down': this.tiny_up_stroke
        }
      }
    },
    methods: {
      press_move (evt) {
        this.$emit('pressed')
        if (evt.deltaY > 0) this.change_opacity('down', 'stroke', 0.03)
        else this.change_opacity('up', 'stroke', 0.03)
      },
      up_stroke (event) {
        this.change_opacity('up', 'stroke')
      },
      down_stroke (event) {
        this.change_opacity('down', 'stroke')
      },
      tiny_up_stroke (event) {
        this.change_opacity('up', 'stroke', 0.01)
      },
      tiny_down_stroke (event) {
        this.change_opacity('down', 'stroke', 0.01)
      }
    }
  }
</script>

<style lang="stylus">
</style>
