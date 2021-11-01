<template>
  <icon v-if="working" name="working" tabindex="0" />
  <svg
    v-else
    :itemid="itemid"
    itemscope
    itemtype="/posters"
    :viewBox="viewbox"
    :preserveAspectRatio="aspect_ratio"
    @focus="focus()"
    @blur="blur()"
    @click="vector_click">
    <defs>
      <symbol :id="background_id"><rect width="100%" height="100%" /></symbol>
      <symbol
        v-for="(symbol, index) in path"
        :id="symbol_id(index)"
        :key="index"
        :viewBox="viewbox"
        v-html="symbol" />
    </defs>
    <use
      class="background"
      :href="background_fragment"
      :tabindex="tabable ? 0 : -1"
      @focus="focus('background')" />
    <use
      v-for="(symbol, index) in path"
      :key="index"
      :tabindex="tabable ? 0 : -1"
      :href="symbol_fragment(index)"
      @focus="focus(index)" />
  </svg>
</template>
<script>
  import { load } from '@/helpers/itemid'
  import intersection from '@/mixins/intersection'
  import vector_click from '@/mixins/vector_click'
  import vector from '@/mixins/vector'
  import icon from '@/components/icon'
  export default {
    components: {
      icon
    },
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
    emits: ['focus', 'vector-loaded'],
    data() {
      return {
        working: true
      }
    },
    watch: {
      poster() {
        if (this.poster) this.vector = this.poster
      }
    },
    methods: {
      async focus(id) {
        if (id === 'background') this.$emit('focus', this.background_id)
        else this.$emit('focus', this.symbol_id(id))
      },
      async blur() {
        this.animation = null
      },
      async show() {
        if (this.vector) return
        if (this.poster) this.vector = this.poster
        else this.vector = await load(this.itemid)
        this.working = false
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
    &:focus
      border:2px solid red
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
        stroke: white
        fill: red
        animation-name: press-hold
      &.background
        fill:white
        &:focus
          fill:blue
</style>
