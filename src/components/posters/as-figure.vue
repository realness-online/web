<template lang="html">
  <figure class="poster" :class="{ landscape }">
    <icon :name="background" />
    <as-svg ref="poster"
            :itemid="itemid"
            :poster="new_poster"
            @vector-click="vector_click"
            @vector-loaded="on_load" />
    <figcaption>
      <slot v-if="menu">
        <menu>
          <as-link :itemid="itemid">
            <time>{{ posted_at }}</time>
          </as-link>
          <as-download :itemid="itemid" />
          <as-messenger :itemid="itemid" />
        </menu>
      </slot>
    </figcaption>
  </figure>
</template>
<script>
  import icon from '@/components/icon'
  import { as_author, load, as_created_at } from '@/helpers/itemid'
  import { as_time } from '@/helpers/date'
  import as_svg from '@/components/posters/as-svg'
  import vector_click from '@/mixins/vector_click'
  import as_download from '@/components/download-vector'
  import as_messenger from '@/components/profile/as-messenger'
  import as_link from '@/components/profile/as-link'
  export default {
    components: {
      icon,
      'as-svg': as_svg,
      'as-link': as_link,
      'as-messenger': as_messenger,
      'as-download': as_download
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
        person: null,
        loaded: false
      }
    },
    computed: {
      posted_at () {
        return as_time(as_created_at(this.itemid))
      },
      background () {
        if (this.working) return 'working'
        if (this.loaded) return 'background'
        else return 'working'
      }
    },
    watch: {
      async menu () {
        if (this.menu && !this.person) {
          this.person = await load(as_author(this.itemid))
        }
      },
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
      },
      open_sms_app (event) {
        window.open(this.sms_link, '_self')
      }
    }
  }
</script>
<style lang="stylus">
  figure.poster
    border-radius: (base-line / 6)
    position: relative
    overflow: hidden
    margin-bottom: base-line
    @media (min-width: pad-begins)
      &.landscape
        grid-column-start: span 2
      &.new
        margin-left: base-line
    svg
      z-index: 1
      &[itemscope]
        position: relative
      &.background
        width: 100%
        height: 100%
      &.working
        margin-top: base-line
        max-width: round(base-line * 6)
    & > figcaption > menu
      height: 0
      & > a
        z-index: 2
        position: absolute
        &.phone
          top: base-line
          right: base-line
          & > svg
            fill: blue
        &.download
          bottom: base-line
          right: base-line
          & > svg
            fill: blue
        &.profile
          top: base-line
          left: base-line
          & > hgroup
            & > h3:first-of-type
              margin-right: (base-line/3)
            & > h3
            & > time
              line-height: 1
              color: white
              text-shadow: 0.1px .1px dark-black
</style>
