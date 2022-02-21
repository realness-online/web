<template>
  <figure class="poster" :class="{ landscape }">
    <as-svg
      ref="poster"
      :itemid="itemid"
      :poster="new_poster"
      :immediate="immediate"
      @click="vector_click"
      @loaded="on_load" />
    <figcaption>
      <slot v-if="menu">
        <menu>
          <as-link :itemid="itemid">
            <time>{{ posted_at }}</time>
          </as-link>
          <as-download :itemid="itemid" />
          <as-messenger v-if="signed_in" :itemid="itemid" />
        </menu>
      </slot>
    </figcaption>
  </figure>
</template>
<script>
  import { as_query_id, as_author, load, as_created_at } from '@/use/itemid'
  import { as_time } from '@/use/date'
  import as_svg from '@/components/posters/as-svg'
  import vector_click from '@/mixins/vector_click'
  import signed_in from '@/mixins/signed_in'
  import as_download from '@/components/download-vector'
  import as_messenger from '@/components/profile/as-messenger'
  import as_link from '@/components/profile/as-link'
  export default {
    components: {
      'as-svg': as_svg,
      'as-link': as_link,
      'as-messenger': as_messenger,
      'as-download': as_download
    },
    mixins: [vector_click, signed_in],
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
      },
      immediate: {
        type: Boolean,
        required: false,
        default: false
      }
    },
    emits: ['loaded'],
    data() {
      return {
        menu: false,
        poster: null,
        person: null,
        loaded: false
      }
    },
    computed: {
      query_id() {
        return as_query_id(this.itemid)
      },
      posted_at() {
        return as_time(as_created_at(this.itemid))
      },
      background() {
        if (this.working) return 'working'
        if (this.loaded) return 'background'
        else return 'working'
      }
    },
    watch: {
      async menu() {
        if (this.menu && !this.person) {
          this.person = await load(as_author(this.itemid))
        }
      },
      new_poster() {
        if (this.new_poster) this.menu = true
      }
    },
    updated() {
      const fragment = window.location.hash.substring(1)
      if (this.query_id === fragment) this.$refs.poster.$el.scrollIntoView()
    },
    methods: {
      async on_load(vector) {
        this.vector = vector
        await this.$nextTick()
        this.loaded = true
        this.$emit('loaded', this.$refs.poster.$el.outerHTML)
      },
      open_sms_app() {
        window.open(this.sms_link, '_self')
      }
    }
  }
</script>
<style lang="stylus">
  figure.poster
    border-radius: round((base-line * .03), 2)
    position: relative
    overflow: hidden
    grid-row-start: span 2
    @media (orientation: landscape), (min-width: page-width)
      &.landscape
        grid-column-start: span 2
        &.new
          grid-column-start: span 3
    @media (min-width: pad-begins)
      &.new:not(.landscape)
        grid-column: 2
        grid-row: 2
    svg
      z-index: 1
      &[itemscope]
        transition-property: all
        position: relative
      &.working
        min-height: 512px
        margin-top: base-line
        max-width: round(base-line * 6)
    & > figcaption > menu
      height: 0
      & > a
        z-index: 2
        position: absolute
        @media (prefers-color-scheme: dark)
          &.phone > svg
          &.download > svg
            fill: blue
        &.phone
          top: base-line
          right: base-line
        &.download
          bottom: base-line
          right: base-line
        &.profile
          top: base-line
          left: base-line
          & > address
            & > h3:first-of-type
              margin-right: base-line * .333
            & > h3
            & > time
              color: blue
              line-height: 1
</style>
