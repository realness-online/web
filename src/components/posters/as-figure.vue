<template lang="html">
  <figure class="poster" :class="{ landscape }">
    <icon :name="background" />
    <as-svg ref="poster"
            :itemid="itemid"
            :poster="new_poster"
            @vector-click="vector_click"
            @vector-loaded="on_load" />
    <figcaption>
      <slot v-if="menu" />
    </figcaption>
  </figure>
</template>
<script>
  import icon from '@/components/icon'
  import as_svg from '@/components/posters/as-svg'
  import vector_click from '@/mixins/vector_click'
  export default {
    components: {
      icon,
      'as-svg': as_svg
    },
    mixins: [vector_click],
    props: {
      itemid: {
        type: String,
        required: true
      },
      new_poster: {
        type: Object,
        required: false,
        default: null
      },
      working: {
        type: Boolean,
        required: false,
        default: false
      }
    },
    data () {
      return {
        menu: false,
        poster: null,
        loaded: false
      }
    },
    computed: {
      background () {
        if (this.working) return 'working'
        if (this.loaded) return 'background'
        else return 'working'
      }
    },
    watch: {
      new_poster () {
        if (this.new_poster) {
          this.menu = true
          this.poster = this.new_poster
        }
      }
    },
    methods: {
      async on_load (vector) {
        this.vector = vector
        this.$nextTick()
        this.loaded = true
        this.$emit('loaded', this.$refs.poster.$el.outerHTML)
      }
    }
  }
</script>
<style lang="stylus">
  figure.poster
    position: relative
    overflow: hidden
    @media (min-width: pad-begins)
      &.landscape
        grid-column-start: span 2
      &.new
        margin-left: base-line
    &.selecting-event
      & > svg:not(.background)
        opacity: 0.1
    svg
      &[itemscope]
        position: relative
      &.background
        fill: green
        width: 100%
        height: 100%
      &.working
        margin-top: base-line
        max-width: base-line * 6
    & > figcaption
      position: relative
      & > menu
        padding: base-line
        margin-top: -(base-line * 4)
        display: flex
        justify-content: space-between
        width: 100%
        z-index: 4
        & > a > svg
          fill: red
          &.finished
          &.add
            fill: blue
</style>
