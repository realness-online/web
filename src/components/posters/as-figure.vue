<template lang="html">
  <figure class="poster">
    <icon :name="background" />
    <as-svg ref="poster"
            :itemid="itemid"
            :poster="new_poster"
            @vector-click="$emit('vector-click', $event)"
            @vector-loaded="on_load" />
    <figcaption>
      <slot />
    </figcaption>
  </figure>
</template>
<script>
  import icon from '@/components/icon'
  import as_svg from '@/components/posters/as-svg'
  export default {
    components: {
      icon,
      'as-svg': as_svg
    },
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
      async on_load (poster) {
        this.loaded = true
        this.$nextTick()
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
        column-span: 2
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
