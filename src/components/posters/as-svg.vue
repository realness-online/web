<template lang="html">
  <svg :itemid="itemid" itemscope itemtype="/posters"
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
    watch: {
      poster () {
        if (this.poster) this.vector = this.poster
      }
    },
    methods: {
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
    &.as-line-art
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
        stroke: red
        animation-name: press-hold
</style>
