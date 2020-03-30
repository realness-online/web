<template lang="html">
  <figure class="poster" :class="selecting">
    <as-svg :itemid="itemid"
            :new_poster="new_poster"
            @vector-click="vector_click"></as-svg>
    <figcaption>
      <event-as-fieldset :itemid="itemid"
                         :selecting="show_date_picker"
                         :menu="menu"></event-as-fieldset>
      <poster-menu v-if="menu" :itemid="itemid"
                   :is_new="new_poster? true : false"
                   :working="working"
                   @add-poster="add_poster"
                   @remove-poster="remove_poster"></poster-menu>
    </figcaption>
  </figure>
</template>
<script>
  import as_svg from '@/components/posters/as-svg'
  import as_menu from '@/components/posters/as-menu'
  import event_as_fieldset from '@/components/events/as-fieldset'
  export default {
    components: {
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
      },
      events: {
        type: Array,
        required: false,
        default: () => []
      }
    },
    data () {
      return {
        menu: false,
        poster: null
      }
    },
    created () {
      if (this.new_poster) this.menu = true
      if (this.new_poster) this.poster = this.new_poster
    },
    computed: {
      show_date_picker () {
        if ((this.menu || this.show_event) && this.new_poster === null) return true
        else return false
      },
      selecting () {
        return {
          'selecting-date': this.show_event
        }
      }
    },
    methods: {
      vector_click (menu) {
        if (this.show_event) this.menu = false
        else this.menu = menu
      },
      remove_poster () {
        const message = 'Delete poster?'
        if (window.confirm(message)) {
          this.$emit('remove-poster', this.itemid)
        }
      },
      add_poster () {
        this.show_event = false
        this.menu = false
        this.$emit('add-poster', this.itemid)
      }
    }
  }
</script>
<style lang="stylus">
  figure.poster
    position: relative
    @media (min-width: pad-begins)
      &:first-of-type:not(.new) // how to handle the first poster on a desktop
        max-width: 50vw
    &.selecting-date
      & > svg > use:not(.background)
        opacity: 0.1
    & > figcaption
      position: relative
</style>
