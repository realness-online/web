<template lang="html">
  <figure class="events poster">
    <icon name="background"></icon>
    <svg v-if="poster"
         @click="svg_click"
         :viewBox="poster.view_box"
         :preserveAspectRatio="aspect_ratio"
         v-html="poster.path" ></svg>
  </figure>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import intersection_mixin from '@/mixins/vector_intersection'
  import profile from '@/helpers/profile'
  import icon from '@/components/icon'
  export default {
    mixins: [intersection_mixin],
    components: { icon },
    props: {
      event: {
        type: Object,
        required: true
      }
    },
    data() {
      return {
        storage: firebase.storage().ref(),
        poster: null,
        slice: false
      }
    },
    computed: {
      aspect_ratio() {
        if (this.slice) return 'xMidYMid slice'
        else return 'xMidYMid meet'
      }
    },
    methods: {
      async show() {
        const [person, poster] = this.event.url.split('/posters')
        this.poster = await profile.item(person, `posters${poster}`)
      },
      svg_click(event) {
        this.slice = !this.slice
        this.$emit('poster-clicked', event)
      }
    }
  }
</script>
<style lang="stylus">
  figure.events.poster
    position: relative
    & > svg
      display: block
      height: 100%
      width: 100%
      max-height: page-width
      &.background
        border: none
        fill: green
</style>
