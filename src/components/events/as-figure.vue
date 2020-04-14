<template lang="html">
  <figure class="events">
    <icon name="background"></icon>
    <svg v-if="poster"
         @click="vector_click"
         :viewBox="poster.viewbox"
         :preserveAspectRatio="aspect_ratio"
         v-html="poster.path"></svg>
  </figure>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import vector_intersection from '@/mixins/vector_intersection'
  import vector_click from '@/mixins/vector_click'
  import itemid from '@/helpers/itemid'
  import icon from '@/components/icon'
  export default {
    mixins: [vector_intersection, vector_click],
    components: { icon },
    props: {
      event: {
        type: Object,
        required: true
      }
    },
    data () {
      return {
        storage: firebase.storage().ref(),
        poster: null
      }
    },
    methods: {
      async show () {
        this.poster = await itemid.load(this.events.url)
      }
    }
  }
</script>
<style lang="stylus">
  figure.events
    position: relative
    & > svg
      display: block
      height: 100%
      width: 100%
      // @media(min-width: pad-begins)
      //   max-height: base-line * 20
      // @media(min-width: pad-begins) and (orientation: landscape)
      //   max-height: base-line * 20
      // @media(min-width: typing-begins)
      //   max-height: base-line * 16
      &.background
        border: none
        fill: green
</style>
