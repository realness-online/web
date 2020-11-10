<template lang="html">
  <figure class="poster" :class="{ 'selecting-event': selecting_event }">
    <icon :name="background" />
    <as-svg :itemid="itemid"
            :poster="new_poster"
            @vector-click="vector_click"
            @vector-loaded="vector_loaded" />
    <figcaption>
      <event-as-fieldset v-if="date_picker"
                         :itemid="itemid"
                         :menu="menu"
                         @picker="event_picker" />
      <poster-menu v-if="menu"
                   :itemid="itemid"
                   :is_new="new_poster? true : false"
                   :working="working"
                   @add-poster="add_poster"
                   @remove-poster="remove_poster" />
    </figcaption>
  </figure>
</template>
<script>
  import icon from '@/components/icon'
  import as_svg from '@/components/posters/as-svg'
  import as_menu from '@/components/posters/as-menu'
  import event_as_fieldset from '@/components/events/as-fieldset'
  export default {
    components: {
      icon,
      'as-svg': as_svg,
      'poster-menu': as_menu,
      'event-as-fieldset': event_as_fieldset
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
        selecting_event: false,
        loaded: false
      }
    },
    computed: {
      background () {
        if (this.working) return 'working'
        if (this.loaded) return 'background'
        else return 'working'
      },
      date_picker () {
        if ((this.menu || this.selecting_event) && this.new_poster === null) return true
        else return false
      }
    },
    created () {
      if (this.new_poster) {
        this.menu = true
        this.poster = this.new_poster
      }
    },
    methods: {
      event_picker (selecting) {
        if (selecting) {
          this.menu = false
          this.selecting_event = true
        } else {
          this.menu = true
          this.selecting_event = false
        }
      },
      vector_loaded () {
        this.loaded = true
      },
      vector_click (menu) {
        if (this.selecting_event) this.menu = false
        else this.menu = menu
      },
      remove_poster () {
        const message = 'Delete poster?'
        if (this.new_poster) this.$emit('remove-poster', this.itemid)
        else if (window.confirm(message)) this.$emit('remove-poster', this.itemid)
      },
      add_poster () {
        this.selecting_event = false
        this.menu = false
        this.$emit('add-poster', this.itemid)
      }
    }
  }
</script>
<style lang="stylus">
  figure.poster
    position: relative
    overflow: hidden
    @media (min-width: pad-begins)
      &.new
        margin-left: base-line
    &.selecting-event
      & > svg:not(.background)
        opacity: 0.1
    & > figcaption
      position: relative
    svg[itemscope]
      position: relative
    svg.background
      fill: green
      width: 100%
      height: 100%
    svg.working
      margin-top: base-line
      max-width: base-line * 6
</style>
