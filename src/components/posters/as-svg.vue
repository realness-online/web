<template lang="html">
  <svg :itemid="itemid" itemscope itemtype="/posters"
       :viewBox="viewbox" :preserveAspectRatio="aspect_ratio"
       @focus="focus()" @blur="blur()" @click="vector_click">
    <defs>
      <symbol :id="background_id"><rect width="100%" height="100%" /></symbol>
      <symbol v-for="(symbol, index) in path" :id="symbol_id(index)" :key="index" :viewBox="viewbox" v-html="symbol" />
    </defs>
    <use class="background" :href="background_fragment" :tabindex="tabable ? 0 : false" @focus="focus('background')" />
    <use v-for="(symbol, index) in path" :key="index" :tabindex="tabable ? 0 : false" :href="symbol_fragment(index)" @focus="focus(index)" />
  </svg>
</template>
<script>
  import { load } from '@/helpers/itemid'
  import intersection from '@/mixins/intersection'
  import vector_click from '@/mixins/vector_click'
  import vector from '@/mixins/vector'
  export default {
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
      async focus (id) {
        if (id === 'background') this.$emit('focus', this.background_id)
        else this.$emit('focus', this.symbol_id(id))
      },
      async blur () {
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
      &.background
        fill:white
        // @media (prefers-color-scheme: dark)
        //   fill: blue
</style>
