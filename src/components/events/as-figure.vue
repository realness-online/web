<template lang="html">
  <figure class="events">
    <icon name="background" />
    <svg v-if="poster"
         :viewBox="poster.viewbox"
         :preserveAspectRatio="aspect_ratio"
         @click="vector_click"
         v-html="poster.path" />
  </figure>
</template>
<script>
  import firebase from 'firebase/app'
  import 'firebase/auth'
  import intersection from '@/mixins/intersection'
  import vector_click from '@/mixins/vector_click'
  import { load } from '@/helpers/itemid'
  import icon from '@/components/icon'
  export default {
    components: { icon },
    mixins: [intersection, vector_click],
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
        this.poster = await load(this.events.url)
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
