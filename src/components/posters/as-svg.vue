<template lang="html">
  <svg v-hotkey="keymap" v-finger:pressMove="press_move"
       :itemid="itemid" itemscope itemtype="/posters"
       :viewBox="viewbox" :preserveAspectRatio="aspect_ratio"
       @focus="focus_poster()"
       @blur="blur_poster()"
       @click="vector_click">
    <defs>
      <symbol v-for="(symbol, index) in path" :id="symbol_id(index)" :key="index" :viewBox="viewbox" v-html="symbol" />
    </defs>
    <icon name="background" :tabindex="tabable ? 0 : false" />
    <use v-for="(symbol, index) in path" :key="index" :tabindex="tabable ? 0 : false" :href="symbol_fragment(index)" />
  </svg>
</template>
<script>
  import icon from '@/components/icon'
  import { load } from '@/helpers/itemid'
  import intersection from '@/mixins/intersection'
  import vector_click from '@/mixins/vector_click'
  import finger from '@/mixins/finger'
  import vector from '@/mixins/vector'
  export default {
    components: { icon },
    mixins: [intersection, vector_click, vector, finger],
    props: {
      tabable: {
        type: Boolean,
        required: false,
        default: false
      },
      itemid: {
        type: String,
        required: true
      },
      poster: {
        type: Object,
        required: false,
        default: null
      }
    },
    computed: {
      keymap () {
        return {
          up: () => this.change_opacity(),
          down: this.fill_down,
          'shift+up': this.tiny_fill_up,
          'shift+down': this.tiny_fill_down,
          left: this.down_stroke,
          right: this.up_stroke,
          'shift+left': this.tiny_down_stroke,
          'shift+right': this.tiny_up_stroke
        }
      }
    },
    watch: {
      poster () {
        if (this.poster) this.vector = this.poster
      }
    },
    methods: {
      // swipe (event) {
      //   this.change_opacity('up', 'fill', 0.01)
      //   console.log('swipe: ', event.direction)
      //   switch (event.direction) {
      //     case 'left': this.next(); break
      //     case 'right': this.previous(); break
      //     default:
      //   }
      //   this.$emit('change-opacity')
      // },
      press_move (evt) {
        this.$emit('pressed')
        // console.log('pressMove X: ', evt.deltaX)
        // console.log('pressMove Y: ', evt.deltaY)
        if (evt.deltaY > 0) this.change_opacity('down', 'fill', 0.03)
        else this.change_opacity('up', 'fill', 0.03)
      },
      change_opacity (direction = 'up', type = 'fill', resolution = 0.025) {
        if (!document.activeElement) return
        let fragment = document.activeElement.getAttribute('href')
        fragment = fragment.substring(1)
        const symbols = this.$el.querySelectorAll('symbol')
        symbols.forEach(symbol => {
          const id = symbol.getAttribute('id')
          if (id === fragment) {
            const path = symbol.querySelector('path')
            let opacity = path.getAttribute(`${type}-opacity`)

            if (!opacity || opacity === 'NaN') opacity = 0.5
            opacity = parseFloat(opacity)
            opacity = opacity * 10000
            opacity = Math.round(opacity)
            opacity = opacity / 10000

            if (direction === 'down') opacity += resolution
            else opacity -= resolution

            if (opacity > 1) opacity = 1
            else if (opacity < 0) opacity = 0

            path.setAttribute(`${type}-opacity`, opacity)
            this.$emit('change-opacity')
          }
        })
      },
      fill_down (event) {
        this.change_opacity('down')
      },
      tiny_fill_up (event) {
        this.change_opacity('up', 'fill', 0.01)
      },
      tiny_fill_down (event) {
        this.change_opacity('down', 'fill', 0.01)
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
      },
      async focus_poster () {
        // this.animation = await this.load_animation()
      },
      async blur_poster () {
        this.animation = null
      },
      async show () {
        if (this.vector) return
        if (this.poster) this.vector = this.poster
        else this.vector = await load(this.itemid)

        await this.$nextTick()
        this.$emit('vector-loaded', this.vector)
      }
    }
  }
</script>
<style lang="stylus">
  svg[itemtype="/posters"]
    display: block
    min-height: 512px
    height: 100%
    width: 100%
    &.as-line-work
      fill: transparent
    & svg:focus
      fill: white
    & > use
      stroke: background-black
      stroke-width: 1px
      stroke-opacity: 0.5
      outline: none
      &:focus
        animation-name: press
      &:active
        animation-name: press-hold
</style>
