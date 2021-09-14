<template lang="html">
  <svg v-hotkey="keymap" :itemid="itemid" itemscope
       itemtype="/posters"
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
  import vector from '@/mixins/vector'
  export default {
    components: { icon },
    mixins: [intersection, vector_click, vector],
    props: {
      tabable: {
        type: Boolean,
        required: false,
        defauls: false
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
          'shift+up': this.shift_up,
          'shift+down': this.shift_down,
          down: this.down,
          up: this.up
        }
      }
    },
    watch: {
      poster () {
        if (this.poster) this.vector = this.poster
      }
    },
    methods: {
      up (event) {
        console.log('up', event)
      },
      down (event) {
        console.log('down', event)
      },
      shift_up (event) {
        console.log('shift_up', event)
      },
      shift_down (event) {
        console.log('shift_down', event)
      },
      tabindex (index) {
        return index + 2
      },
      async focus_poster () {
        this.animation = await this.load_animation()
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
    height: 100%
    width: 100%
    & svg:focus
      fill: white
    & use:focus
      outline: none
      stroke: spin(blue, 3deg)
      stroke-width: 2px
</style>
